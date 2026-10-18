/**
 * Detection orchestrator. Window enumeration, screen capture and template
 * loading live in ./detection/*; grayscale conversion and NCC run in a worker
 * so tray events never wait for a matching pass. Providers are injectable so
 * the class runs under plain Node (see tests/detector-e2e.test.ts); the
 * defaults resolve Electron lazily.
 */
import * as path from 'node:path';
import * as fs from 'node:fs';
import type { ClickMode } from '../shared/types';
import type { MatchDebugInfo, TemplatePayload } from '../shared/match-protocol';
import { capturePointToPhysical, windowCapturePointToPhysical } from './capture-geometry';
import type { GrayImage } from './matcher';
import { MatchWorkerClient } from './match-worker-client';
import { watchKindForWindow, type WatchKind } from './watch-windows';
import { type DetectionMetrics, perfNow, reportDetectionMetrics } from './perf';
import { hashBgra } from '../shared/crop-hash';
import { loadTemplateCatalog } from './detection/template-loader';
import { windowRank, type WindowProvider } from './detection/window-finder';
import type { CaptureProvider } from './detection/screen-capture';
import type { CropContext, DisplayInfo, WindowInfo } from './detection/types';

export type { CaptureProvider } from './detection/screen-capture';
export type { WindowProvider } from './detection/window-finder';
export type { CaptureResult, CropContext, DisplayInfo, WindowInfo } from './detection/types';

/** The slice of MatchWorkerClient the detector needs. */
export interface Matcher {
  initialize: MatchWorkerClient['initialize'];
  match: MatchWorkerClient['match'];
  cancelCurrent(): void;
  dispose(): Promise<void>;
}

export interface DetectorOptions {
  /** Explicit project/app root for diagnostics whose Electron entry is a script. */
  bundledRoot?: string;
  windows?: WindowProvider;
  capture?: CaptureProvider;
  matcher?: Matcher;
  displays?: () => DisplayInfo[];
  /** Bundled templates dir first, then user capture dirs. */
  templateDirs?: () => string[];
  loadImage?: (file: string) => Promise<GrayImage>;
}

const EMPTY_METRICS: DetectionMetrics = {
  totalMs: 0,
  templatesMs: 0,
  windowsMs: 0,
  captureMs: 0,
  matchMs: 0,
  templateCount: 0,
  variantCount: 0,
  displayCount: 0,
  cropCount: 0,
  sourceMissCount: 0,
  skippedUnchanged: 0,
  workerHeapBytes: 0,
  cancelled: false,
};
const DEBUG_DETECT =
  process.env.CURSOR_AUTO_RUNNER_DEBUG_DETECT === '1' ||
  process.env.CURSOR_AUTO_RUNNER_DEBUG_MATCH === '1';

function reindexCrops(crops: CropContext[]): CropContext[] {
  return crops.map((crop, id) => ({ ...crop, id, payload: { ...crop.payload, id } }));
}

function safeConsoleWarn(...args: unknown[]): void {
  try {
    console.warn(...args);
  } catch {
    // GUI launches have no stdout; logging during quit can throw EPIPE.
  }
}

function electron(): typeof import('electron') {
  return require('electron') as typeof import('electron');
}

function defaultTemplateDirs(bundledRoot?: string): string[] {
  const { app } = electron();
  // app.getAppPath() is the project root in dev and resources/app.asar when
  // packaged; the asar-patched fs reads bundled templates from either.
  const bundled = bundledRoot ?? app.getAppPath();
  // Bundled references are listed first. Local captures are selected separately
  // so a newer screenshot is not dropped behind older bundled files.
  const dirs = [path.join(bundled, 'assets', 'templates')];
  const userCandidates = [
    path.join(app.getPath('userData'), 'assets', 'templates'),
    ...(process.platform === 'darwin'
      ? [
          path.join(
            app.getPath('home'),
            'Library',
            'Application Support',
            'Cursor Auto Runner',
            'assets',
            'templates'
          ),
        ]
      : []),
  ];
  for (const userTemplates of userCandidates) {
    if (fs.existsSync(userTemplates) && !dirs.includes(userTemplates)) dirs.push(userTemplates);
  }
  return dirs;
}

export class Detector {
  private readonly matcher: Matcher;
  private windowProvider: WindowProvider | null;
  private captureProvider: CaptureProvider | null;
  private readonly displaysFn: () => DisplayInfo[];
  private readonly templateDirsFn: () => string[];
  private readonly loadImageFn: (file: string) => Promise<GrayImage>;
  private templatePromise: Promise<TemplatePayload[]> | null = null;
  private workerInitialized = false;
  private loadAttempted = false;
  private templateCount = 0;
  private totalVariantCount = 0;
  private windowCache: { at: number; windows: WindowInfo[] } | null = null;
  private cancelGeneration = 0;
  private missLogStreak = 0;
  private lastMissLogAt = 0;
  private disposing = false;

  windowFound = false;
  /** Per-crop hash of the last pass that produced a miss (unchanged-screen skip). */
  private missHashes = new Map<string, { hash: number; lastMissAt: number }>();
  private lastDetectParams: { mode: ClickMode; confidence: number } | null = null;
  watchedKind: WatchKind | null = null;
  lastMetrics: DetectionMetrics = { ...EMPTY_METRICS };

  constructor(options: DetectorOptions = {}) {
    this.matcher = options.matcher ?? new MatchWorkerClient();
    this.windowProvider = options.windows ?? null;
    this.captureProvider = options.capture ?? null;
    this.displaysFn =
      options.displays ?? (() => electron().screen.getAllDisplays() as DisplayInfo[]);
    this.templateDirsFn = options.templateDirs ?? (() => defaultTemplateDirs(options.bundledRoot));
    this.loadImageFn =
      options.loadImage ??
      ((file) =>
        (require('./template-loader') as typeof import('./template-loader')).loadTemplateNative(
          file
        ));
  }

  private windows(): WindowProvider {
    if (!this.windowProvider) {
      const { screen } = electron();
      const { NutWindowProvider } =
        require('./detection/window-finder') as typeof import('./detection/window-finder');
      const { getButtonTestWindow } = require('./button-test') as typeof import('./button-test');
      this.windowProvider = new NutWindowProvider({
        displayNearestPoint: (point) => screen.getDisplayNearestPoint(point),
        allDisplays: () => screen.getAllDisplays(),
        testWindow: () => getButtonTestWindow(),
      });
    }
    return this.windowProvider;
  }

  private capturer(): CaptureProvider {
    if (!this.captureProvider) {
      const { ElectronCaptureProvider } =
        require('./detection/screen-capture') as typeof import('./detection/screen-capture');
      this.captureProvider = new ElectronCaptureProvider();
    }
    return this.captureProvider;
  }

  private async loadTemplates(): Promise<TemplatePayload[]> {
    this.loadAttempted = true;
    const { payloads, duplicates, rejected, limited } = await loadTemplateCatalog(
      this.templateDirsFn(),
      this.loadImageFn
    );
    this.templateCount = payloads.length;
    if (payloads.length === 0) {
      console.warn(
        '[detector] no valid templates found; capture a tightly cropped button template first'
      );
    } else {
      console.log(
        `[detector] ${payloads.length} unique templates ready (${duplicates} duplicates, ${rejected} invalid, ${limited} over limit skipped)`
      );
    }
    return payloads;
  }

  private async ensureTemplates(): Promise<void> {
    if (this.workerInitialized) return;
    if (!this.templatePromise) this.templatePromise = this.loadTemplates();
    try {
      const templates = await this.templatePromise;
      const ready = await this.matcher.initialize(templates);
      this.workerInitialized = true;
      this.templateCount = ready.templateCount;
      this.totalVariantCount = ready.variantCount;
      console.log(`[detector] worker prepared ${ready.variantCount} scaled variants`);
    } catch (error) {
      // Transferred buffers cannot be reused after a worker failure.
      this.templatePromise = null;
      this.workerInitialized = false;
      throw error;
    }
  }

  hasTemplates(): boolean {
    return this.loadAttempted && this.templateCount > 0;
  }

  /** Drop cached templates after an in-app capture. */
  resetTemplates(): void {
    this.cancelPending();
    this.templatePromise = null;
    this.workerInitialized = false;
    this.loadAttempted = false;
    this.templateCount = 0;
    this.totalVariantCount = 0;
    this.missHashes.clear();
  }

  cancelPending(): void {
    this.cancelGeneration++;
    this.matcher.cancelCurrent();
  }

  async dispose(): Promise<void> {
    this.disposing = true;
    this.cancelPending();
    await this.matcher.dispose();
  }

  /** Drop the short window cache so a just-opened test window is seen immediately. */
  invalidateWindowCache(): void {
    this.windowCache = null;
    this.missHashes.clear();
  }

  /** Find all Cursor windows, caching the native enumeration briefly. */
  private async findCursorWindows(): Promise<WindowInfo[]> {
    const now = Date.now();
    if (this.windowCache && now - this.windowCache.at < 750) return this.windowCache.windows;

    const provider = this.windows();
    const found = await provider.list(false);
    const listed = found.length > 0 ? found : await provider.list(true);
    const refreshed = [...listed].sort((left, right) => windowRank(right) - windowRank(left));
    this.watchedKind = refreshed.length > 0 ? watchKindForWindow(refreshed[0]) : null;
    this.windowCache = { at: now, windows: refreshed };
    return refreshed;
  }

  private logDetectionMiss(
    confidence: number,
    crops: CropContext[],
    bestMiss?: MatchDebugInfo
  ): void {
    if (!bestMiss || this.disposing) return;
    this.missLogStreak++;
    const now = Date.now();
    const shouldLog = DEBUG_DETECT || this.missLogStreak >= 3 || now - this.lastMissLogAt > 15_000;
    if (!shouldLog) return;
    this.lastMissLogAt = now;
    const sample = crops[0];
    safeConsoleWarn(
      '[detector] no button match',
      JSON.stringify({
        threshold: confidence,
        missStreak: this.missLogStreak,
        cropCount: crops.length,
        displayScale: sample?.display.scaleFactor,
        cropSize: sample ? { width: sample.payload.width, height: sample.payload.height } : null,
        windowCrop: Boolean(sample?.windowLogical),
        bestMiss,
      })
    );
  }

  /**
   * Search all visible Cursor windows. No full-screen fallback is used when
   * window lookup fails: it was both expensive and prone to false positives.
   */
  async detect(
    mode: ClickMode,
    confidence = 0.88
  ): Promise<{
    x: number;
    y: number;
    mode: ClickMode;
    score: number;
    path: 'accent' | 'anchored-row' | 'global';
    pyramid: 'full' | 'half' | 'quarter';
    template: string;
    focus: () => Promise<boolean>;
  } | null> {
    const startedAt = perfNow();
    const generation = this.cancelGeneration;
    const cancelled = (): boolean => generation !== this.cancelGeneration;
    const metrics: DetectionMetrics = { ...EMPTY_METRICS };
    try {
      const templatesStartedAt = perfNow();
      await this.ensureTemplates();
      if (cancelled()) {
        metrics.cancelled = true;
        return null;
      }
      metrics.templatesMs = perfNow() - templatesStartedAt;
      metrics.templateCount = this.templateCount;
      metrics.variantCount = this.totalVariantCount;
      if (this.templateCount === 0) return null;

      const windowsStartedAt = perfNow();
      const cursorWindows = await this.findCursorWindows();
      if (cancelled()) {
        metrics.cancelled = true;
        return null;
      }
      metrics.windowsMs = perfNow() - windowsStartedAt;
      this.windowFound = cursorWindows.length > 0;
      this.watchedKind = cursorWindows.length > 0 ? watchKindForWindow(cursorWindows[0]) : null;
      if (!this.windowFound) return null;

      const displays = this.displaysFn();
      metrics.displayCount = displays.length;
      const captureStartedAt = perfNow();
      const captureProvider = this.capturer();
      const capture = await captureProvider.captureCrops(cursorWindows, displays, cancelled);
      let crops = capture.crops;
      if (process.platform === 'darwin' && captureProvider.captureWindowCrops) {
        const windowCrops = await captureProvider.captureWindowCrops(cursorWindows, 0, cancelled);
        if (windowCrops.length > 0) {
          const covered = new Set(windowCrops.map((crop) => crop.windowKey));
          crops = [...windowCrops, ...capture.crops.filter((crop) => !covered.has(crop.windowKey))];
        }
      }
      crops = reindexCrops(crops);
      metrics.captureMs = perfNow() - captureStartedAt;
      metrics.cropCount = crops.length;
      metrics.sourceMissCount = capture.sourceMissCount;
      if (cancelled()) {
        metrics.cancelled = true;
        return null;
      }
      if (crops.length === 0) return null;

      if (
        !this.lastDetectParams ||
        this.lastDetectParams.mode !== mode ||
        this.lastDetectParams.confidence !== confidence
      ) {
        this.missHashes.clear();
        this.lastDetectParams = { mode, confidence };
      }
      // Hash before the buffers are transferred (and detached) to the worker.
      const hashes = new Map<number, { key: string; hash: number }>();
      const toMatch: CropContext[] = [];
      let cropsDropped = 0;
      for (const crop of crops) {
        const key = `${crop.windowKey}\0${crop.cropX}\0${crop.cropY}`;
        const hash = hashBgra(
          new Uint8Array(crop.payload.bgra),
          crop.payload.width,
          crop.payload.height
        );
        hashes.set(crop.id, { key, hash });
        const previous = this.missHashes.get(key);
        if (previous && previous.hash === hash) {
          cropsDropped++;
        } else {
          toMatch.push(crop);
        }
      }
      metrics.skippedUnchanged = cropsDropped;
      if (toMatch.length === 0) return null;
      crops = toMatch;

      const response = await this.matcher.match(
        mode,
        confidence,
        crops.map((crop) => crop.payload)
      );
      if (response.cancelled || cancelled()) {
        for (const crop of crops) this.missHashes.delete(hashes.get(crop.id)!.key);
      } else if (response.match) {
        const matched = crops.find((candidate) => candidate.id === response.match!.cropId);
        const prefix = matched ? `${matched.windowKey}\0` : null;
        for (const key of [...this.missHashes.keys()]) {
          if (prefix && key.startsWith(prefix)) this.missHashes.delete(key);
        }
        for (const crop of crops) this.missHashes.delete(hashes.get(crop.id)!.key);
      } else {
        const now = Date.now();
        for (const crop of crops) {
          const entry = hashes.get(crop.id)!;
          this.missHashes.set(entry.key, { hash: entry.hash, lastMissAt: now });
        }
      }
      metrics.matchMs = response.matchMs;
      metrics.variantCount = response.variantCount;
      metrics.workerHeapBytes = response.workerHeapBytes;
      metrics.cancelled = response.cancelled;
      if (!response.match && response.bestMiss) {
        this.logDetectionMiss(confidence, crops, response.bestMiss);
      }
      if (!response.match || response.cancelled || cancelled()) {
        metrics.cancelled = response.cancelled || cancelled();
        return null;
      }
      this.missLogStreak = 0;

      const crop = crops.find((candidate) => candidate.id === response.match!.cropId);
      if (!crop) return null;
      const localX = response.match.x + response.match.templateWidth / 2;
      const localY = response.match.y + response.match.templateHeight / 2;
      const physical = crop.windowLogical
        ? windowCapturePointToPhysical(
            crop.windowLogical,
            crop.display,
            { x: crop.captureScaleX, y: crop.captureScaleY },
            { x: localX, y: localY }
          )
        : capturePointToPhysical(
            crop.display,
            { x: crop.captureScaleX, y: crop.captureScaleY },
            {
              x: crop.cropX + localX,
              y: crop.cropY + localY,
            }
          );
      return {
        x: physical.x,
        y: physical.y,
        mode: response.match.mode,
        score: response.match.score,
        path: response.match.path,
        pyramid: response.match.pyramid,
        template: path.basename(response.match.file),
        focus: crop.focus,
      };
    } catch (error) {
      this.workerInitialized = false;
      this.templatePromise = null;
      throw error;
    } finally {
      metrics.totalMs = perfNow() - startedAt;
      this.lastMetrics = metrics;
      reportDetectionMetrics(metrics);
    }
  }
}

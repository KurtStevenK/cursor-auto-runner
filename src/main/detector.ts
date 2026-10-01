/**
 * Detection orchestrator. Electron capture/window APIs stay on the main
 * process; grayscale conversion and NCC run in a worker so tray events never
 * wait for a matching pass.
 */
import { app, desktopCapturer, screen as electronScreen } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { getWindows } from '@nut-tree-fork/nut-js';
import type { ClickMode } from '../shared/types';
import type { CropPayload, MatchDebugInfo, TemplatePayload } from '../shared/match-protocol';
import {
  capturePointToPhysical,
  captureRequestSize,
  captureToNativeScales,
  normalizeWindowRegionForDisplay,
  windowCapturePointToPhysical,
  type WindowRegion,
} from './capture-geometry';
import { ensureMacScreenCapture } from './permissions';
import {
  fingerprintDistance,
  loadTemplate,
  templateFingerprint,
  validateTemplateDimensions,
} from './matcher';
import { MatchWorkerClient } from './match-worker-client';
import {
  DetectionMetrics,
  perfNow,
  reportDetectionMetrics,
} from './perf';

interface WindowInfo {
  left: number;
  top: number;
  width: number;
  height: number;
  title: string;
  focus: () => Promise<boolean>;
}

interface CropContext {
  id: number;
  payload: CropPayload;
  display: Electron.Display;
  captureScaleX: number;
  captureScaleY: number;
  cropX: number;
  cropY: number;
  /** When set, match coordinates are relative to a per-window thumbnail. */
  windowLogical?: WindowRegion;
  focus: () => Promise<boolean>;
}

interface CaptureResult {
  crops: CropContext[];
  sourceMissCount: number;
}

interface LoadedFingerprint {
  mode: ClickMode;
  theme: 'dark' | 'light';
  fingerprint: Uint8Array;
}

export interface DetectorOptions {
  /** Explicit project/app root for diagnostics whose Electron entry is a script. */
  bundledRoot?: string;
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
  workerHeapBytes: 0,
  cancelled: false,
};
// Two curated bundled references plus one local capture keep matching bounded
// while guaranteeing that stale user captures cannot hide all known-good ones.
const MAX_TEMPLATES_PER_MODE_AND_THEME = 3;
const MAX_CAPTURE_WIDTH = 1920;
const MAX_CAPTURE_HEIGHT = 1080;
const DEBUG_DETECT =
  process.env.CURSOR_AUTO_RUNNER_DEBUG_DETECT === '1' ||
  process.env.CURSOR_AUTO_RUNNER_DEBUG_MATCH === '1';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function windowRank(window: WindowInfo): number {
  const title = window.title.toLowerCase();
  if (title.includes('auto runner')) return -1_000_000;
  if (title.includes('cursor-auto-runner')) return -100_000;
  return window.width * window.height;
}

function safeConsoleWarn(...args: unknown[]): void {
  try {
    console.warn(...args);
  } catch {
    // GUI launches have no stdout; logging during quit can throw EPIPE.
  }
}

export class Detector {
  private readonly matcher = new MatchWorkerClient();
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
  lastMetrics: DetectionMetrics = { ...EMPTY_METRICS };

  constructor(private readonly options: DetectorOptions = {}) {}

  private templatesDirs(): string[] {
    // app.getAppPath() is the project root in dev and resources/app.asar when
    // packaged; the asar-patched fs reads bundled templates from either.
    const bundled = this.options.bundledRoot ?? app.getAppPath();
    // Keep bundled fallbacks ahead of user captures so a stale local catalog
    // cannot consume every bounded slot.
    const bundledTemplates = path.join(bundled, 'assets', 'templates');
    const dirs = [bundledTemplates];
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

  private async loadTemplates(): Promise<TemplatePayload[]> {
    this.loadAttempted = true;
    const payloads: TemplatePayload[] = [];
    const fingerprints: LoadedFingerprint[] = [];
    const acceptedPerGroup = new Map<string, number>();
    let duplicates = 0;
    let rejected = 0;
    let limited = 0;

    for (const dir of this.templatesDirs()) {
      for (const theme of ['dark', 'light'] as const) {
        const themeDir = path.join(dir, theme);
        if (!fs.existsSync(themeDir)) continue;
        const files = fs
          .readdirSync(themeDir)
          .filter((file) => file.toLowerCase().endsWith('.png'))
          .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

        for (const mode of ['always-run', 'run', 'allow'] as const) {
          const matching = files.filter(
            (file) => file === `${mode}.png` || file.startsWith(`${mode}-`)
          );
          for (const fileName of matching) {
            const file = path.join(themeDir, fileName);
            const group = `${mode}:${theme}`;
            if ((acceptedPerGroup.get(group) ?? 0) >= MAX_TEMPLATES_PER_MODE_AND_THEME) {
              limited++;
              continue;
            }
            try {
              const image = await loadTemplate(file);
              const validation = validateTemplateDimensions(image.width, image.height);
              if (!validation.valid) {
                rejected++;
                console.warn(`[detector] skipped ${file}: ${validation.reason}`);
                continue;
              }
              const fingerprint = templateFingerprint(image);
              const duplicate = fingerprints.some(
                (entry) =>
                  entry.mode === mode &&
                  entry.theme === theme &&
                  fingerprintDistance(entry.fingerprint, fingerprint) <= 8
              );
              if (duplicate) {
                duplicates++;
                continue;
              }
              fingerprints.push({ mode, theme, fingerprint });
              acceptedPerGroup.set(group, (acceptedPerGroup.get(group) ?? 0) + 1);
              const data = image.data.buffer.slice(
                image.data.byteOffset,
                image.data.byteOffset + image.data.byteLength
              ) as ArrayBuffer;
              payloads.push({ file, mode, theme, width: image.width, height: image.height, data });
            } catch (error) {
              rejected++;
              console.error(`[detector] failed to load template ${file}:`, error);
            }
          }
        }
      }
    }

    this.templateCount = payloads.length;
    if (payloads.length === 0) {
      console.warn('[detector] no valid templates found; capture a tightly cropped button template first');
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

  /** Find all Cursor windows, caching the native enumeration briefly. */
  private async findCursorWindows(): Promise<WindowInfo[]> {
    const now = Date.now();
    if (this.windowCache && now - this.windowCache.at < 750) return this.windowCache.windows;

    const found: WindowInfo[] = [];
    try {
      const windows = await getWindows();
      const candidates = await Promise.all(
        windows.map(async (win) => {
          const rawTitle = (await win.title) || '';
          const title = rawTitle.toLowerCase();
          if (!title.includes('cursor') || title.includes('auto runner')) return null;
          const region = await win.region;
          if (!region || region.width <= 50 || region.height <= 50) return null;
          const display = electronScreen.getDisplayNearestPoint({
            x: region.left + region.width / 2,
            y: region.top + region.height / 2,
          });
          const normalized = normalizeWindowRegionForDisplay(region, display);
          return {
            left: normalized.left,
            top: normalized.top,
            width: normalized.width,
            height: normalized.height,
            title: rawTitle,
            focus: () => win.focus(),
          } satisfies WindowInfo;
        })
      );
      found.push(...candidates.filter((candidate): candidate is WindowInfo => candidate !== null));
      found.sort((left, right) => windowRank(right) - windowRank(left));
    } catch (error) {
      console.error('[detector] window enumeration failed:', error);
    }
    this.windowCache = { at: now, windows: found };
    return found;
  }

  private intersects(window: WindowInfo, display: Electron.Display): boolean {
    const bounds = display.bounds;
    return (
      window.left < bounds.x + bounds.width &&
      window.left + window.width > bounds.x &&
      window.top < bounds.y + bounds.height &&
      window.top + window.height > bounds.y
    );
  }

  private sourceForDisplay(
    sources: Electron.DesktopCapturerSource[],
    display: Electron.Display
  ): Electron.DesktopCapturerSource | undefined {
    const exact = sources.find((candidate) => candidate.display_id === String(display.id));
    if (exact) return exact;
    if (sources.length === 1) return sources[0];

    // Some platforms omit display_id. An aspect-ratio fallback is safe only
    // when it identifies exactly one source; never guess between equal screens.
    const targetAspect = display.size.width / display.size.height;
    const aspectMatches = sources.filter((candidate) => {
      const size = candidate.thumbnail.getSize();
      return size.height > 0 && Math.abs(size.width / size.height - targetAspect) < 0.01;
    });
    if (aspectMatches.length === 1) {
      console.warn(`[detector] display ${display.id} matched by unique aspect ratio`);
      return aspectMatches[0];
    }
    return undefined;
  }

  private async screenSourcesForDisplay(
    display: Electron.Display,
    requestSize: ReturnType<typeof captureRequestSize>
  ): Promise<Electron.DesktopCapturerSource[]> {
    await ensureMacScreenCapture();
    const thumbnailSize = { width: requestSize.width, height: requestSize.height };
    for (let attempt = 0; attempt < 3; attempt++) {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize,
      });
      const source = this.sourceForDisplay(sources, display);
      const size = source?.thumbnail.getSize();
      if (source && size && size.width >= 10 && size.height >= 10) return sources;
      if (attempt < 2) await sleep(150 * (attempt + 1));
    }
    console.warn(
      `[detector] screen thumbnail unavailable for display ${display.id}; check Screen Recording permission`
    );
    return await desktopCapturer.getSources({ types: ['screen'], thumbnailSize });
  }

  private windowSourceForTitle(
    sources: Electron.DesktopCapturerSource[],
    title: string
  ): Electron.DesktopCapturerSource | undefined {
    const lower = title.toLowerCase();
    const exact = sources.find((source) => source.name === title);
    if (exact) return exact;
    const partial = sources.filter((source) => {
      const name = source.name.toLowerCase();
      return name.includes('cursor') && !name.includes('auto runner');
    });
    if (partial.length === 1) return partial[0];
    return partial.find((source) => lower.includes(source.name.toLowerCase()) || source.name.toLowerCase().includes(lower.slice(0, 24)));
  }

  private async captureDarwinWindowCrops(
    windows: WindowInfo[],
    startId: number,
    cancelled: () => boolean
  ): Promise<CropContext[]> {
    if (process.platform !== 'darwin' || windows.length === 0) return [];
    await ensureMacScreenCapture();
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: MAX_CAPTURE_WIDTH, height: MAX_CAPTURE_HEIGHT },
    });
    const crops: CropContext[] = [];
    for (const window of windows) {
      if (cancelled()) break;
      const source = this.windowSourceForTitle(sources, window.title);
      if (!source) continue;
      const thumbnail = source.thumbnail;
      const size = thumbnail.getSize();
      if (size.width < 10 || size.height < 10) continue;
      const display = electronScreen.getDisplayNearestPoint({
        x: window.left + window.width / 2,
        y: window.top + window.height / 2,
      });
      const captureScaleX = size.width / window.width;
      const captureScaleY = size.height / window.height;
      const nativeW = Math.max(1, Math.round(window.width * display.scaleFactor));
      const nativeH = Math.max(1, Math.round(window.height * display.scaleFactor));
      const templateScale = captureToNativeScales(size, { width: nativeW, height: nativeH });
      const id = startId + crops.length;
      crops.push({
        id,
        payload: {
          id,
          width: size.width,
          height: size.height,
          captureToNativeScaleX: templateScale.x,
          captureToNativeScaleY: templateScale.y,
          bgra: await this.bitmapBuffer(thumbnail),
        },
        display,
        captureScaleX,
        captureScaleY,
        cropX: 0,
        cropY: 0,
        windowLogical: {
          left: window.left,
          top: window.top,
          width: window.width,
          height: window.height,
        },
        focus: window.focus,
      });
    }
    return crops;
  }

  private logDetectionMiss(
    confidence: number,
    crops: CropContext[],
    bestMiss?: MatchDebugInfo
  ): void {
    if (!bestMiss || this.disposing) return;
    this.missLogStreak++;
    const now = Date.now();
    const shouldLog =
      DEBUG_DETECT || this.missLogStreak >= 3 || now - this.lastMissLogAt > 15_000;
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

  private async bitmapBuffer(image: Electron.NativeImage): Promise<ArrayBuffer> {
    const bitmap = image.toBitmap();
    if (
      bitmap.buffer instanceof ArrayBuffer &&
      bitmap.byteOffset === 0 &&
      bitmap.byteLength === bitmap.buffer.byteLength
    ) {
      return bitmap.buffer;
    }
    // Pooled Buffers cannot safely transfer their whole backing store. Copy in
    // bounded chunks so a large high-DPI crop cannot stall tray events.
    const owned = new Uint8Array(bitmap.byteLength);
    const chunkBytes = 512 * 1024;
    for (let offset = 0; offset < bitmap.byteLength; offset += chunkBytes) {
      owned.set(bitmap.subarray(offset, Math.min(bitmap.byteLength, offset + chunkBytes)), offset);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    return owned.buffer;
  }

  private async captureCrops(
    windows: WindowInfo[],
    displays: Electron.Display[],
    cancelled: () => boolean
  ): Promise<CaptureResult> {
    const relevant = displays
      .map((display) => ({
        display,
        windows: windows.filter((window) => this.intersects(window, display)),
      }))
      .filter((entry) => entry.windows.length > 0);
    if (relevant.length === 0) return { crops: [], sourceMissCount: 0 };

    const crops: CropContext[] = [];
    const sourcesBySize = new Map<string, Electron.DesktopCapturerSource[]>();
    let sourceMissCount = 0;

    for (const entry of relevant) {
      if (cancelled()) break;
      const requestSize = captureRequestSize(
        entry.display,
        MAX_CAPTURE_WIDTH,
        MAX_CAPTURE_HEIGHT
      );
      const requestKey = `${requestSize.width}x${requestSize.height}`;
      let sources = sourcesBySize.get(requestKey);
      if (!sources) {
        sources = await this.screenSourcesForDisplay(entry.display, requestSize);
        sourcesBySize.set(requestKey, sources);
      }
      if (cancelled()) break;
      const source = this.sourceForDisplay(sources, entry.display);
      if (!source) {
        sourceMissCount++;
        console.warn(
          `[detector] no unambiguous screen source for display ${entry.display.id}; available IDs: ${sources
            .map((candidate) => candidate.display_id || '(empty)')
            .join(', ')}`
        );
        continue;
      }
      const thumbnail = source.thumbnail;
      const size = thumbnail.getSize();
      if (size.width < 10 || size.height < 10) {
        console.warn(
          `[detector] empty screen thumbnail on display ${entry.display.id} (${size.width}x${size.height})`
        );
        continue;
      }
      const scaleX = size.width / entry.display.bounds.width;
      const scaleY = size.height / entry.display.bounds.height;
      const templateScale = captureToNativeScales(size, {
        width: requestSize.nativeWidth,
        height: requestSize.nativeHeight,
      });

      for (const window of entry.windows) {
        if (cancelled()) break;
        const left = Math.max(window.left, entry.display.bounds.x);
        const top = Math.max(window.top, entry.display.bounds.y);
        const right = Math.min(window.left + window.width, entry.display.bounds.x + entry.display.bounds.width);
        const bottom = Math.min(window.top + window.height, entry.display.bounds.y + entry.display.bounds.height);
        const cropX = Math.max(0, Math.floor((left - entry.display.bounds.x) * scaleX));
        const cropY = Math.max(0, Math.floor((top - entry.display.bounds.y) * scaleY));
        const cropRight = Math.min(size.width, Math.ceil((right - entry.display.bounds.x) * scaleX));
        const cropBottom = Math.min(size.height, Math.ceil((bottom - entry.display.bounds.y) * scaleY));
        const width = cropRight - cropX;
        const height = cropBottom - cropY;
        if (width < 10 || height < 10) continue;

        const cropped = thumbnail.crop({ x: cropX, y: cropY, width, height });
        const croppedSize = cropped.getSize();
        const id = crops.length;
        crops.push({
          id,
          payload: {
            id,
            width: croppedSize.width,
            height: croppedSize.height,
            captureToNativeScaleX: templateScale.x,
            captureToNativeScaleY: templateScale.y,
            bgra: await this.bitmapBuffer(cropped),
          },
          display: entry.display,
          captureScaleX: scaleX,
          captureScaleY: scaleY,
          cropX,
          cropY,
          focus: window.focus,
        });
      }
    }
    return { crops, sourceMissCount };
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
      if (!this.windowFound) return null;

      const displays = electronScreen.getAllDisplays();
      metrics.displayCount = displays.length;
      const captureStartedAt = perfNow();
      const capture = await this.captureCrops(cursorWindows, displays, cancelled);
      let crops = capture.crops;
      if (process.platform === 'darwin') {
        const windowCrops = await this.captureDarwinWindowCrops(cursorWindows, 0, cancelled);
        if (windowCrops.length > 0) crops = windowCrops;
      }
      metrics.captureMs = perfNow() - captureStartedAt;
      metrics.cropCount = crops.length;
      metrics.sourceMissCount = capture.sourceMissCount;
      if (cancelled()) {
        metrics.cancelled = true;
        return null;
      }
      if (crops.length === 0) return null;

      const response = await this.matcher.match(
        mode,
        confidence,
        crops.map((crop) => crop.payload)
      );
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

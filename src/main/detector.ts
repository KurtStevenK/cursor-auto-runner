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
import type { CropPayload, TemplatePayload } from '../shared/match-protocol';
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
  focus: () => Promise<boolean>;
}

interface LoadedFingerprint {
  mode: ClickMode;
  theme: 'dark' | 'light';
  fingerprint: Uint8Array;
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
  workerHeapBytes: 0,
  cancelled: false,
};
const MAX_TEMPLATES_PER_MODE_AND_THEME = 2;
const MAX_CAPTURE_WIDTH = 1920;
const MAX_CAPTURE_HEIGHT = 1080;

export class Detector {
  private readonly matcher = new MatchWorkerClient();
  private templatePromise: Promise<TemplatePayload[]> | null = null;
  private workerInitialized = false;
  private loadAttempted = false;
  private templateCount = 0;
  private totalVariantCount = 0;
  private windowCache: { at: number; windows: WindowInfo[] } | null = null;
  private cancelGeneration = 0;

  windowFound = false;
  lastMetrics: DetectionMetrics = { ...EMPTY_METRICS };

  private templatesDirs(): string[] {
    // app.getAppPath() is the project root in dev and resources/app.asar when
    // packaged; the asar-patched fs reads bundled templates from either.
    const bundled = app.getAppPath();
    // Custom captures take precedence when a perceptual duplicate is present.
    return app.isPackaged
      ? [path.join(app.getPath('userData'), 'assets', 'templates'), path.join(bundled, 'assets', 'templates')]
      : [path.join(bundled, 'assets', 'templates')];
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
          const title = ((await win.title) || '').toLowerCase();
          if (!title.includes('cursor') || title.includes('auto runner')) return null;
          const region = await win.region;
          if (!region || region.width <= 50 || region.height <= 50) return null;
          return {
            left: region.left,
            top: region.top,
            width: region.width,
            height: region.height,
            focus: () => win.focus(),
          } satisfies WindowInfo;
        })
      );
      found.push(...candidates.filter((candidate): candidate is WindowInfo => candidate !== null));
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

  private async bitmapBuffer(image: Electron.NativeImage): Promise<ArrayBuffer> {
    const bitmap = image.getBitmap();
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
  ): Promise<CropContext[]> {
    const relevant = displays
      .map((display) => ({
        display,
        windows: windows.filter((window) => this.intersects(window, display)),
      }))
      .filter((entry) => entry.windows.length > 0);
    if (relevant.length === 0) return [];

    const thumbnailSize = {
      width: Math.min(
        MAX_CAPTURE_WIDTH,
        Math.max(...relevant.map(({ display }) => Math.round(display.bounds.width * display.scaleFactor)))
      ),
      height: Math.min(
        MAX_CAPTURE_HEIGHT,
        Math.max(...relevant.map(({ display }) => Math.round(display.bounds.height * display.scaleFactor)))
      ),
    };
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize });
    if (cancelled()) return [];
    const crops: CropContext[] = [];

    for (const entry of relevant) {
      if (cancelled()) break;
      const source =
        sources.find((candidate) => candidate.display_id === String(entry.display.id)) ??
        (sources.length === 1 ? sources[0] : undefined);
      if (!source) {
        console.warn(`[detector] no screen source for display ${entry.display.id}`);
        continue;
      }
      const thumbnail = source.thumbnail;
      const size = thumbnail.getSize();
      if (size.width < 10 || size.height < 10) continue;
      const scaleX = size.width / entry.display.bounds.width;
      const scaleY = size.height / entry.display.bounds.height;

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
    return crops;
  }

  /**
   * Search all visible Cursor windows. No full-screen fallback is used when
   * window lookup fails: it was both expensive and prone to false positives.
   */
  async detect(
    mode: ClickMode,
    confidence = 0.88
  ): Promise<{ x: number; y: number; mode: ClickMode; focus: () => Promise<boolean> } | null> {
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
      const crops = await this.captureCrops(cursorWindows, displays, cancelled);
      metrics.captureMs = perfNow() - captureStartedAt;
      metrics.cropCount = crops.length;
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
      if (!response.match || response.cancelled || cancelled()) {
        metrics.cancelled = response.cancelled || cancelled();
        return null;
      }

      const crop = crops.find((candidate) => candidate.id === response.match!.cropId);
      if (!crop) return null;
      const captureX = crop.cropX + response.match.x + response.match.templateWidth / 2;
      const captureY = crop.cropY + response.match.y + response.match.templateHeight / 2;
      const logicalX = crop.display.bounds.x + captureX / crop.captureScaleX;
      const logicalY = crop.display.bounds.y + captureY / crop.captureScaleY;
      return {
        x: Math.round(logicalX * crop.display.scaleFactor),
        y: Math.round(logicalY * crop.display.scaleFactor),
        mode: response.match.mode,
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

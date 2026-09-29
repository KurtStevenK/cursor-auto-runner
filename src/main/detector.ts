/**
 * Detection engine: finds the Cursor IDE window and locates the
 * Run / Always Run button inside it by image matching.
 *
 * Multi-monitor strategy:
 *  1. Enumerate all displays and the Cursor window (absolute
 *     virtual-desktop coordinates, via the OS window list).
 *  2. Capture each display with Electron desktopCapturer and search the
 *     area where the Cursor window intersects that display (or the whole
 *     display when window lookup fails).
 *  3. Pure-JS grayscale NCC matching with multi-scale templates absorbs
 *     per-display DPI scaling differences.
 */
import { app, desktopCapturer, screen as electronScreen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { getWindows } from '@nut-tree-fork/nut-js';
import { findBestMatch, grayFromBGRA, loadTemplate, resizeGray, GrayImage } from './matcher';
import type { ClickMode } from '../shared/types';

const SCALES = [1.0, 0.8, 1.25, 1.5];

interface TemplateVariant {
  mode: ClickMode;
  theme: 'dark' | 'light';
  scale: number;
  image: GrayImage | null;
  file: string;
}

interface WindowInfo {
  left: number;
  top: number;
  width: number;
  height: number;
  focus: () => Promise<boolean>;
}

export class Detector {
  private variants: TemplateVariant[] = [];
  private loadAttempted = false;
  windowFound = false;

  private templatesDir(): string {
    const base = app.isPackaged ? process.resourcesPath : app.getAppPath();
    return path.join(base, 'assets', 'templates');
  }

  /** Lazily load all template images (per theme) and pre-scale them.
   *  Multiple captures per mode are supported: run.png, run-2.png, run-3.png… */
  private async prepareVariants(): Promise<TemplateVariant[]> {
    if (this.loadAttempted) return this.variants;
    this.loadAttempted = true;
    const dir = this.templatesDir();

    for (const theme of ['dark', 'light'] as const) {
      const themeDir = path.join(dir, theme);
      if (!fs.existsSync(themeDir)) continue;
      const files = fs.readdirSync(themeDir).filter((f) => f.endsWith('.png'));
      for (const mode of ['always-run', 'run'] as const) {
        const matching = files.filter((f) => f === `${mode}.png` || f.startsWith(`${mode}-`));
        for (const fileName of matching) {
          const file = path.join(themeDir, fileName);
          let base: GrayImage;
          try {
            base = await loadTemplate(file);
          } catch (err) {
            console.error(`[detector] failed to load template ${file}:`, err);
            continue;
          }
          for (const scale of SCALES) {
            this.variants.push({
              mode,
              theme,
              scale,
              file,
              image: scale === 1.0 ? base : resizeGray(base, scale),
            });
          }
        }
      }
    }
    if (this.variants.length === 0) {
      console.warn(
        '[detector] no templates found. Run `npm run capture-templates` once to capture the Run / Always Run buttons from your own setup.'
      );
    } else {
      console.log(`[detector] ${this.variants.length} template variants ready`);
    }
    return this.variants;
  }

  hasTemplates(): boolean {
    return this.loadAttempted && this.variants.length > 0;
  }

  /** Find ALL Cursor windows (IDE + agent windows) in absolute logical (DIP) coordinates. */
  private async findCursorWindows(): Promise<WindowInfo[]> {
    const found: WindowInfo[] = [];
    try {
      const windows = await getWindows();
      for (const win of windows) {
        const title = ((await win.title) || '').toLowerCase();
        if (title.includes('cursor') && !title.includes('auto runner')) {
          const region = await win.region;
          if (region && region.width > 50 && region.height > 50) {
            found.push({
              left: region.left,
              top: region.top,
              width: region.width,
              height: region.height,
              focus: () => win.focus(),
            });
          }
        }
      }
    } catch (err) {
      console.error('[detector] window enumeration failed:', err);
    }
    return found;
  }

  /** Capture one display at native resolution and return its grayscale image. */
  private async captureDisplay(display: Electron.Display): Promise<{ gray: GrayImage; originX: number; originY: number } | null> {
    const scale = display.scaleFactor;
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: Math.round(display.size.width * scale),
          height: Math.round(display.size.height * scale),
        },
      });
      const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0];
      if (!source) return null;
      const thumb = source.thumbnail;
      const width = thumb.getSize().width;
      const height = thumb.getSize().height;
      if (width < 10 || height < 10) return null;
      const gray = grayFromBGRA(thumb.getBitmap(), width, height);
      // Physical-pixel origin of this display in the virtual desktop.
      return { gray, originX: Math.round(display.bounds.x * scale), originY: Math.round(display.bounds.y * scale) };
    } catch (err) {
      console.error(`[detector] capture of display ${display.id} failed:`, err);
      return null;
    }
  }

  /**
   * Search for the button for the requested mode across ALL Cursor
   * windows (IDE + agent windows — they place the button differently).
   * `always-run` prefers the "Always Run" template and falls back to "Run".
   * Returns the absolute physical click point plus a best-effort focus callback.
   */
  async detect(mode: ClickMode): Promise<{ x: number; y: number; mode: ClickMode; focus: () => Promise<boolean> } | null> {
    const variants = await this.prepareVariants();
    if (variants.length === 0) return null;

    const cursorWindows = await this.findCursorWindows();
    this.windowFound = cursorWindows.length > 0;

    const displays = electronScreen.getAllDisplays();
    const preferred: ClickMode[] = mode === 'always-run' ? ['always-run', 'run'] : ['run'];
    const rank = (v: TemplateVariant) => preferred.indexOf(v.mode) * 10 + (v.theme === 'dark' ? 0 : 5) + SCALES.indexOf(v.scale);
    const ordered = variants.slice().sort((a, b) => rank(a) - rank(b));

    for (const display of displays) {
      const capture = await this.captureDisplay(display);
      if (!capture) continue;
      const { gray, originX, originY } = capture;

      // Candidate crops: every Cursor window intersecting this display
      // (the IDE window and the agent window may be on the same or
      // different monitors). Without window info, search the full display.
      const crops: { gray: GrayImage; x: number; y: number; focus: () => Promise<boolean> }[] = [];
      if (cursorWindows.length === 0) {
        crops.push({ gray, x: 0, y: 0, focus: async () => false });
      }
      for (const win of cursorWindows) {
        const wx0 = Math.round(win.left * display.scaleFactor);
        const wy0 = Math.round(win.top * display.scaleFactor);
        const wx1 = Math.round((win.left + win.width) * display.scaleFactor);
        const wy1 = Math.round((win.top + win.height) * display.scaleFactor);
        const dx0 = Math.max(0, wx0 - originX);
        const dy0 = Math.max(0, wy0 - originY);
        const dx1 = Math.min(gray.width, wx1 - originX);
        const dy1 = Math.min(gray.height, wy1 - originY);
        if (dx1 - dx0 < 10 || dy1 - dy0 < 10) continue; // window not on this display
        crops.push({
          gray: cropGrayRegion(gray, dx0, dy0, dx1 - dx0, dy1 - dy0),
          x: dx0,
          y: dy0,
          focus: win.focus,
        });
      }

      for (const crop of crops) {
        for (const variant of ordered) {
          if (!variant.image) continue;
          const match = findBestMatch(crop.gray, variant.image, 0.88);
          if (match) {
            return {
              x: originX + crop.x + match.x + variant.image.width / 2,
              y: originY + crop.y + match.y + variant.image.height / 2,
              mode: variant.mode,
              focus: crop.focus,
            };
          }
        }
      }
    }
    return null;
  }
}

/** Extract a rectangular sub-region of a grayscale image. */
function cropGrayRegion(src: GrayImage, x: number, y: number, w: number, h: number): GrayImage {
  const data = new Float32Array(w * h);
  for (let row = 0; row < h; row++) {
    const srcOff = (y + row) * src.width + x;
    data.set(src.data.subarray(srcOff, srcOff + w), row * w);
  }
  return { width: w, height: h, data };
}

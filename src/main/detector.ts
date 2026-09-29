/**
 * Detection engine: finds the Cursor IDE window and locates the
 * Run / Always Run button inside it by image matching.
 *
 * Strategy:
 *  1. Look up the Cursor window via the OS window list (works on any
 *     monitor — regions are absolute virtual-desktop coordinates).
 *  2. Restrict the image search to that window's region for speed and
 *     accuracy; fall back to the primary display when no window is found.
 *  3. Template-match against dark/light reference images at multiple
 *     scales (pre-resized with jimp) to absorb per-display DPI scaling.
 */
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import {
  screen as nutScreen,
  getWindows,
  imageResource,
  Region,
} from '@nut-tree-fork/nut-js';
import type { Image } from '@nut-tree-fork/shared';
import type { ClickMode } from '../shared/types';

type Img = Image;

const SCALES = [1.0, 0.8, 1.25, 1.5];

interface TemplateVariant {
  mode: ClickMode;
  theme: 'dark' | 'light';
  scale: number;
  image: Promise<Img> | null;
  file: string;
}

export class Detector {
  private variants: TemplateVariant[] = [];
  private loadAttempted = false;
  windowFound = false;

  private templatesDir(): string {
    const base = app.isPackaged ? process.resourcesPath : app.getAppPath();
    return path.join(base, 'assets', 'templates');
  }

  private scaledFile(source: string, scale: number): string {
    const dir = path.join(os.tmpdir(), 'cursor-auto-runner-templates');
    fs.mkdirSync(dir, { recursive: true });
    const name = `${path.basename(source, '.png')}@${scale}.png`;
    return path.join(dir, name);
  }

  /** Lazily build the template variant list (files only; images load on first use). */
  private async prepareVariants(): Promise<TemplateVariant[]> {
    if (this.loadAttempted) return this.variants;
    this.loadAttempted = true;
    const dir = this.templatesDir();
    const Jimp = (await import('jimp')).default;

    for (const theme of ['dark', 'light'] as const) {
      for (const mode of ['always-run', 'run'] as const) {
        const file = path.join(dir, theme, `${mode}.png`);
        if (!fs.existsSync(file)) continue;
        for (const scale of SCALES) {
          let target = file;
          if (scale !== 1.0) {
            target = this.scaledFile(file, scale);
            if (!fs.existsSync(target)) {
              try {
                const img = await Jimp.read(file);
                img.resize(Math.max(4, Math.round(img.getWidth() * scale)), Jimp.AUTO);
                await img.writeAsync(target);
              } catch (err) {
                console.error(`[detector] failed to scale template ${file}:`, err);
                continue;
              }
            }
          }
          this.variants.push({
            mode,
            theme,
            scale,
            file: target,
            image: null, // loaded lazily
          });
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

  /** Find the Cursor window region (absolute coordinates, any monitor). */
  private async findCursorWindow(): Promise<{ region: Region; focus: () => Promise<boolean> } | null> {
    try {
      const windows = await getWindows();
      for (const win of windows) {
        const title = ((await win.title) || '').toLowerCase();
        if (title.includes('cursor') && !title.includes('auto runner')) {
          const region = await win.region;
          if (region && region.width > 50 && region.height > 50) {
            return { region, focus: () => win.focus() };
          }
        }
      }
    } catch (err) {
      console.error('[detector] window enumeration failed:', err);
    }
    return null;
  }

  private async primaryRegion(): Promise<Region> {
    const w = await nutScreen.width();
    const h = await nutScreen.height();
    return new Region(0, 0, w, h);
  }

  /**
   * Search for the button for the requested mode.
   * `always-run` prefers the "Always Run" template and falls back to "Run".
   * Returns the click point plus a best-effort focus callback for the window.
   */
  async detect(mode: ClickMode): Promise<{ x: number; y: number; mode: ClickMode; focus: () => Promise<boolean> } | null> {
    const variants = await this.prepareVariants();
    if (variants.length === 0) return null;

    const cursorWindow = await this.findCursorWindow();
    this.windowFound = cursorWindow !== null;
    const searchRegion = cursorWindow?.region ?? (await this.primaryRegion());
    const focus = cursorWindow?.focus ?? (async () => false);

    const preferred: ClickMode[] = mode === 'always-run' ? ['always-run', 'run'] : ['run'];
    const rank = (v: TemplateVariant) => preferred.indexOf(v.mode) * 10 + (v.theme === 'dark' ? 0 : 5) + SCALES.indexOf(v.scale);
    const ordered = variants.slice().sort((a, b) => rank(a) - rank(b));

    for (const variant of ordered) {
      if (!variant.image) variant.image = imageResource(variant.file);
      const point = await this.findTemplate(variant.image, searchRegion);
      if (point) {
        return { x: point.x, y: point.y, mode: variant.mode, focus };
      }
    }
    return null;
  }

  /** Single template search with a hard timeout so a stuck match can't block the poll loop. */
  private async findTemplate(image: Promise<Img>, region: Region): Promise<{ x: number; y: number } | null> {
    try {
      const find = nutScreen.find(image, {
        searchRegion: region,
        confidence: 0.88,
      });
      const match = await Promise.race([
        find,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);
      if (!match) return null;
      // find() returns the match's top-left region -> aim for its center.
      return { x: match.left + match.width / 2, y: match.top + match.height / 2 };
    } catch {
      // NotFoundException and friends -> not on screen
      return null;
    }
  }
}

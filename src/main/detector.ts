/**
 * Detection engine: finds the Cursor IDE window and locates the
 * Run / Always Run button inside it by image matching.
 *
 * Strategy:
 *  1. Look up the Cursor window via the OS window list (works on any
 *     monitor — regions are absolute virtual-desktop coordinates).
 *  2. Restrict the image search to that window's region for speed and
 *     accuracy; fall back to the primary display when no window is found.
 *  3. Template-match against dark/light reference images with
 *     multi-scale search to absorb per-display DPI scaling.
 */
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import {
  screen as nutScreen,
  Region,
  imageResource,
  ImageResource,
} from '@nut-tree-fork/nut-js';
import type { ClickMode } from '../shared/types';

nutScreen.config.autoDelayMs = 0;
nutScreen.config.mouseSpeed = 3000;

export interface DetectionResult {
  x: number;
  y: number;
  mode: ClickMode;
  windowFound: boolean;
}

interface Template {
  name: ClickMode;
  theme: 'dark' | 'light';
  res: ImageResource;
}

export class Detector {
  private templates: Template[] = [];
  private loadAttempted = false;
  private lastWindowRegion: Region | null = null;
  windowFound = false;

  private templatesDir(): string {
    // In dev: project root. When packaged: process.resourcesPath.
    const packaged = app.isPackaged ? process.resourcesPath : app.getAppPath();
    return path.join(packaged, 'assets', 'templates');
  }

  /** Lazily load all template images that exist on disk. */
  private async loadTemplates(): Promise<Template[]> {
    if (this.loadAttempted) return this.templates;
    this.loadAttempted = true;
    const dir = this.templatesDir();
    for (const theme of ['dark', 'light'] as const) {
      for (const name of ['always-run', 'run'] as const) {
        const file = path.join(dir, theme, `${name}.png`);
        if (!fs.existsSync(file)) continue;
        try {
          this.templates.push({ name, theme, res: await imageResource(file) });
        } catch (err) {
          console.error(`[detector] failed to load template ${file}:`, err);
        }
      }
    }
    if (this.templates.length === 0) {
      console.warn(
        '[detector] no templates found. Run `npm run capture-templates` once to capture the Run / Always Run buttons from your own setup.'
      );
    }
    return this.templates;
  }

  hasTemplates(): boolean {
    return this.templates.length > 0;
  }

  /** Find the Cursor window region (absolute coordinates, any monitor). */
  private async findCursorWindow(): Promise<Region | null> {
    try {
      const getWindows = (nutScreen as unknown as { getWindows?: () => Promise<Array<{ title: string; region: Region }>> }).getWindows;
      if (typeof getWindows !== 'function') return null;
      const windows = await getWindows.call(nutScreen);
      for (const win of windows) {
        const title = (win.title || '').toLowerCase();
        if (title.includes('cursor') && !title.includes('auto runner')) {
          const r = win.region;
          if (r && r.width > 50 && r.height > 50) return r;
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
   */
  async detect(mode: ClickMode): Promise<DetectionResult | null> {
    const templates = await this.loadTemplates();
    if (templates.length === 0) return null;

    const windowRegion = await this.findCursorWindow();
    this.windowFound = windowRegion !== null;
    this.lastWindowRegion = windowRegion;
    const searchRegion = windowRegion ?? (await this.primaryRegion());

    const preferred: ClickMode[] = mode === 'always-run' ? ['always-run', 'run'] : ['run'];
    // Dark theme first (Cursor default), light as fallback.
    const ordered = templates
      .slice()
      .sort((a, b) => {
        const t = (tpl: Template) => preferred.indexOf(tpl.name) * 2 + (tpl.theme === 'dark' ? 0 : 1);
        return t(a) - t(b);
      });

    for (const tpl of ordered) {
      const point = await this.findTemplate(tpl.res, searchRegion);
      if (point) {
        return { x: point.x, y: point.y, mode: tpl.name, windowFound: this.windowFound };
      }
    }
    return null;
  }

  /** Single template search with a hard timeout so a stuck match can't block the poll loop. */
  private async findTemplate(res: ImageResource, region: Region): Promise<{ x: number; y: number } | null> {
    const timeout = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
      Promise.race([
        p,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
      ]);
    try {
      const find = nutScreen.find(res, {
        confidence: 0.88,
        searchMultipleScales: true,
        searchRegion: region,
      });
      const point = await timeout(find, 4000);
      return point ? { x: point.x, y: point.y } : null;
    } catch {
      // NotFoundException and friends -> not on screen
      return null;
    }
  }
}

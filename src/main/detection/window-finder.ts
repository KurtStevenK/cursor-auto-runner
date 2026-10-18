/** Enumerates watched (Cursor-like) windows. Electron is injected, not imported. */
import { listOwnedWindows, ownerForWindow } from '../owned-windows';
import { normalizeWindowRegionForDisplay } from '../capture-geometry';
import { selectWatchWindows, watchKindForWindow } from '../watch-windows';
import type { DisplayInfo, WindowInfo } from './types';

export interface WindowProvider {
  /** `forceOwners` bypasses the owner-lookup cache (used on an empty first pass). */
  list(forceOwners?: boolean): Promise<WindowInfo[]>;
}

export function dedupeWindows(windows: WindowInfo[]): WindowInfo[] {
  const unique: WindowInfo[] = [];
  for (const window of windows) {
    const duplicate = unique.some(
      (other) =>
        other.title === window.title &&
        Math.abs(other.left - window.left) < 20 &&
        Math.abs(other.top - window.top) < 20
    );
    if (!duplicate) unique.push(window);
  }
  return unique;
}

export function windowRank(window: WindowInfo): number {
  const title = window.title.toLowerCase();
  if (title.includes('auto runner')) return -1_000_000;
  return window.width * window.height;
}

export interface NutWindowProviderDeps {
  displayNearestPoint: (point: { x: number; y: number }) => DisplayInfo;
  allDisplays: () => DisplayInfo[];
  /** The in-app button test window, when open. */
  testWindow?: () => WindowInfo | null;
}

export class NutWindowProvider implements WindowProvider {
  constructor(private readonly deps: NutWindowProviderDeps) {}

  async list(forceOwners = false): Promise<WindowInfo[]> {
    const found: WindowInfo[] = [];
    const testWindow = (): WindowInfo | null => this.deps.testWindow?.() ?? null;
    let enumerated = false;
    try {
      const { getWindows } = require('@nut-tree-fork/nut-js') as typeof import('@nut-tree-fork/nut-js');
      const owned = await listOwnedWindows(forceOwners);
      const ownedTitles = new Set(owned.map((window) => window.title));
      const windows = await getWindows();
      const candidates = await Promise.all(
        windows.map(async (win) => {
          const rawTitle = (await win.title) || '';
          const mightWatch =
            ownedTitles.has(rawTitle) || watchKindForWindow({ title: rawTitle }) !== null;
          if (!mightWatch) return null;
          const region = await win.region;
          if (!region || region.width <= 50 || region.height <= 50) return null;
          const display = this.deps.displayNearestPoint({
            x: region.left + region.width / 2,
            y: region.top + region.height / 2,
          });
          const normalized = normalizeWindowRegionForDisplay(region, display);
          const info: WindowInfo = {
            left: normalized.left,
            top: normalized.top,
            width: normalized.width,
            height: normalized.height,
            title: rawTitle,
            focus: () => win.focus(),
          };
          info.owner = ownerForWindow(info, owned);
          if (!watchKindForWindow(info)) return null;
          return info;
        })
      );
      const visible = candidates.filter((candidate): candidate is WindowInfo => candidate !== null);
      const extra = testWindow();
      if (extra) visible.push(extra);
      const bounds = this.deps.allDisplays().map((display) => display.bounds);
      found.push(...dedupeWindows(selectWatchWindows(visible, bounds)));
      enumerated = true;
    } catch (error) {
      console.error('[detector] window enumeration failed:', error);
    }
    if (!enumerated) {
      const extra = testWindow();
      if (extra) found.push(extra);
    }
    return found;
  }
}

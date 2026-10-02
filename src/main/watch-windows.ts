/** Which on-screen app the runner should search for Run / Allow buttons. */
export type WatchKind = 'cursor' | 'rustdesk';

export interface WindowRect {
  left: number;
  top: number;
  width: number;
  height: number;
  title: string;
}

export interface DisplayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A RustDesk session that covers this much of a display hides local Cursor behind it. */
export const RUSTDESK_COVER_FRACTION = 0.8;

/**
 * Cursor IDE titles contain "cursor". RustDesk session titles are "RustDesk"
 * or "<peer> - RustDesk". The runner's own windows are never watched.
 */
export function watchKindForTitle(title: string): WatchKind | null {
  const lower = title.toLowerCase();
  if (lower.includes('auto runner') || lower.includes('cursor-auto-runner')) return null;
  if (lower.includes('rustdesk')) return 'rustdesk';
  if (lower.includes('cursor')) return 'cursor';
  return null;
}

function intersectionArea(window: WindowRect, display: DisplayRect): number {
  const left = Math.max(window.left, display.x);
  const top = Math.max(window.top, display.y);
  const right = Math.min(window.left + window.width, display.x + display.width);
  const bottom = Math.min(window.top + window.height, display.y + display.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

/**
 * Keep RustDesk and Cursor windows. When a RustDesk window covers a display,
 * drop Cursor windows centered on that display so a click cannot raise the
 * local IDE in front of the remote session.
 */
export function selectWatchWindows<T extends WindowRect>(windows: T[], displays: DisplayRect[]): T[] {
  const eligible = windows.filter((window) => watchKindForTitle(window.title) !== null);
  const covered = displays.filter((display) => {
    const area = display.width * display.height;
    if (area <= 0) return false;
    return eligible.some((window) => {
      if (watchKindForTitle(window.title) !== 'rustdesk') return false;
      return intersectionArea(window, display) / area >= RUSTDESK_COVER_FRACTION;
    });
  });
  return eligible.filter((window) => {
    if (watchKindForTitle(window.title) !== 'cursor') return true;
    const centerX = window.left + window.width / 2;
    const centerY = window.top + window.height / 2;
    return !covered.some(
      (display) =>
        centerX >= display.x &&
        centerX < display.x + display.width &&
        centerY >= display.y &&
        centerY < display.y + display.height
    );
  });
}

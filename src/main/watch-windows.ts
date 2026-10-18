/** Which on-screen app the runner should search for Run / Allow buttons. */
export type WatchKind = 'cursor' | 'rustdesk';

/** Tray test window. Its pixels are the button templates, not a Cursor document. */
export const BUTTON_TEST_TITLE = 'Button test';

export interface WindowRect {
  left: number;
  top: number;
  width: number;
  height: number;
  title: string;
  /** Owning app, when the OS reports it. macOS window titles are the document name. */
  owner?: string | null;
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
 * Cursor IDE titles contain "cursor" on Windows ("file - folder - Cursor").
 * On macOS the title is the document ("file — FeatherShot"), so the owning
 * app name is what identifies Cursor. RustDesk session titles are "RustDesk"
 * or "<peer> - RustDesk". The runner's own windows use "Cursor Auto Runner".
 */
export function watchKindForTitle(title: string): WatchKind | null {
  return watchKindForWindow({ title });
}

export function watchKindForWindow(window: {
  title: string;
  owner?: string | null;
}): WatchKind | null {
  const title = window.title.toLowerCase();
  const owner = (window.owner || '').trim().toLowerCase();
  if (title === BUTTON_TEST_TITLE.toLowerCase()) return 'cursor';
  if (title.includes('auto runner') || owner === 'cursor auto runner') return null;
  if (owner === 'cursor') return 'cursor';
  if (owner === 'rustdesk' || title.includes('rustdesk')) return 'rustdesk';
  if (title.includes('cursor')) return 'cursor';
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
export function selectWatchWindows<T extends WindowRect>(
  windows: T[],
  displays: DisplayRect[]
): T[] {
  const eligible = windows.filter((window) => watchKindForWindow(window) !== null);
  const covered = displays.filter((display) => {
    const area = display.width * display.height;
    if (area <= 0) return false;
    return eligible.some((window) => {
      if (watchKindForWindow(window) !== 'rustdesk') return false;
      return intersectionArea(window, display) / area >= RUSTDESK_COVER_FRACTION;
    });
  });
  return eligible.filter((window) => {
    if (watchKindForWindow(window) !== 'cursor') return true;
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

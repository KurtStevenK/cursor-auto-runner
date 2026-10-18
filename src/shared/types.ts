/** Shared types and IPC channel names for Cursor Auto Runner. */

export type Mode = 'idle' | 'run' | 'always-run';
export type ClickMode = 'run' | 'always-run' | 'allow';

export interface DayCount {
  date: string; // YYYY-MM-DD
  count: number;
}

export type WatchKind = 'cursor' | 'rustdesk';

export interface StatsSnapshot {
  session: number;
  day: number;
  week: number;
  month: number;
  total: number;
  byDay: DayCount[]; // last 7 days, oldest first
  mode: Mode;
  since: string; // session start ISO timestamp
  windowFound: boolean; // was a Cursor or RustDesk window detected on the last poll?
  watchedKind: WatchKind | null;
  pollIntervalMs: number; // current detection refresh interval (user setting)
  effectivePollIntervalMs: number; // interval actually used right now (adaptive)
}

export interface DetectionState {
  windowFound: boolean;
  watchedKind: WatchKind | null;
}

export interface Settings {
  pollIntervalMs: number;
  confidence: number;
  cooldownMs: number;
  restoreLastMode: boolean;
  lastMode: Mode;
  /** macOS Homebrew cask: install a newer GitHub Release in the background. */
  installUpdatesWithHomebrew: boolean;
  /** Start the app when the user logs in. */
  launchAtLogin: boolean;
  /** Electron accelerator for the global start/stop shortcut; '' = disabled. */
  toggleShortcut: string;
  /** Bring the Cursor window to the front before each click. */
  focusCursorBeforeClick: boolean;
  /** Skip clicks while the user is actively using the mouse or keyboard. */
  pauseWhileTyping: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  pollIntervalMs: 4000,
  confidence: 0.88,
  cooldownMs: 2000,
  restoreLastMode: false,
  lastMode: 'idle',
  installUpdatesWithHomebrew: true,
  launchAtLogin: false,
  toggleShortcut: '',
  focusCursorBeforeClick: true,
  pauseWhileTyping: true,
};

/** Accelerators offered in the tray menu ('' = off). Anything else is rejected. */
export const SHORTCUT_CHOICES = [
  '',
  'CommandOrControl+Alt+R',
  'CommandOrControl+Shift+R',
  'CommandOrControl+Alt+Shift+R',
] as const;

/**
 * Mode the global shortcut switches to: idle -> the last non-idle mode
 * (default 'run'), any running mode -> idle.
 */
export function nextToggleMode(current: Mode, lastActive: Mode): Mode {
  if (current !== 'idle') return 'idle';
  return lastActive === 'idle' ? 'run' : lastActive;
}

export const IPC = {
  SET_MODE: 'set-mode',
  MODE_CHANGED: 'mode-changed',
  GET_STATS: 'get-stats',
  STATS_UPDATED: 'stats-updated',
  DETECTION_STATE: 'detection-state',
  CLOSE_OVERLAY: 'close-overlay',
  SET_POLL_INTERVAL: 'set-poll-interval',
} as const;

/** Adjustable detection refresh interval, ms. Faster = checks more often. */
export const POLL_LADDER_MS = [150, 300, 500, 700, 1000, 1500, 2500, 4000, 6000];

/** Next ladder value in the given direction, or null at the ends. */
export function stepPoll(current: number, dir: -1 | 1): number | null {
  const idx = POLL_LADDER_MS.indexOf(current);
  if (idx !== -1) return POLL_LADDER_MS[idx + dir] ?? null;
  const candidates = POLL_LADDER_MS.filter((v) => (dir === -1 ? v < current : v > current));
  return candidates.length ? (dir === -1 ? candidates[candidates.length - 1] : candidates[0]) : null;
}

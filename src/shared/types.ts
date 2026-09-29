/** Shared types and IPC channel names for Cursor Auto Runner. */

export type Mode = 'idle' | 'run' | 'always-run';
export type ClickMode = 'run' | 'always-run' | 'allow';

export interface DayCount {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface StatsSnapshot {
  session: number;
  day: number;
  week: number;
  month: number;
  total: number;
  byDay: DayCount[]; // last 7 days, oldest first
  mode: Mode;
  since: string; // session start ISO timestamp
  windowFound: boolean; // was a Cursor window detected on the last poll?
  pollIntervalMs: number; // current detection refresh interval
}

export interface DetectionState {
  windowFound: boolean;
}

export interface Settings {
  pollIntervalMs: number;
  confidence: number;
  cooldownMs: number;
  restoreLastMode: boolean;
  lastMode: Mode;
}

export const DEFAULT_SETTINGS: Settings = {
  pollIntervalMs: 4000,
  confidence: 0.88,
  cooldownMs: 2000,
  restoreLastMode: false,
  lastMode: 'idle',
};

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

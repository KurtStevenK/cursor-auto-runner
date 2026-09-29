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
}

export interface Settings {
  pollIntervalMs: number;
  confidence: number;
  cooldownMs: number;
  restoreLastMode: boolean;
  lastMode: Mode;
}

export const DEFAULT_SETTINGS: Settings = {
  pollIntervalMs: 700,
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
} as const;

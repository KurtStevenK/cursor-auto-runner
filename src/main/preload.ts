/**
 * Preload: exposes a minimal, safe API surface to the overlay window.
 * IMPORTANT: sandboxed preloads can only require('electron') — no relative
 * imports at runtime. Types are `import type` (erased), and IPC channel
 * names are duplicated here as plain constants.
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { Mode, StatsSnapshot } from '../shared/types';

// Keep in sync with src/shared/types.ts (no runtime import possible).
const IPC = {
  SET_MODE: 'set-mode',
  MODE_CHANGED: 'mode-changed',
  GET_STATS: 'get-stats',
  STATS_UPDATED: 'stats-updated',
  CLOSE_OVERLAY: 'close-overlay',
} as const;

contextBridge.exposeInMainWorld('autoRunner', {
  getStats: (): Promise<StatsSnapshot> => ipcRenderer.invoke(IPC.GET_STATS),
  setMode: (mode: Mode): void => ipcRenderer.send(IPC.SET_MODE, mode),
  close: (): void => ipcRenderer.send(IPC.CLOSE_OVERLAY),
  onStats: (cb: (snap: StatsSnapshot) => void): void => {
    ipcRenderer.on(IPC.STATS_UPDATED, (_e, snap: StatsSnapshot) => cb(snap));
  },
  onModeChanged: (cb: (mode: Mode) => void): void => {
    ipcRenderer.on(IPC.MODE_CHANGED, (_e, mode: Mode) => cb(mode));
  },
});

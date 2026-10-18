/**
 * Preload: exposes a minimal, safe API surface to the overlay window.
 * Sandboxed preloads can only require('electron'), so scripts/bundle-renderer.js
 * bundles this file (and its src/shared imports) into a single CommonJS file.
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { AutoRunnerBridge } from '../shared/bridge';
import { type DetectionState, IPC, type Mode, type StatsSnapshot } from '../shared/types';

const bridge: AutoRunnerBridge = {
  getStats: (): Promise<StatsSnapshot> => ipcRenderer.invoke(IPC.GET_STATS),
  setMode: (mode: Mode): void => ipcRenderer.send(IPC.SET_MODE, mode),
  close: (): void => ipcRenderer.send(IPC.CLOSE_OVERLAY),
  captureTemplate: (): void => ipcRenderer.send(IPC.CAPTURE_TEMPLATE),
  setPollInterval: (ms: number): void => ipcRenderer.send(IPC.SET_POLL_INTERVAL, ms),
  onStats: (cb: (snap: StatsSnapshot) => void): void => {
    ipcRenderer.on(IPC.STATS_UPDATED, (_e, snap: StatsSnapshot) => cb(snap));
  },
  onModeChanged: (cb: (mode: Mode) => void): void => {
    ipcRenderer.on(IPC.MODE_CHANGED, (_e, mode: Mode) => cb(mode));
  },
  onDetectionState: (cb: (state: DetectionState) => void): void => {
    ipcRenderer.on(IPC.DETECTION_STATE, (_e, state: DetectionState) => cb(state));
  },
};

contextBridge.exposeInMainWorld('autoRunner', bridge);

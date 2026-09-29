/** Preload: exposes a minimal, safe API surface to the overlay window. */
import { contextBridge, ipcRenderer } from 'electron';
import { IPC, Mode, StatsSnapshot } from '../shared/types';

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

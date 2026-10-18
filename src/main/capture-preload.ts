/**
 * Preload for the template-capture overlay window (sandboxed, context-isolated).
 * Sandboxed preloads can only require('electron'), so the IPC channel names
 * are duplicated here as plain constants — keep in sync with capture.ts.
 */
import { contextBridge, ipcRenderer } from 'electron';

const CH = {
  REGION: 'capture-region',
  CANCEL: 'capture-cancel',
  SAVED: 'capture-saved',
  REJECTED: 'capture-rejected',
} as const;

contextBridge.exposeInMainWorld('capture', {
  sendRegion: (r: { x: number; y: number; w: number; h: number }): void =>
    ipcRenderer.send(CH.REGION, { x: r.x, y: r.y, w: r.w, h: r.h }),
  cancel: (): void => ipcRenderer.send(CH.CANCEL),
  onSaved: (cb: (file: string) => void): void => {
    ipcRenderer.on(CH.SAVED, (_e, file: string) => cb(String(file)));
  },
  onRejected: (cb: (reason: string) => void): void => {
    ipcRenderer.on(CH.REJECTED, (_e, reason: string) => cb(String(reason)));
  },
});

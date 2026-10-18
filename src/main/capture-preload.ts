/**
 * Preload for the template-capture overlay window (sandboxed, context-isolated).
 * Bundled to a single CommonJS file by scripts/bundle-renderer.js, so the
 * shared IPC channel names can be imported like anywhere else.
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { CaptureBridge } from '../shared/bridge';
import { CAPTURE_IPC } from '../shared/types';

const bridge: CaptureBridge = {
  sendRegion: (r: { x: number; y: number; w: number; h: number }): void =>
    ipcRenderer.send(CAPTURE_IPC.REGION, { x: r.x, y: r.y, w: r.w, h: r.h }),
  cancel: (): void => ipcRenderer.send(CAPTURE_IPC.CANCEL),
  onSaved: (cb: (file: string) => void): void => {
    ipcRenderer.on(CAPTURE_IPC.SAVED, (_e, file: string) => cb(String(file)));
  },
  onRejected: (cb: (reason: string) => void): void => {
    ipcRenderer.on(CAPTURE_IPC.REJECTED, (_e, reason: string) => cb(String(reason)));
  },
};

contextBridge.exposeInMainWorld('capture', bridge);

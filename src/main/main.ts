/**
 * Cursor Auto Runner — main process entry point.
 * Wires tray, mode controller, detector, stats store and overlay window.
 */
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { Detector } from './detector';
import { ModeController } from './controller';
import { StatsStore } from './stats';
import { SettingsStore } from './settings';
import { TrayUI } from './tray';
import { ensureMacPermissions } from './permissions';
import { IPC, Mode, StatsSnapshot } from '../shared/types';

// Ensure a clean tray/app identity on Windows
app.setAppUserModelId('com.gf-elektro.cursor-auto-runner');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let detector: Detector;
let stats: StatsStore;
let settings: SettingsStore;
let controller: ModeController;
let tray: TrayUI;
let overlay: BrowserWindow | null = null;

function sendStats(): void {
  if (!overlay) return;
  const snap: StatsSnapshot = stats.snapshot(controller.current);
  snap.windowFound = detector.windowFound;
  overlay.webContents.send(IPC.STATS_UPDATED, snap);
}

function openOverlay(): void {
  // Toggle: opening while open closes the overlay.
  if (overlay && !overlay.isDestroyed()) {
    overlay.close();
    overlay = null;
    return;
  }
  overlay = new BrowserWindow({
    width: 380,
    height: 560,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: false,
    backgroundColor: '#0b1220',
    title: 'Cursor Auto Runner — Stats',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.loadFile(path.join(__dirname, '..', 'overlay', 'index.html'));
  overlay.once('ready-to-show', () => {
    overlay?.show();
    sendStats();
  });
  overlay.on('closed', () => (overlay = null));
}

function applyMode(mode: Mode): void {
  if (mode !== 'idle') {
    // macOS: verify permissions before starting the automation.
    void ensureMacPermissions().then((ok) => {
      if (!ok) {
        controller.set('idle');
        tray.rebuild();
      }
    });
  }
  controller.set(mode);
  settings.set({ lastMode: mode });
  tray.rebuild();
  sendStats();
}

app.whenReady().then(() => {
  settings = new SettingsStore();
  stats = new StatsStore();
  detector = new Detector();
  controller = new ModeController(
    detector,
    stats,
    {
      pollIntervalMs: settings.get().pollIntervalMs,
      confidence: settings.get().confidence,
      cooldownMs: settings.get().cooldownMs,
    },
    (mode) => tray?.rebuild(),
    () => sendStats()
  );
  tray = new TrayUI({
    getMode: () => controller.current,
    setMode: (mode) => applyMode(mode),
    openOverlay,
  });
  tray.show();

  ipcMain.handle(IPC.GET_STATS, () => {
    const snap = stats.snapshot(controller.current);
    snap.windowFound = detector.windowFound;
    return snap;
  });
  ipcMain.on(IPC.SET_MODE, (_e, mode: Mode) => applyMode(mode));
  ipcMain.on(IPC.CLOSE_OVERLAY, () => overlay?.close());

  // Optionally restore the last used mode on launch.
  const s = settings.get();
  if (s.restoreLastMode && s.lastMode !== 'idle') {
    applyMode(s.lastMode);
  }
});

app.on('second-instance', openOverlay);
app.on('window-all-closed', () => {
  // Keep running in the tray.
});
app.on('before-quit', () => tray?.destroy());

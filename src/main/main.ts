/**
 * Cursor Auto Runner — main process entry point.
 * Wires tray, mode controller, detector, stats store and overlay window.
 */
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import { Detector } from './detector';
import { ModeController } from './controller';
import { StatsStore } from './stats';
import { SettingsStore } from './settings';
import { TrayUI } from './tray';
import { ensureMacPermissions } from './permissions';
import { startCapture, stopCapture, templatesBaseDir } from './capture';
import * as fs from 'fs';
import { IPC, Mode, StatsSnapshot, DEFAULT_SETTINGS } from '../shared/types';

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

function currentSnapshot(): StatsSnapshot {
  const snap = stats.snapshot(controller.current);
  snap.windowFound = detector.windowFound;
  snap.pollIntervalMs = controller.pollIntervalMs;
  return snap;
}

function sendStats(): void {
  if (!overlay) return;
  overlay.webContents.send(IPC.STATS_UPDATED, currentSnapshot());
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
  // Surface renderer errors in the main log — overlay bugs used to be silent.
  overlay.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    if (level >= 3) console.error(`[overlay-renderer] ${sourceId}:${line} ${message}`);
  });
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
    getPollInterval: () => settings.get().pollIntervalMs,
    setPollInterval: (ms) => {
      // Persist and apply live; the loop picks it up on its next cycle.
      settings.set({ pollIntervalMs: ms });
      controller.setPollInterval(ms);
      tray.rebuild();
    },
    capture: (name, theme) => {
      // Pause the auto-clicker while the screen is frozen for capture.
      const prevMode = controller.current;
      controller.set('idle');
      tray.rebuild();
      void startCapture(name, theme, {
        onSaved: () => detector.resetTemplates(),
        onDone: () => {
          // Resume what was running before the capture session.
          if (prevMode !== 'idle') {
            controller.set(prevMode);
            tray.rebuild();
          }
        },
      }).catch((err) => console.error('[capture] failed:', err));
    },
    openTemplatesFolder: () => {
      // The folder where new captures land (userData when packaged).
      const dir = path.join(templatesBaseDir(), 'assets', 'templates');
      fs.mkdirSync(dir, { recursive: true });
      void shell.openPath(dir);
    },
  });
  tray.show();

  ipcMain.handle(IPC.GET_STATS, () => currentSnapshot());
  ipcMain.on(IPC.SET_MODE, (_e, mode: Mode) => applyMode(mode));
  ipcMain.on(IPC.CLOSE_OVERLAY, () => overlay?.close());
  ipcMain.on(IPC.SET_POLL_INTERVAL, (_e, ms: number) => {
    const clamped = Math.max(150, Math.min(60000, Number(ms) || DEFAULT_SETTINGS.pollIntervalMs));
    settings.set({ pollIntervalMs: clamped });
    controller.setPollInterval(clamped);
    tray.rebuild();
    sendStats(); // echo the new value back to the overlay (and tray)
  });

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
app.on('before-quit', () => {
  stopCapture();
  tray?.destroy();
});

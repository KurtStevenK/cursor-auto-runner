/**
 * Cursor Auto Runner — main process entry point.
 * Wires tray, mode controller, detector, stats store and overlay window.
 */
import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  nativeTheme,
  Notification,
  powerMonitor,
  screen,
  shell,
} from 'electron';
import * as path from 'path';
import { Detector } from './detector';
import { ModeController } from './controller';
import { StatsStore } from './stats';
import { SettingsStore, boundsIntersectDisplays } from './settings';
import { TrayUI } from './tray';
import { ensureMacPermissions } from './permissions';
import { setButtonTestListener, showButtonTest } from './button-test';
import { UpdateController } from './updates';
import { startCapture, stopCapture, templatesBaseDir } from './capture';
import * as fs from 'fs';
import {
  IPC,
  type Mode,
  type Settings,
  type StatsSnapshot,
  DEFAULT_SETTINGS,
  nextToggleMode,
  OVERLAY_MIN_WIDTH,
  OVERLAY_MIN_HEIGHT,
  OVERLAY_DEFAULT_WIDTH,
  OVERLAY_DEFAULT_HEIGHT,
} from '../shared/types';
import { isWaylandSession, WAYLAND_NOTICE } from './platform-notes';
import { installFileLogger, logDirectory } from './log';
import { startPerformanceMonitor, stopPerformanceMonitor } from './perf';
import { createQuitGuard } from './quit-guard';

// Ensure a clean tray/app identity on Windows
app.setAppUserModelId('com.kurtstevenk.cursor-auto-runner');

// Packaged GUI apps have no terminal; ignore broken stdout during shutdown.
process.stdout?.on?.('error', () => {});
process.stderr?.on?.('error', () => {});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let detector: Detector;
let stats: StatsStore;
let settings: SettingsStore;
let controller: ModeController;
let tray: TrayUI;
let updates: UpdateController;
let overlay: BrowserWindow | null = null;
let statsTimer: NodeJS.Timeout | null = null;
let lastStatsSentAt = 0;
let lastWindowFound: boolean | null = null;
let lastWatchedKind: string | null = null;
let lastActiveMode: Mode = 'run';
let registeredShortcut = '';
let modeBeforeSleep: Mode | null = null;
let modeStartedAt: number | null = null;
let matcherRetrying = false;
let screenLocked = false;
/** True while the app itself sets idle (power pause, capture, quit): lastMode must not change. */
let suppressModePersist = false;
let errorNotified = false;

function currentSnapshot(): StatsSnapshot {
  const snap = stats.snapshot(controller.current);
  snap.windowFound = detector.windowFound;
  snap.watchedKind = detector.watchedKind;
  snap.pollIntervalMs = controller.pollIntervalMs;
  snap.effectivePollIntervalMs = controller.effectivePollIntervalMs;
  const h = controller.health;
  const now = Date.now();
  const since = Math.max(h.lastMatchAt ?? 0, modeStartedAt ?? 0);
  snap.health = {
    lastMatchAt: h.lastMatchAt,
    lastDetectAt: h.lastDetectAt,
    consecutiveErrors: h.consecutiveErrors,
    lastError: h.lastError,
    templateCount: detector.lastMetrics.templateCount,
    missStreakMinutes:
      controller.current !== 'idle' && since > 0 ? Math.floor((now - since) / 60_000) : null,
  };
  return snap;
}

function flushStats(): void {
  if (!overlay || overlay.isDestroyed()) return;
  lastStatsSentAt = Date.now();
  overlay.webContents.send(IPC.STATS_UPDATED, currentSnapshot());
}

function sendStats(immediate = false): void {
  if (!overlay || overlay.isDestroyed()) return;
  if (immediate || Date.now() - lastStatsSentAt >= 1000) {
    if (statsTimer) clearTimeout(statsTimer);
    statsTimer = null;
    flushStats();
    return;
  }
  if (statsTimer) return;
  statsTimer = setTimeout(
    () => {
      statsTimer = null;
      flushStats();
    },
    Math.max(0, 1000 - (Date.now() - lastStatsSentAt))
  );
}

function sendDetectionState(windowFound: boolean, watchedKind: StatsSnapshot['watchedKind']): void {
  if (windowFound === lastWindowFound && watchedKind === lastWatchedKind) return;
  lastWindowFound = windowFound;
  lastWatchedKind = watchedKind;
  if (!overlay || overlay.isDestroyed()) return;
  overlay.webContents.send(IPC.DETECTION_STATE, { windowFound, watchedKind });
}

function openOverlay(): void {
  // Toggle: opening while open closes the overlay.
  if (overlay && !overlay.isDestroyed()) {
    overlay.close();
    overlay = null;
    return;
  }
  const s = settings.get();
  // Restore the saved position only if it is still on a connected display.
  const saved = s.overlayBounds;
  const restore =
    saved &&
    boundsIntersectDisplays(
      saved,
      screen.getAllDisplays().map((d) => d.workArea)
    )
      ? saved
      : null;
  overlay = new BrowserWindow({
    width: restore?.width ?? OVERLAY_DEFAULT_WIDTH,
    height: restore?.height ?? OVERLAY_DEFAULT_HEIGHT,
    ...(restore ? { x: restore.x, y: restore.y } : { center: true }),
    minWidth: OVERLAY_MIN_WIDTH,
    minHeight: OVERLAY_MIN_HEIGHT,
    show: false,
    frame: false,
    resizable: true,
    alwaysOnTop: s.overlayAlwaysOnTop,
    skipTaskbar: true,
    transparent: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b1220' : '#eef2f7',
    title: 'Cursor Auto Runner — Stats',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (s.overlayAlwaysOnTop) overlay.setAlwaysOnTop(true, 'floating');
  const win = overlay;
  let boundsTimer: NodeJS.Timeout | null = null;
  const saveBounds = (): void => {
    if (win.isDestroyed()) return;
    const b = win.getBounds();
    settings.set({ overlayBounds: b });
  };
  const saveBoundsSoon = (): void => {
    if (boundsTimer) clearTimeout(boundsTimer);
    boundsTimer = setTimeout(saveBounds, 400);
  };
  win.on('resize', saveBoundsSoon);
  win.on('move', saveBoundsSoon);
  win.on('close', () => {
    if (boundsTimer) clearTimeout(boundsTimer);
    saveBounds();
  });
  overlay.loadFile(path.join(__dirname, '..', 'overlay', 'index.html'));
  // Surface renderer errors in the main log — overlay bugs used to be silent.
  overlay.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    if (level >= 3) console.error(`[overlay-renderer] ${sourceId}:${line} ${message}`);
  });
  overlay.once('ready-to-show', () => {
    overlay?.show();
    sendStats(true);
  });
  overlay.on('closed', () => {
    overlay = null;
    lastWindowFound = null;
    if (statsTimer) clearTimeout(statsTimer);
    statsTimer = null;
  });
}

let applyModeSeq = 0;

async function applyMode(mode: Mode): Promise<void> {
  const seq = ++applyModeSeq;
  if (mode !== 'idle') {
    const ok = await ensureMacPermissions();
    // A newer request (e.g. Stop) or a screen lock arrived during the await:
    // do not override it.
    if (seq !== applyModeSeq || screenLocked) return;
    if (!ok) {
      controller.set('idle');
      return;
    }
  }
  controller.set(mode);
}

/** Persist a settings patch and apply its side effects live. */
function applySettings(patch: Partial<Settings>): void {
  settings.set(patch);
  const s = settings.get();
  if (patch.confidence !== undefined) controller.setConfidence(s.confidence);
  if (patch.cooldownMs !== undefined) controller.setCooldown(s.cooldownMs);
  if (patch.focusCursorBeforeClick !== undefined)
    controller.setFocusBeforeClick(s.focusCursorBeforeClick);
  if (patch.pauseWhileTyping !== undefined) controller.setPauseWhileTyping(s.pauseWhileTyping);
  if (patch.launchAtLogin !== undefined) applyLoginItem(s.launchAtLogin);
  if (patch.toggleShortcut !== undefined) registerToggleShortcut(s.toggleShortcut);
  if (patch.overlayAlwaysOnTop !== undefined && overlay && !overlay.isDestroyed()) {
    if (s.overlayAlwaysOnTop) overlay.setAlwaysOnTop(true, 'floating');
    else overlay.setAlwaysOnTop(false);
  }
  tray?.rebuild();
}

/** Controller health changed: refresh the overlay, tray tooltip and (once per streak) notify. */
function onHealthChange(): void {
  const errors = controller.health.consecutiveErrors;
  const retrying = errors > 0;
  if (retrying !== matcherRetrying) {
    matcherRetrying = retrying;
    tray?.rebuild();
  }
  if (errors >= 3 && !errorNotified) {
    errorNotified = true;
    try {
      new Notification({
        title: 'Cursor Auto Runner',
        body: `The matcher keeps failing (${controller.health.lastError ?? 'unknown error'}). It is retrying with backoff; see the log folder for details.`,
      }).show();
    } catch {
      /* notifications are best effort */
    }
  } else if (errors === 0) {
    errorNotified = false;
  }
  sendStats();
}

/** Start the template capture flow (tray menu and overlay button). */
/** Switch to idle without recording it as the user's last mode. */
function setIdleTransient(): void {
  applyModeSeq++; // invalidate any applyMode still awaiting permissions
  suppressModePersist = true;
  try {
    controller.set('idle');
  } finally {
    suppressModePersist = false;
  }
}

/** Welcome dialog (first run, or from Settings → Show welcome…). */
async function showWelcome(): Promise<void> {
  const mac = process.platform === 'darwin';
  const detail =
    'Cursor Auto Runner watches the Cursor IDE and clicks Run, Always Run and Allow for you, so your agent never stalls waiting for approval.\n\n' +
    (mac
      ? 'On macOS it needs two permissions: Screen Recording (to see Cursor) and Accessibility (to click). You will be asked when you first start it.\n\n'
      : '') +
    'How to start: right-click the tray icon and choose Start Auto Run (or Start Auto Always Run). Left-click the tray icon to see your stats.';
  const loginSupported = process.platform !== 'linux';
  const wasLaunchAtLogin = settings.get().launchAtLogin;
  try {
    const { response, checkboxChecked = false } = await dialog.showMessageBox({
      type: 'info',
      title: 'Welcome to Cursor Auto Runner',
      message: 'Welcome to Cursor Auto Runner',
      detail,
      // Two buttons so that dismissing the dialog (Esc / close) is
      // distinguishable from pressing the primary button.
      buttons: ['Got it', 'Close'],
      defaultId: 0,
      cancelId: 1,
      // Login items are a no-op on Linux: do not offer the checkbox there.
      ...(loginSupported
        ? { checkboxLabel: 'Start at login', checkboxChecked: wasLaunchAtLogin }
        : {}),
    });
    const patch: Partial<Settings> = { onboardingShownVersion: app.getVersion() };
    // Only an explicit confirmation changes start-at-login; a dismissed
    // dialog must change nothing.
    if (loginSupported && response === 0) {
      if (checkboxChecked === true) patch.launchAtLogin = true;
      else if (wasLaunchAtLogin) patch.launchAtLogin = false;
    }
    applySettings(patch);
  } catch (err) {
    // Not recorded as shown: the dialog never resolved normally.
    console.error('[welcome] dialog failed:', err);
  }
}

let activeCaptures = 0;
let captureResumeMode: Mode = 'idle';

function startTemplateCapture(name: 'run' | 'always-run' | 'allow', theme: 'dark' | 'light'): void {
  // Pause the auto-clicker while the screen is frozen for capture.
  // A second capture may start while one is open: remember the mode from
  // before the FIRST one and resume only when the last session is done.
  if (activeCaptures === 0) captureResumeMode = controller.current;
  activeCaptures++;
  setIdleTransient();
  void startCapture(name, theme, {
    onSaved: () => detector.resetTemplates(),
    onDone: () => {
      activeCaptures = Math.max(0, activeCaptures - 1);
      if (activeCaptures > 0) return;
      const prevMode = captureResumeMode;
      captureResumeMode = 'idle';
      // Resume what was running before the capture session.
      if (prevMode !== 'idle') {
        void applyMode(prevMode);
      }
    },
  }).catch((err) => console.error('[capture] failed:', err));
}

function registerToggleShortcut(accelerator: string): void {
  if (registeredShortcut) {
    globalShortcut.unregister(registeredShortcut);
    registeredShortcut = '';
  }
  if (!accelerator) return;
  let ok = false;
  try {
    ok = globalShortcut.register(accelerator, () => {
      void applyMode(nextToggleMode(controller.current, lastActiveMode));
    });
  } catch (err) {
    console.error('[shortcut] register threw:', err);
  }
  if (ok) {
    registeredShortcut = accelerator;
    return;
  }
  console.error(`[shortcut] could not register ${accelerator} (already in use?)`);
  // Revert so the menu does not stay checked and we do not retry (and
  // notify again) on every launch.
  settings.set({ toggleShortcut: '' });
  tray?.rebuild();
  try {
    new Notification({
      title: 'Cursor Auto Runner',
      body: `The shortcut ${accelerator} could not be registered; another app may be using it.`,
    }).show();
  } catch {
    /* notifications are best effort */
  }
}

function applyLoginItem(openAtLogin: boolean): void {
  if (process.platform === 'linux') return; // no-op there
  try {
    app.setLoginItemSettings({ openAtLogin });
  } catch (err) {
    console.error('[settings] setLoginItemSettings failed:', err);
  }
}

app.whenReady().then(() => {
  installFileLogger(app.getPath('logs'));
  console.log(
    `Cursor Auto Runner ${app.getVersion()} starting (${process.platform}, Electron ${process.versions.electron})`
  );
  startPerformanceMonitor();
  settings = new SettingsStore(undefined, app.getVersion());
  stats = new StatsStore();
  detector = new Detector();
  controller = new ModeController(
    detector,
    stats,
    {
      pollIntervalMs: settings.get().pollIntervalMs,
      confidence: settings.get().confidence,
      cooldownMs: settings.get().cooldownMs,
      focusBeforeClick: settings.get().focusCursorBeforeClick,
      pauseWhileTyping: settings.get().pauseWhileTyping,
    },
    (mode) => {
      if (mode !== 'idle') lastActiveMode = mode;
      modeStartedAt = mode === 'idle' ? null : Date.now();
      if (!suppressModePersist) settings.set({ lastMode: mode });
      tray?.rebuild();
      sendStats(true);
    },
    (windowFound, watchedKind) => sendDetectionState(windowFound, watchedKind),
    () => sendStats(),
    onHealthChange
  );
  tray = new TrayUI({
    getMode: () => controller.current,
    setMode: (mode) => {
      void applyMode(mode);
    },
    openOverlay,
    getPollInterval: () => settings.get().pollIntervalMs,
    setPollInterval: (ms) => {
      // Persist and apply live; the loop picks it up on its next cycle.
      settings.set({ pollIntervalMs: ms });
      controller.setPollInterval(ms);
      tray.rebuild();
      sendStats(true);
    },
    getSettings: () => settings.get(),
    updateSettings: (patch) => applySettings(patch),
    capture: (name, theme) => startTemplateCapture(name, theme),
    isMatcherRetrying: () => matcherRetrying,
    showWelcome: () => void showWelcome(),
    showButtonTest: () => showButtonTest(),
    checkForUpdates: () => updates.checkFromMenu(),
    updateMenu: () => updates.menuState(),
    setHomebrewInstall: (value) => updates.setAutoInstall(value),
    openLogFolder: () => {
      void shell.openPath(logDirectory());
    },
    openTemplatesFolder: () => {
      // The folder where new captures land (userData when packaged).
      const dir = path.join(templatesBaseDir(), 'assets', 'templates');
      fs.mkdirSync(dir, { recursive: true });
      void shell.openPath(dir);
    },
  });
  setButtonTestListener(() => detector.invalidateWindowCache());
  updates = new UpdateController({
    getAutoCheck: () => settings.get().autoCheckUpdates,
    getAutoInstall: () => settings.get().installUpdatesWithHomebrew,
    setAutoInstall: (value) => settings.set({ installUpdatesWithHomebrew: value }),
    onChange: () => tray?.rebuild(),
  });
  tray.show();
  updates.start();

  ipcMain.handle(IPC.GET_STATS, () => currentSnapshot());
  ipcMain.on(IPC.SET_MODE, (_e, mode: unknown) => {
    // The renderer is untrusted: only known Mode values may reach applyMode.
    if (mode !== 'idle' && mode !== 'run' && mode !== 'always-run') {
      console.warn('[ipc] ignored invalid SET_MODE payload:', mode);
      return;
    }
    void applyMode(mode);
  });
  ipcMain.on(IPC.CAPTURE_TEMPLATE, () =>
    startTemplateCapture('run', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  );
  ipcMain.on(IPC.CLOSE_OVERLAY, () => overlay?.close());
  ipcMain.on(IPC.SET_POLL_INTERVAL, (_e, ms: number) => {
    const clamped = Math.max(150, Math.min(60000, Number(ms) || DEFAULT_SETTINGS.pollIntervalMs));
    settings.set({ pollIntervalMs: clamped });
    controller.setPollInterval(clamped);
    tray.rebuild();
    sendStats(true); // echo the new value back to the overlay (and tray)
  });

  // Reconcile the OS login item with the stored setting (the user may have
  // changed it in system settings; the stored value wins only if it differs).
  const s = settings.get();
  if (process.platform !== 'linux') {
    try {
      if (app.getLoginItemSettings().openAtLogin !== s.launchAtLogin)
        applyLoginItem(s.launchAtLogin);
    } catch (err) {
      console.error('[settings] getLoginItemSettings failed:', err);
    }
  }

  registerToggleShortcut(s.toggleShortcut);

  // Pause while the screen is locked or the machine sleeps; resume afterwards.
  const pauseForPower = (): void => {
    if (modeBeforeSleep === null && controller.current !== 'idle') {
      modeBeforeSleep = controller.current;
      setIdleTransient();
    }
  };
  const resumeFromPower = (): void => {
    if (screenLocked) return; // stay paused until the screen is unlocked
    const mode = modeBeforeSleep;
    modeBeforeSleep = null;
    if (mode) void applyMode(mode);
  };
  powerMonitor.on('lock-screen', () => {
    screenLocked = true;
    pauseForPower();
  });
  powerMonitor.on('suspend', pauseForPower);
  powerMonitor.on('unlock-screen', () => {
    screenLocked = false;
    resumeFromPower();
  });
  powerMonitor.on('resume', resumeFromPower);
  powerMonitor.on('shutdown', () => stats?.dispose());

  // Optionally restore the last used mode on launch.
  if (s.restoreLastMode && s.lastMode !== 'idle') {
    void applyMode(s.lastMode);
  }

  // Linux/Wayland: synthetic clicks and capture may be restricted; tell the user once.
  if (process.platform === 'linux' && isWaylandSession()) {
    console.warn(`[platform] ${WAYLAND_NOTICE}`);
    if (!s.waylandNoticeShown) {
      try {
        new Notification({ title: 'Cursor Auto Runner', body: WAYLAND_NOTICE }).show();
      } catch {
        /* notifications are best effort */
      }
      settings.set({ waylandNoticeShown: true });
    }
  }

  // First run: short welcome (never shown again; reopen from Settings).
  if (s.onboardingShownVersion === '') void showWelcome();
});

app.on('second-instance', openOverlay);
app.on('window-all-closed', () => {
  // Keep running in the tray.
});
// Guarded so a re-entrant before-quit (from app.quit(), including quitAndInstall) never re-runs cleanup.
app.on(
  'before-quit',
  createQuitGuard(
    async () => {
      globalShortcut.unregisterAll();
      if (statsTimer) clearTimeout(statsTimer);
      statsTimer = null;
      stopPerformanceMonitor();
      stopCapture();
      if (controller) {
        suppressModePersist = true; // keep lastMode so "restore last mode" works after quit
        controller.set('idle');
      }
      stats?.dispose();
      tray?.destroy();
      await detector?.dispose();
    },
    () => app.quit()
  )
);

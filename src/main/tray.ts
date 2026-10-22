/**
 * System tray: icon reflects the current state, menu offers
 * Start Auto Run / Start Auto Always Run / Stop / Stats / Quit.
 */
import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  Tray,
  type MenuItemConstructorOptions,
} from 'electron';
import * as path from 'path';
import { type Mode, IPC, type Settings, SHORTCUT_CHOICES, stepPoll } from '../shared/types';

export type TrayCallbacks = {
  getMode: () => Mode;
  setMode: (mode: Mode) => void;
  openOverlay: () => void;
  capture: (name: 'run' | 'always-run' | 'allow', theme: 'dark' | 'light') => void;
  openTemplatesFolder: () => void;
  openLogFolder: () => void;
  showButtonTest: () => void;
  checkForUpdates: () => void;
  updateMenu: () => {
    statusLabel: string | null;
    actionLabel: string;
    actionEnabled: boolean;
    showHomebrewToggle: boolean;
    homebrewInstall: boolean;
    available: boolean;
  };
  setHomebrewInstall: (value: boolean) => void;
  getPollInterval: () => number;
  setPollInterval: (ms: number) => void;
  getSettings: () => Settings;
  isMatcherRetrying?: () => boolean;
  showWelcome?: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
};

export const CONFIDENCE_CHOICES = [0.8, 0.84, 0.88, 0.92, 0.95];
export const COOLDOWN_CHOICES_MS = [500, 1000, 2000, 5000];

export class TrayUI {
  private tray: Tray | null = null;
  private menu: Menu | null = null;

  constructor(private cb: TrayCallbacks) {}

  private iconPath(state: Mode): string {
    const name =
      state === 'run' ? 'tray-run' : state === 'always-run' ? 'tray-always' : 'tray-idle';
    // app.getAppPath() is the project root in dev and resources/app.asar when
    // packaged — assets/icons/tray lives in both, so one path works everywhere.
    return path.join(app.getAppPath(), 'assets', 'icons', 'tray', `${name}.png`);
  }

  show(): void {
    const icon = nativeImage.createFromPath(this.iconPath(this.cb.getMode()));
    this.tray = new Tray(icon);
    this.tray.setToolTip('Cursor Auto Runner — idle');
    // Left click toggles the stats overlay; right click opens the full menu.
    this.tray.on('click', () => this.cb.openOverlay());
    this.tray.on('right-click', () => {
      if (this.menu) this.tray?.popUpContextMenu(this.menu);
    });
    this.rebuild();
  }

  rebuild(): void {
    if (!this.tray) return;
    const mode = this.cb.getMode();
    this.tray.setImage(nativeImage.createFromPath(this.iconPath(mode)));
    const retrying = this.cb.isMatcherRetrying?.() ? ' · matcher retrying' : '';
    this.tray.setToolTip(
      (mode === 'idle'
        ? 'Cursor Auto Runner — idle'
        : `Cursor Auto Runner — auto ${mode === 'run' ? 'Run' : 'Always Run'} active`) + retrying
    );

    const interval = this.cb.getPollInterval();
    const faster = stepPoll(interval, -1);
    const slower = stepPoll(interval, +1);

    const menu: MenuItemConstructorOptions[] = [
      {
        label: `Cursor Auto Runner ${app.getVersion()}`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Start Auto Run',
        type: 'radio',
        checked: mode === 'run',
        click: () => this.cb.setMode('run'),
      },
      {
        label: 'Start Auto Always Run',
        type: 'radio',
        checked: mode === 'always-run',
        click: () => this.cb.setMode('always-run'),
      },
      {
        label: 'Stop',
        type: 'radio',
        checked: mode === 'idle',
        enabled: mode !== 'idle',
        click: () => this.cb.setMode('idle'),
      },
      { type: 'separator' },
      {
        label: `Refresh interval: ${this.cb.getPollInterval()} ms`,
        enabled: false,
      },
      {
        label: faster !== null ? `Faster (→ ${faster} ms)` : 'Faster',
        enabled: faster !== null,
        click: () => this.cb.setPollInterval(faster!),
      },
      {
        label: slower !== null ? `Slower (→ ${slower} ms)` : 'Slower',
        enabled: slower !== null,
        click: () => this.cb.setPollInterval(slower!),
      },
      { type: 'separator' },
      this.settingsMenu(),
      {
        label: 'Capture templates…',
        submenu: (['run', 'always-run', 'allow'] as const).flatMap((name) => [
          {
            label: `${name === 'allow' ? 'allow / approve' : name} (dark)`,
            click: () => this.cb.capture(name, 'dark'),
          },
          {
            label: `${name === 'allow' ? 'allow / approve' : name} (light)`,
            click: () => this.cb.capture(name, 'light'),
          },
        ]),
      },
      { type: 'separator' },
      { label: 'Open templates folder', click: () => this.cb.openTemplatesFolder() },
      { label: 'Open log folder', click: () => this.cb.openLogFolder() },
      { label: 'Stats…', click: () => this.cb.openOverlay() },
      {
        label: 'Test buttons…',
        click: () => this.cb.showButtonTest(),
      },
      { type: 'separator' },
      ...this.updateItems(),
      { label: 'Quit', click: () => app.quit() },
    ];
    this.menu = Menu.buildFromTemplate(menu);
    // Menu is shown on right click via popUpContextMenu; left click toggles
    // the stats overlay (see show()). setContextMenu would also open the
    // menu on left click on Windows, shadowing the toggle.
    // Let the overlay react too (best effort).
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.MODE_CHANGED, mode);
    }
  }

  private settingsMenu(): MenuItemConstructorOptions {
    const s = this.cb.getSettings();
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
    return {
      label: 'Settings',
      submenu: [
        // Login items are a no-op on Linux.
        ...(process.platform === 'linux'
          ? []
          : ([
              {
                label: 'Start at login',
                type: 'checkbox',
                checked: s.launchAtLogin,
                click: (item) => this.cb.updateSettings({ launchAtLogin: Boolean(item.checked) }),
              },
            ] as MenuItemConstructorOptions[])),
        ...(process.platform === 'win32'
          ? ([
              {
                label: 'Experimental: per-window capture (Windows)',
                type: 'checkbox',
                checked: s.windowCaptureOnWindows,
                click: (item) =>
                  this.cb.updateSettings({ windowCaptureOnWindows: Boolean(item.checked) }),
              },
            ] as MenuItemConstructorOptions[])
          : []),
        {
          label: 'Restore last mode on launch',
          type: 'checkbox',
          checked: s.restoreLastMode,
          click: (item) => this.cb.updateSettings({ restoreLastMode: Boolean(item.checked) }),
        },
        {
          label: 'Focus Cursor before clicking',
          type: 'checkbox',
          checked: s.focusCursorBeforeClick,
          click: (item) =>
            this.cb.updateSettings({ focusCursorBeforeClick: Boolean(item.checked) }),
        },
        {
          label: 'Pause while I am typing',
          type: 'checkbox',
          checked: s.pauseWhileTyping,
          click: (item) => this.cb.updateSettings({ pauseWhileTyping: Boolean(item.checked) }),
        },
        {
          label: 'Check for updates automatically',
          type: 'checkbox',
          visible: this.cb.updateMenu().available,
          checked: s.autoCheckUpdates,
          click: (item) => this.cb.updateSettings({ autoCheckUpdates: Boolean(item.checked) }),
        },
        { label: 'Show welcome…', click: () => this.cb.showWelcome?.() },
        {
          label: 'Keep stats window on top',
          type: 'checkbox',
          checked: s.overlayAlwaysOnTop,
          click: (item) => this.cb.updateSettings({ overlayAlwaysOnTop: Boolean(item.checked) }),
        },
        {
          label: 'Confidence',
          submenu: CONFIDENCE_CHOICES.map((v) => ({
            label: v.toFixed(2),
            type: 'radio' as const,
            checked: near(s.confidence, v),
            click: () => this.cb.updateSettings({ confidence: v }),
          })),
        },
        {
          label: 'Click cooldown',
          submenu: COOLDOWN_CHOICES_MS.map((ms) => ({
            label: `${ms / 1000} s`,
            type: 'radio' as const,
            checked: s.cooldownMs === ms,
            click: () => this.cb.updateSettings({ cooldownMs: ms }),
          })),
        },
        {
          label: 'Keyboard shortcut',
          submenu: SHORTCUT_CHOICES.map((acc) => ({
            label:
              acc === ''
                ? 'Off'
                : acc.replace('CommandOrControl', process.platform === 'darwin' ? 'Cmd' : 'Ctrl'),
            type: 'radio' as const,
            checked: s.toggleShortcut === acc,
            click: () => this.cb.updateSettings({ toggleShortcut: acc }),
          })),
        },
      ],
    };
  }

  private updateItems(): MenuItemConstructorOptions[] {
    const update = this.cb.updateMenu();
    const items: MenuItemConstructorOptions[] = [];
    if (!update.available) return items;
    if (update.statusLabel) items.push({ label: update.statusLabel, enabled: false });
    items.push({
      label: update.actionLabel,
      enabled: update.actionEnabled,
      click: () => this.cb.checkForUpdates(),
    });
    if (update.showHomebrewToggle) {
      items.push({
        label: 'Install updates with Homebrew',
        type: 'checkbox',
        checked: update.homebrewInstall,
        click: (item) => this.cb.setHomebrewInstall(Boolean(item.checked)),
      });
    }
    items.push({ type: 'separator' });
    return items;
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}

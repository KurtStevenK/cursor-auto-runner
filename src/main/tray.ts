/**
 * System tray: icon reflects the current state, menu offers
 * Start Auto Run / Start Auto Always Run / Stop / Stats / Quit.
 */
import { app, BrowserWindow, Menu, nativeImage, Tray, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import { Mode, IPC } from '../shared/types';

export type TrayCallbacks = {
  getMode: () => Mode;
  setMode: (mode: Mode) => void;
  openOverlay: () => void;
  capture: (name: 'run' | 'always-run' | 'allow', theme: 'dark' | 'light') => void;
};

export class TrayUI {
  private tray: Tray | null = null;

  constructor(private cb: TrayCallbacks) {}

  private iconPath(state: Mode): string {
    const name =
      state === 'run' ? 'tray-run' : state === 'always-run' ? 'tray-always' : 'tray-idle';
    const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', '..', '..', 'assets', 'icons');
    return path.join(base, 'tray', `${name}.png`);
  }

  show(): void {
    const icon = nativeImage.createFromPath(this.iconPath(this.cb.getMode()));
    this.tray = new Tray(icon);
    this.tray.setToolTip('Cursor Auto Runner — idle');
    this.rebuild();
  }

  rebuild(): void {
    if (!this.tray) return;
    const mode = this.cb.getMode();
    this.tray.setImage(nativeImage.createFromPath(this.iconPath(mode)));
    this.tray.setToolTip(
      mode === 'idle'
        ? 'Cursor Auto Runner — idle'
        : `Cursor Auto Runner — auto ${mode === 'run' ? 'Run' : 'Always Run'} active`
    );

    const menu: MenuItemConstructorOptions[] = [
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
        label: 'Capture templates…',
        submenu: (['run', 'always-run', 'allow'] as const).flatMap((name) => [
          { label: `${name} (dark)`, click: () => this.cb.capture(name, 'dark') },
          { label: `${name} (light)`, click: () => this.cb.capture(name, 'light') },
        ]),
      },
      { type: 'separator' },
      { label: 'Stats…', click: () => this.cb.openOverlay() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ];
    this.tray.setContextMenu(Menu.buildFromTemplate(menu));
    // Let the overlay react too (best effort).
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.MODE_CHANGED, mode);
    }
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}

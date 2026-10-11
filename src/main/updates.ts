/**
 * GitHub Release check, plus a background Homebrew cask upgrade on macOS.
 * `brew upgrade` runs `brew update` first unless Homebrew is told not to.
 * The cask quits this app while replacing it, so the brew process is detached.
 */
import { app, dialog, Notification, shell } from 'electron';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BREW_CANDIDATES,
  BREW_UPGRADE_ARGS,
  caskroomForBrew,
  firstExistingPath,
  isNewerVersion,
} from './update-version';

const LATEST_RELEASE = 'https://api.github.com/repos/KurtStevenK/cursor-auto-runner/releases/latest';

export interface UpdateMenuState {
  statusLabel: string | null;
  actionLabel: string;
  actionEnabled: boolean;
  showHomebrewToggle: boolean;
  homebrewInstall: boolean;
}

interface ReleaseInfo {
  version: string;
  htmlUrl: string;
}

type Phase = 'idle' | 'checking' | 'installing';

export class UpdateController {
  private phase: Phase = 'idle';
  private latest: ReleaseInfo | null = null;
  private brewCask = false;
  private lastError: string | null = null;
  private started = false;

  constructor(
    private readonly options: {
      getAutoInstall: () => boolean;
      setAutoInstall: (value: boolean) => void;
      onChange: () => void;
    }
  ) {}

  menuState(): UpdateMenuState {
    const busy = this.phase !== 'idle';
    let statusLabel: string | null = null;
    if (this.phase === 'installing' && this.latest) statusLabel = `Installing ${this.latest.version} with Homebrew…`;
    else if (this.latest && isNewerVersion(this.latest.version, app.getVersion())) {
      statusLabel = `Update available: ${this.latest.version}`;
    } else if (this.lastError) statusLabel = 'Update check failed';
    return {
      statusLabel,
      actionLabel: this.phase === 'checking' ? 'Checking for updates…' : 'Check for updates…',
      actionEnabled: !busy,
      showHomebrewToggle: process.platform === 'darwin',
      homebrewInstall: this.options.getAutoInstall(),
    };
  }

  setAutoInstall(value: boolean): void {
    this.options.setAutoInstall(value);
    this.options.onChange();
  }

  /** Silent check after launch. Homebrew installs upgrade themselves when the checkbox is on. */
  start(): void {
    if (this.started) return;
    this.started = true;
    setTimeout(() => {
      void this.check(false);
    }, 8000);
  }

  checkFromMenu(): void {
    void this.check(true);
  }

  private async check(interactive: boolean): Promise<void> {
    if (this.phase !== 'idle') return;
    this.phase = 'checking';
    this.lastError = null;
    this.options.onChange();
    try {
      const release = await fetchLatestRelease();
      this.latest = release;
      this.brewCask = this.detectBrewCask();
      const newer = isNewerVersion(release.version, app.getVersion());
      if (!newer) {
        if (interactive) {
          await dialog.showMessageBox({
            type: 'info',
            title: 'Cursor Auto Runner',
            message: `You're on the latest version (${app.getVersion()}).`,
          });
        }
        return;
      }
      const canBrew = this.brewCask && process.platform === 'darwin' && app.isPackaged;
      if (canBrew && (interactive || this.options.getAutoInstall())) {
        if (interactive) {
          const { response } = await dialog.showMessageBox({
            type: 'info',
            title: 'Cursor Auto Runner',
            message: `Version ${release.version} is available.`,
            detail: 'Install it with Homebrew now? The app quits when the upgrade finishes.',
            buttons: ['Install with Homebrew', 'Not now'],
            defaultId: 0,
            cancelId: 1,
          });
          if (response !== 0) return;
        }
        this.beginBrewUpgrade(release.version);
        return;
      }
      if (interactive) {
        const { response } = await dialog.showMessageBox({
          type: 'info',
          title: 'Cursor Auto Runner',
          message: `Version ${release.version} is available.`,
          detail: 'Download it from the GitHub Release. A Homebrew install can upgrade itself from this menu.',
          buttons: ['Open download page', 'Not now'],
          defaultId: 0,
          cancelId: 1,
        });
        if (response === 0) await shell.openExternal(release.htmlUrl);
      } else {
        this.notify(`Version ${release.version} is available. Open the tray menu to install it.`);
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error('[updates]', this.lastError);
      if (interactive) {
        await dialog.showMessageBox({
          type: 'error',
          title: 'Cursor Auto Runner',
          message: 'Could not check for updates.',
          detail: this.lastError,
        });
      }
    } finally {
      if (this.phase === 'checking') this.phase = 'idle';
      this.options.onChange();
    }
  }

  private detectBrewCask(): boolean {
    const brew = firstExistingPath(BREW_CANDIDATES, (file) => fs.existsSync(file));
    if (!brew) return false;
    return fs.existsSync(caskroomForBrew(brew));
  }

  private beginBrewUpgrade(version: string): void {
    const brew = firstExistingPath(BREW_CANDIDATES, (file) => fs.existsSync(file));
    if (!brew) {
      this.lastError = 'Homebrew was not found.';
      this.phase = 'idle';
      return;
    }
    this.phase = 'installing';
    this.notify(`Updating to ${version} with Homebrew. The app will quit when the new version is ready.`);
    this.options.onChange();
    const logPath = path.join(app.getPath('userData'), 'brew-upgrade.log');
    const log = fs.openSync(logPath, 'w');
    const child = spawn(brew, [...BREW_UPGRADE_ARGS], {
      detached: true,
      stdio: ['ignore', log, log],
      env: {
        ...process.env,
        PATH: `${path.dirname(brew)}${path.delimiter}${process.env.PATH ?? ''}`,
        HOMEBREW_NO_ENV_HINTS: '1',
        HOMEBREW_NO_ANALYTICS: '1',
      },
    });
    child.unref();
    fs.closeSync(log);
    child.on('error', (error) => {
      this.phase = 'idle';
      this.lastError = error.message;
      this.options.onChange();
      void dialog.showMessageBox({
        type: 'error',
        title: 'Cursor Auto Runner',
        message: 'Homebrew could not start.',
        detail: error.message,
      });
    });
    child.on('exit', (code) => {
      this.phase = 'idle';
      this.options.onChange();
      if (code === 0) return;
      const detail = tailFile(logPath);
      this.lastError = detail || `Homebrew exited with code ${code ?? 'unknown'}.`;
      void dialog.showMessageBox({
        type: 'error',
        title: 'Cursor Auto Runner',
        message: 'Homebrew upgrade failed.',
        detail: this.lastError,
      });
    });
  }

  private notify(body: string): void {
    if (!Notification.isSupported()) return;
    new Notification({ title: 'Cursor Auto Runner', body }).show();
  }
}

async function fetchLatestRelease(): Promise<ReleaseInfo> {
  const response = await fetch(LATEST_RELEASE, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'cursor-auto-runner',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);
  const body = (await response.json()) as { tag_name?: string; html_url?: string };
  const version = (body.tag_name || '').replace(/^v/i, '');
  if (!version || !body.html_url) throw new Error('GitHub release did not include a version.');
  return { version, htmlUrl: body.html_url };
}

function tailFile(file: string): string {
  try {
    const text = fs.readFileSync(file, 'utf8').trim();
    return text.length > 800 ? text.slice(-800) : text;
  } catch {
    return '';
  }
}

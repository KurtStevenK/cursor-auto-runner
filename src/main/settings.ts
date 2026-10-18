/** Settings: JSON config persisted in userData. */
import * as path from 'path';
import * as fs from 'fs';
import { Settings, DEFAULT_SETTINGS, Mode } from '../shared/types';

function defaultUserDataDir(): string {
  // Lazy so this module can be loaded under plain Node (tests).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('electron').app.getPath('userData');
}

const MODES: readonly Mode[] = ['idle', 'run', 'always-run'];

function clampNumber(value: unknown, min: number, max: number, fallback: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const n = integer ? Math.round(value) : value;
  return Math.min(max, Math.max(min, n));
}

/** Merge untrusted input with defaults, validating and clamping every field. Unknown keys are dropped. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    pollIntervalMs: clampNumber(r.pollIntervalMs, 150, 60000, d.pollIntervalMs, true),
    confidence: clampNumber(r.confidence, 0.5, 0.99, d.confidence),
    cooldownMs: clampNumber(r.cooldownMs, 0, 60000, d.cooldownMs),
    restoreLastMode: typeof r.restoreLastMode === 'boolean' ? r.restoreLastMode : d.restoreLastMode,
    lastMode: MODES.includes(r.lastMode as Mode) ? (r.lastMode as Mode) : d.lastMode,
    installUpdatesWithHomebrew:
      typeof r.installUpdatesWithHomebrew === 'boolean' ? r.installUpdatesWithHomebrew : d.installUpdatesWithHomebrew,
    launchAtLogin: typeof r.launchAtLogin === 'boolean' ? r.launchAtLogin : d.launchAtLogin,
  };
}

export class SettingsStore {
  private file: string;
  private data: Settings;

  constructor(dir?: string) {
    this.file = path.join(dir ?? defaultUserDataDir(), 'settings.json');
    this.data = sanitizeSettings(undefined);
    try {
      if (fs.existsSync(this.file)) {
        this.data = sanitizeSettings(JSON.parse(fs.readFileSync(this.file, 'utf8')));
      }
    } catch (err) {
      console.error('[settings] failed to read, using defaults:', err);
    }
  }

  get(): Settings {
    return { ...this.data };
  }

  set(patch: Partial<Settings>): void {
    this.data = sanitizeSettings({ ...this.data, ...patch });
    try {
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('[settings] failed to persist:', err);
    }
  }
}

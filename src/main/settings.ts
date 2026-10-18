/** Settings: JSON config persisted in userData. */
import * as path from 'path';
import * as fs from 'fs';
import {
  Settings,
  DEFAULT_SETTINGS,
  Mode,
  SHORTCUT_CHOICES,
  OverlayBounds,
  OVERLAY_MIN_WIDTH,
  OVERLAY_MIN_HEIGHT,
} from '../shared/types';

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

/** Validate saved overlay bounds: finite integers, at least the minimum size. */
export function sanitizeOverlayBounds(raw: unknown): OverlayBounds | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e6;
  if (!ok(r.x) || !ok(r.y) || !ok(r.width) || !ok(r.height)) return undefined;
  const width = Math.round(r.width);
  const height = Math.round(r.height);
  if (width < OVERLAY_MIN_WIDTH || height < OVERLAY_MIN_HEIGHT) return undefined;
  return { x: Math.round(r.x), y: Math.round(r.y), width, height };
}

/** True when the bounds overlap at least a 60x40 px area of one of the display work areas. */
export function boundsIntersectDisplays(b: OverlayBounds, areas: OverlayBounds[]): boolean {
  return areas.some((a) => {
    const w = Math.min(b.x + b.width, a.x + a.width) - Math.max(b.x, a.x);
    const h = Math.min(b.y + b.height, a.y + a.height) - Math.max(b.y, a.y);
    return w >= 60 && h >= 40;
  });
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
    toggleShortcut: (SHORTCUT_CHOICES as readonly unknown[]).includes(r.toggleShortcut)
      ? (r.toggleShortcut as string)
      : d.toggleShortcut,
    focusCursorBeforeClick:
      typeof r.focusCursorBeforeClick === 'boolean' ? r.focusCursorBeforeClick : d.focusCursorBeforeClick,
    pauseWhileTyping: typeof r.pauseWhileTyping === 'boolean' ? r.pauseWhileTyping : d.pauseWhileTyping,
    overlayAlwaysOnTop: typeof r.overlayAlwaysOnTop === 'boolean' ? r.overlayAlwaysOnTop : d.overlayAlwaysOnTop,
    ...(sanitizeOverlayBounds(r.overlayBounds) ? { overlayBounds: sanitizeOverlayBounds(r.overlayBounds) } : {}),
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

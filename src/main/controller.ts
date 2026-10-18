/**
 * Mode controller: the state machine that drives the detection/click loop.
 * Modes: idle | run (clicks Run buttons) | always-run (prefers Always Run).
 * Exactly one poll loop runs at a time; the loop stops cleanly on Stop.
 */
import type { Detector } from './detector';
import type { StatsStore } from './stats';
import type { Mode, ClickMode } from '../shared/types';

export interface ControllerHealth {
  consecutiveErrors: number;
  lastError: string | null;
  lastErrorAt: number | null;
  lastMatchAt: number | null;
  lastDetectAt: number | null;
}

type DetectorLike = Pick<Detector, 'detect' | 'cancelPending' | 'windowFound' | 'watchedKind'>;
type ClickFn = (x: number, y: number) => Promise<void>;
type IdleFn = () => number;

/** The user counts as "actively typing/moving" below this many idle seconds. */
export const TYPING_IDLE_THRESHOLD_S = 1;

const MAX_BACKOFF_MS = 30_000;

/** Polls after a click that run at the fast interval. */
export const FAST_POLLS_AFTER_CLICK = 3;
export const NO_WINDOW_MIN_INTERVAL_MS = 2000;
export const AWAY_MIN_INTERVAL_MS = 5000;
export const AWAY_IDLE_THRESHOLD_S = 5 * 60;
export const AFTER_CLICK_INTERVAL_MS = 500;

export interface PollState {
  /** The user-set interval. */
  baseMs: number;
  windowFound: boolean;
  /** System idle time in seconds (0 when unknown). */
  idleSeconds: number;
  /** Remaining fast polls after a recent click. */
  fastPollsLeft: number;
}

/** Pure interval selection for the next poll (see B2 in IMPROVEMENT-PLAN.md). */
export function nextPollIntervalMs(s: PollState): number {
  if (s.fastPollsLeft > 0) return Math.min(s.baseMs, AFTER_CLICK_INTERVAL_MS);
  let ms = s.baseMs;
  if (!s.windowFound) ms = Math.max(ms, NO_WINDOW_MIN_INTERVAL_MS);
  if (s.idleSeconds > AWAY_IDLE_THRESHOLD_S) ms = Math.max(ms, AWAY_MIN_INTERVAL_MS);
  return ms;
}

// Lazy so unit tests under plain Node never load the nut-js native addon.
const defaultClicker: ClickFn = (x, y) =>
  (require('./clicker') as typeof import('./clicker')).clickAt(x, y);

// Lazy for the same reason; the controller itself never imports electron.
const defaultIdleSeconds: IdleFn = () =>
  (require('electron') as typeof import('electron')).powerMonitor.getSystemIdleTime();

export class ModeController {
  private consecutiveErrors = 0;
  private lastError: string | null = null;
  private lastErrorAt: number | null = null;
  private lastMatchAt: number | null = null;
  private lastDetectAt: number | null = null;
  private mode: Mode = 'idle';
  private running = false;
  private loopToken = 0;
  private lastClickAt = 0;
  private fastPollsLeft = 0;
  private lastIdleSeconds = 0;

  constructor(
    private detector: DetectorLike,
    private stats: Pick<StatsStore, 'record'>,
    private opts: {
      pollIntervalMs: number;
      confidence: number;
      cooldownMs: number;
      retryDelayMs?: number;
      focusBeforeClick?: boolean;
      pauseWhileTyping?: boolean;
    },
    private onModeChange?: (mode: Mode) => void,
    private onDetectionState?: (
      windowFound: boolean,
      watchedKind: 'cursor' | 'rustdesk' | null
    ) => void,
    private onClick?: () => void,
    private onHealthChange?: () => void,
    private clicker: ClickFn = defaultClicker,
    private idleSeconds: IdleFn = defaultIdleSeconds
  ) {}

  get health(): ControllerHealth {
    return {
      consecutiveErrors: this.consecutiveErrors,
      lastError: this.lastError,
      lastErrorAt: this.lastErrorAt,
      lastMatchAt: this.lastMatchAt,
      lastDetectAt: this.lastDetectAt,
    };
  }

  get current(): Mode {
    return this.mode;
  }

  /** Apply a new poll interval live (takes effect on the next loop cycle). */
  setPollInterval(ms: number): void {
    this.opts.pollIntervalMs = Math.max(150, Math.min(60000, ms));
  }

  /** Apply a new match confidence live (next detect call). */
  setConfidence(v: number): void {
    this.opts.confidence = Math.max(0.5, Math.min(0.99, v));
  }

  /** Apply a new click cooldown live. */
  setCooldown(ms: number): void {
    this.opts.cooldownMs = Math.max(0, Math.min(60000, ms));
  }

  /** Toggle bringing the Cursor window to the front before each click. */
  setFocusBeforeClick(v: boolean): void {
    this.opts.focusBeforeClick = v;
  }

  /** Toggle skipping clicks while the user is actively using mouse/keyboard. */
  setPauseWhileTyping(v: boolean): void {
    this.opts.pauseWhileTyping = v;
  }

  /** True when a click should be deferred because the user is active right now. */
  private userIsActive(): boolean {
    if (this.opts.pauseWhileTyping === false) return false;
    try {
      return this.idleSeconds() < TYPING_IDLE_THRESHOLD_S;
    } catch {
      return false; // never block clicking on an unreadable idle time
    }
  }

  private async focusIfWanted(hit: { focus: () => Promise<unknown> }): Promise<void> {
    if (this.opts.focusBeforeClick === false) return;
    try {
      await hit.focus(); // best-effort: bring Cursor to foreground
    } catch {
      /* focus is optional */
    }
  }

  /** Interval the loop is actually using right now (adaptive; read-only). */
  get effectivePollIntervalMs(): number {
    return nextPollIntervalMs({
      baseMs: this.opts.pollIntervalMs,
      windowFound: this.detector.windowFound,
      idleSeconds: this.lastIdleSeconds,
      fastPollsLeft: this.fastPollsLeft,
    });
  }

  /** Current poll interval (for display in the overlay). */
  get pollIntervalMs(): number {
    return this.opts.pollIntervalMs;
  }

  set(mode: Mode): void {
    if (mode === this.mode) return;
    this.detector.cancelPending();
    this.mode = mode;
    this.onModeChange?.(mode);
    if (mode === 'idle') {
      this.stop();
    } else {
      this.start();
    }
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    const token = ++this.loopToken;
    void this.loop(token);
  }

  private stop(): void {
    this.running = false;
    this.loopToken++;
    this.detector.cancelPending();
  }

  private async loop(token: number): Promise<void> {
    while (this.running && token === this.loopToken) {
      try {
        const clickMode: ClickMode = this.mode === 'always-run' ? 'always-run' : 'run';
        const result = await this.detector.detect(clickMode, this.opts.confidence);
        if (!this.running || token !== this.loopToken) break;
        this.lastDetectAt = Date.now();
        this.consecutiveErrors = 0;
        this.onHealthChange?.();
        this.onDetectionState?.(this.detector.windowFound, this.detector.watchedKind);

        if (result) {
          const sinceClick = Date.now() - this.lastClickAt;
          if (sinceClick >= this.opts.cooldownMs && !this.userIsActive()) {
            await this.focusIfWanted(result);
            await this.clicker(result.x, result.y);
            this.lastClickAt = Date.now();
            this.lastMatchAt = this.lastClickAt;
            this.fastPollsLeft = FAST_POLLS_AFTER_CLICK;
            this.stats.record(result.mode);
            this.onClick?.();
            this.onHealthChange?.();

            // Some buttons need to be clicked twice (e.g. the first click
            // only focuses the window, or Cursor asks again right after).
            // Re-check the same spot and click again, up to 2 extra times.
            let last = result;
            for (let attempt = 0; attempt < 2; attempt++) {
              await new Promise((r) => setTimeout(r, this.opts.retryDelayMs ?? 600));
              if (!this.running || token !== this.loopToken) break;
              const again = await this.detector.detect(clickMode, this.opts.confidence);
              if (!this.running || token !== this.loopToken) break;
              if (!again) break; // button gone -> approval went through
              const near = Math.hypot(again.x - last.x, again.y - last.y) < 80;
              if (!near) break; // different button -> let the next poll handle it
              if (this.userIsActive()) break; // retry on the next poll
              await this.focusIfWanted(again);
              await this.clicker(again.x, again.y);
              this.lastClickAt = Date.now();
              this.lastMatchAt = this.lastClickAt;
              this.fastPollsLeft = FAST_POLLS_AFTER_CLICK;
              this.stats.record(again.mode);
              this.onClick?.();
              this.onHealthChange?.();
              last = again;
            }
          }
        }
      } catch (err) {
        console.error('[controller] loop error:', err);
        this.consecutiveErrors++;
        this.lastError = err instanceof Error ? err.message : String(err);
        this.lastErrorAt = Date.now();
        this.onHealthChange?.();
      }
      // Sleep in small slices so Stop reacts quickly; back off after errors.
      try {
        this.lastIdleSeconds = this.idleSeconds();
      } catch {
        this.lastIdleSeconds = 0;
      }
      const interval = this.effectivePollIntervalMs;
      if (this.fastPollsLeft > 0) this.fastPollsLeft--;
      const wait =
        this.consecutiveErrors > 0
          ? Math.min(MAX_BACKOFF_MS, interval * 2 ** this.consecutiveErrors)
          : interval;
      const deadline = Date.now() + wait;
      while (Date.now() < deadline && this.running && token === this.loopToken) {
        await new Promise((r) => setTimeout(r, Math.min(50, Math.max(1, deadline - Date.now()))));
      }
    }
  }
}

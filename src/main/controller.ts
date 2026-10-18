/**
 * Mode controller: the state machine that drives the detection/click loop.
 * Modes: idle | run (clicks Run buttons) | always-run (prefers Always Run).
 * Exactly one poll loop runs at a time; the loop stops cleanly on Stop.
 */
import type { Detector } from './detector';
import type { StatsStore } from './stats';
import { Mode, ClickMode } from '../shared/types';

export interface ControllerHealth {
  consecutiveErrors: number;
  lastError: string | null;
  lastErrorAt: number | null;
  lastMatchAt: number | null;
  lastDetectAt: number | null;
}

type DetectorLike = Pick<Detector, 'detect' | 'cancelPending' | 'windowFound' | 'watchedKind'>;
type ClickFn = (x: number, y: number) => Promise<void>;

const MAX_BACKOFF_MS = 30_000;

// Lazy so unit tests under plain Node never load the nut-js native addon.
const defaultClicker: ClickFn = (x, y) =>
  (require('./clicker') as typeof import('./clicker')).clickAt(x, y);

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

  constructor(
    private detector: DetectorLike,
    private stats: Pick<StatsStore, 'record'>,
    private opts: { pollIntervalMs: number; confidence: number; cooldownMs: number; retryDelayMs?: number },
    private onModeChange?: (mode: Mode) => void,
    private onDetectionState?: (windowFound: boolean, watchedKind: 'cursor' | 'rustdesk' | null) => void,
    private onClick?: () => void,
    private onHealthChange?: () => void,
    private clicker: ClickFn = defaultClicker
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
          if (sinceClick >= this.opts.cooldownMs) {
            try {
              await result.focus(); // best-effort: bring Cursor to foreground
            } catch {
              /* focus is optional */
            }
            await this.clicker(result.x, result.y);
            this.lastClickAt = Date.now();
            this.lastMatchAt = this.lastClickAt;
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
              try {
                await again.focus();
              } catch {
                /* focus is optional */
              }
              await this.clicker(again.x, again.y);
              this.lastClickAt = Date.now();
              this.lastMatchAt = this.lastClickAt;
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
      const wait =
        this.consecutiveErrors > 0
          ? Math.min(MAX_BACKOFF_MS, this.opts.pollIntervalMs * 2 ** this.consecutiveErrors)
          : this.opts.pollIntervalMs;
      const deadline = Date.now() + wait;
      while (Date.now() < deadline && this.running && token === this.loopToken) {
        await new Promise((r) => setTimeout(r, Math.min(50, Math.max(1, deadline - Date.now()))));
      }
    }
  }

}

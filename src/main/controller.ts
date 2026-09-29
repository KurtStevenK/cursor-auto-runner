/**
 * Mode controller: the state machine that drives the detection/click loop.
 * Modes: idle | run (clicks Run buttons) | always-run (prefers Always Run).
 * Exactly one poll loop runs at a time; the loop stops cleanly on Stop.
 */
import { Detector } from './detector';
import { clickAt } from './clicker';
import { StatsStore } from './stats';
import { Mode, ClickMode, IPC } from '../shared/types';
import { BrowserWindow, ipcMain } from 'electron';

export class ModeController {
  private mode: Mode = 'idle';
  private running = false;
  private loopToken = 0;
  private lastClickAt = 0;

  constructor(
    private detector: Detector,
    private stats: StatsStore,
    private opts: { pollIntervalMs: number; confidence: number; cooldownMs: number },
    private onModeChange?: (mode: Mode) => void,
    private onDetectionState?: (windowFound: boolean) => void
  ) {
    ipcMain.on(IPC.SET_MODE, (_e, mode: Mode) => {
      this.set(mode);
    });
  }

  get current(): Mode {
    return this.mode;
  }

  set(mode: Mode): void {
    if (mode === this.mode) return;
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
  }

  private async loop(token: number): Promise<void> {
    while (this.running && token === this.loopToken) {
      try {
        const clickMode: ClickMode = this.mode === 'always-run' ? 'always-run' : 'run';
        const result = await this.detector.detect(clickMode);
        this.onDetectionState?.(this.detector.windowFound);

        if (result) {
          const sinceClick = Date.now() - this.lastClickAt;
          if (sinceClick >= this.opts.cooldownMs) {
            try {
              await result.focus(); // best-effort: bring Cursor to foreground
            } catch {
              /* focus is optional */
            }
            await clickAt(result.x, result.y);
            this.lastClickAt = Date.now();
            this.stats.record(result.mode);

            // Some buttons need to be clicked twice (e.g. the first click
            // only focuses the window, or Cursor asks again right after).
            // Re-check the same spot and click again, up to 2 extra times.
            let last = result;
            for (let attempt = 0; attempt < 2; attempt++) {
              await new Promise((r) => setTimeout(r, 600));
              if (!this.running || token !== this.loopToken) break;
              const again = await this.detector.detect(clickMode);
              if (!again) break; // button gone -> approval went through
              const near = Math.hypot(again.x - last.x, again.y - last.y) < 80;
              if (!near) break; // different button -> let the next poll handle it
              try {
                await again.focus();
              } catch {
                /* focus is optional */
              }
              await clickAt(again.x, again.y);
              this.lastClickAt = Date.now();
              this.stats.record(again.mode);
              last = again;
            }
          }
        }
      } catch (err) {
        console.error('[controller] loop error:', err);
      }
      // Sleep in small slices so Stop reacts quickly.
      const deadline = Date.now() + this.opts.pollIntervalMs;
      while (Date.now() < deadline && this.running && token === this.loopToken) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  }

  broadcastTo(win: BrowserWindow | null): void {
    win?.webContents.send(IPC.MODE_CHANGED, this.mode);
  }
}

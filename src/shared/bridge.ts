/** API surface the overlay preload exposes as `window.autoRunner`. Typed once, used by both sides. */
import type { DetectionState, Mode, StatsSnapshot } from './types';

export interface AutoRunnerBridge {
  getStats: () => Promise<StatsSnapshot>;
  setMode: (mode: Mode) => void;
  close: () => void;
  setPollInterval: (ms: number) => void;
  captureTemplate: () => void;
  onStats: (cb: (snap: StatsSnapshot) => void) => void;
  onModeChanged: (cb: (mode: Mode) => void) => void;
  onDetectionState: (cb: (state: DetectionState) => void) => void;
}

/** API surface the capture-window preload exposes as `window.capture`. */
export interface CaptureBridge {
  sendRegion: (r: { x: number; y: number; w: number; h: number }) => void;
  cancel: () => void;
  onSaved: (cb: (file: string) => void) => void;
  onRejected: (cb: (reason: string) => void) => void;
}

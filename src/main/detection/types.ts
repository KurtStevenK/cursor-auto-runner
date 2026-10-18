import type { CropPayload } from '../../shared/match-protocol';
import type { WindowRegion } from '../capture-geometry';

/** Plain subset of Electron.Display used by detection (injectable in tests). */
export interface DisplayInfo {
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
  size: { width: number; height: number };
  scaleFactor: number;
}

export interface WindowInfo {
  left: number;
  top: number;
  width: number;
  height: number;
  title: string;
  owner?: string | null;
  focus: () => Promise<boolean>;
}

export interface CropContext {
  id: number;
  payload: CropPayload;
  display: DisplayInfo;
  captureScaleX: number;
  captureScaleY: number;
  cropX: number;
  cropY: number;
  /** When set, match coordinates are relative to a per-window thumbnail. */
  windowLogical?: WindowRegion;
  /** Identifies which watched window this crop came from. */
  windowKey: string;
  focus: () => Promise<boolean>;
}

export interface CaptureResult {
  crops: CropContext[];
  sourceMissCount: number;
}

export function windowKey(window: { title: string; left: number; top: number }): string {
  return `${window.title}\0${window.left}\0${window.top}`;
}

import type { ClickMode } from './types';

export interface TemplatePayload {
  file: string;
  mode: ClickMode;
  theme: 'dark' | 'light';
  width: number;
  height: number;
  data: ArrayBuffer;
}

export interface CropPayload {
  id: number;
  width: number;
  height: number;
  /** Thumbnail pixels per native display pixel. Templates are captured natively. */
  captureToNativeScaleX: number;
  captureToNativeScaleY: number;
  bgra: ArrayBuffer;
}

export type MatchWorkerRequest =
  | { type: 'init'; requestId: number; templates: TemplatePayload[] }
  | {
      type: 'match';
      requestId: number;
      mode: ClickMode;
      confidence: number;
      crops: CropPayload[];
      cancelBuffer: SharedArrayBuffer;
    };

export interface WorkerMatch {
  cropId: number;
  x: number;
  y: number;
  templateWidth: number;
  templateHeight: number;
  score: number;
  mode: ClickMode;
  file: string;
  path: 'accent' | 'anchored-row' | 'global';
  pyramid: 'full' | 'half' | 'quarter';
}

export interface MatchDebugInfo {
  cropId: number;
  file: string;
  mode: ClickMode;
  baseScale: number;
  captureToNativeScaleX: number;
  captureToNativeScaleY: number;
  templateWidth: number;
  templateHeight: number;
  coarseScore: number | null;
  refinedScore: number | null;
  pyramid: 'full' | 'half' | 'quarter';
  phaseCount: number;
  candidateCount: number;
}

export type MatchWorkerResponse =
  | { type: 'ready'; requestId: number; templateCount: number; variantCount: number }
  | {
      type: 'result';
      requestId: number;
      match: WorkerMatch | null;
      /** Present only when CURSOR_AUTO_RUNNER_DEBUG_MATCH=1 and no match passed. */
      bestMiss?: MatchDebugInfo;
      variantCount: number;
      matchMs: number;
      workerHeapBytes: number;
      cancelled: boolean;
    }
  | { type: 'error'; requestId: number; message: string; stack?: string };

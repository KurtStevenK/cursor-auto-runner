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
}

export type MatchWorkerResponse =
  | { type: 'ready'; requestId: number; templateCount: number; variantCount: number }
  | {
      type: 'result';
      requestId: number;
      match: WorkerMatch | null;
      variantCount: number;
      matchMs: number;
      workerHeapBytes: number;
      cancelled: boolean;
    }
  | { type: 'error'; requestId: number; message: string; stack?: string };

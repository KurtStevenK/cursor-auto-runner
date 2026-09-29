import { app } from 'electron';
import { Worker } from 'node:worker_threads';
import type { ClickMode } from '../shared/types';
import type {
  CropPayload,
  MatchWorkerRequest,
  MatchWorkerResponse,
  TemplatePayload,
} from '../shared/match-protocol';
import { resolveMatchWorkerPath } from '../shared/worker-path';

type ReadyResponse = Extract<MatchWorkerResponse, { type: 'ready' }>;
type ResultResponse = Extract<MatchWorkerResponse, { type: 'result' }>;

interface PendingRequest {
  resolve: (response: MatchWorkerResponse) => void;
  reject: (error: Error) => void;
}

export class MatchWorkerClient {
  private worker: Worker | null = null;
  private requestId = 0;
  private pending = new Map<number, PendingRequest>();
  private activeCancelView: Int32Array | null = null;
  private stopping = false;
  private crashCount = 0;
  private retryAfter = 0;

  private workerPath(): string {
    return resolveMatchWorkerPath(__dirname, app.isPackaged);
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    if (this.stopping) throw new Error('matcher worker is shutting down');
    if (Date.now() < this.retryAfter) {
      throw new Error(`matcher worker restart is backing off until ${new Date(this.retryAfter).toISOString()}`);
    }

    const worker = new Worker(this.workerPath());
    this.worker = worker;
    worker.on('message', (response: MatchWorkerResponse) => this.handleResponse(response));
    worker.on('error', (error) => this.handleFailure(error));
    worker.on('exit', (code) => {
      if (this.worker !== worker) return;
      this.worker = null;
      if (!this.stopping && code !== 0) this.handleFailure(new Error(`matcher worker exited with code ${code}`));
    });
    return worker;
  }

  private handleResponse(response: MatchWorkerResponse): void {
    const pending = this.pending.get(response.requestId);
    if (!pending) return;
    this.pending.delete(response.requestId);
    if (response.type === 'error') {
      this.activeCancelView = null;
      pending.reject(new Error(response.stack ? `${response.message}\n${response.stack}` : response.message));
      return;
    }
    if (response.type === 'ready') this.crashCount = 0;
    if (response.type === 'result') this.activeCancelView = null;
    pending.resolve(response);
  }

  private handleFailure(error: Error): void {
    const failedWorker = this.worker;
    this.worker = null;
    this.activeCancelView = null;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    if (failedWorker) void failedWorker.terminate().catch(() => {});
    if (!this.stopping) {
      this.crashCount++;
      const delayMs = Math.min(5000, 250 * 2 ** Math.min(this.crashCount - 1, 5));
      this.retryAfter = Date.now() + delayMs;
      console.error(`[matcher-worker] failed; retrying after ${delayMs} ms:`, error);
    }
  }

  private request(request: MatchWorkerRequest, transfer: ArrayBuffer[]): Promise<MatchWorkerResponse> {
    const worker = this.ensureWorker();
    return new Promise((resolve, reject) => {
      this.pending.set(request.requestId, { resolve, reject });
      try {
        worker.postMessage(request, transfer);
      } catch (error) {
        this.pending.delete(request.requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async initialize(templates: TemplatePayload[]): Promise<ReadyResponse> {
    this.cancelCurrent();
    const requestId = ++this.requestId;
    const response = await this.request(
      { type: 'init', requestId, templates },
      templates.map((template) => template.data)
    );
    if (response.type !== 'ready') throw new Error(`unexpected matcher response: ${response.type}`);
    return response;
  }

  async match(mode: ClickMode, confidence: number, crops: CropPayload[]): Promise<ResultResponse> {
    this.cancelCurrent();
    const requestId = ++this.requestId;
    const cancelBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
    this.activeCancelView = new Int32Array(cancelBuffer);
    const response = await this.request(
      { type: 'match', requestId, mode, confidence, crops, cancelBuffer },
      crops.map((crop) => crop.bgra)
    );
    if (response.type !== 'result') throw new Error(`unexpected matcher response: ${response.type}`);
    return response;
  }

  cancelCurrent(): void {
    if (this.activeCancelView) Atomics.store(this.activeCancelView, 0, 1);
  }

  async dispose(): Promise<void> {
    this.stopping = true;
    this.cancelCurrent();
    for (const pending of this.pending.values()) pending.reject(new Error('matcher worker disposed'));
    this.pending.clear();
    const worker = this.worker;
    this.worker = null;
    if (worker) await worker.terminate();
  }
}

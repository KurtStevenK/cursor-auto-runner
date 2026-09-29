import { parentPort } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import type {
  MatchWorkerRequest,
  MatchWorkerResponse,
  TemplatePayload,
  WorkerMatch,
} from '../shared/match-protocol';
import {
  findBestPreparedMatch,
  grayFromBGRA,
  orderTemplatesForMode,
  prepareHaystack,
  prepareTemplateVariants,
  PreparedTemplate,
  TemplateInput,
} from './matcher-core';

if (!parentPort) throw new Error('match-worker must run inside a worker thread');

let templates: PreparedTemplate[] = [];
let templateCount = 0;

function post(response: MatchWorkerResponse): void {
  parentPort!.postMessage(response);
}

function prepareTemplates(payloads: TemplatePayload[]): void {
  const inputs: TemplateInput[] = payloads.map((payload) => ({
    file: payload.file,
    mode: payload.mode,
    theme: payload.theme,
    width: payload.width,
    height: payload.height,
    data: new Float32Array(payload.data),
  }));
  templateCount = inputs.length;
  templates = prepareTemplateVariants(inputs);
}

function handleMatch(request: Extract<MatchWorkerRequest, { type: 'match' }>): void {
  const startedAt = performance.now();
  const cancelView = new Int32Array(request.cancelBuffer);
  const cancelled = (): boolean => Atomics.load(cancelView, 0) !== 0;
  const eligible = orderTemplatesForMode(templates, request.mode);
  let match: WorkerMatch | null = null;

  for (const crop of request.crops) {
    if (cancelled()) break;
    const gray = grayFromBGRA(new Uint8Array(crop.bgra), crop.width, crop.height);
    const haystack = prepareHaystack(gray);
    for (const template of eligible) {
      if (cancelled()) break;
      const candidate = findBestPreparedMatch(haystack, template, request.confidence, cancelled);
      if (candidate) {
        match = {
          cropId: crop.id,
          x: candidate.x,
          y: candidate.y,
          templateWidth: template.image.width,
          templateHeight: template.image.height,
          score: candidate.score,
          mode: template.mode,
          file: template.file,
        };
        break;
      }
    }
    if (match) break;
  }

  post({
    type: 'result',
    requestId: request.requestId,
    match,
    variantCount: eligible.length,
    matchMs: performance.now() - startedAt,
    workerHeapBytes: process.memoryUsage().heapUsed,
    cancelled: cancelled(),
  });
}

parentPort.on('message', (request: MatchWorkerRequest) => {
  try {
    if (request.type === 'init') {
      prepareTemplates(request.templates);
      post({
        type: 'ready',
        requestId: request.requestId,
        templateCount,
        variantCount: templates.length,
      });
      return;
    }
    handleMatch(request);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    post({ type: 'error', requestId: request.requestId, message: err.message, stack: err.stack });
  }
});

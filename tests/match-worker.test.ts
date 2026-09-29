import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { Worker } from 'node:worker_threads';
import type { MatchWorkerRequest, MatchWorkerResponse } from '../src/shared/match-protocol';

function waitFor(worker: Worker, requestId: number): Promise<MatchWorkerResponse> {
  return new Promise((resolve, reject) => {
    const onMessage = (response: MatchWorkerResponse) => {
      if (response.requestId !== requestId) return;
      cleanup();
      resolve(response);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      worker.off('message', onMessage);
      worker.off('error', onError);
    };
    worker.on('message', onMessage);
    worker.on('error', onError);
  });
}

function templateData(width: number, height: number): Float32Array {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data[y * width + x] = (x * 41 + y * 23 + x * y) % 255;
  }
  return data;
}

test('worker matches off-thread and returns only eligible variants', async () => {
  const workerPath = path.join(__dirname, '..', 'src', 'worker', 'match-worker.js');
  const worker = new Worker(workerPath);
  try {
    const width = 12;
    const height = 10;
    const gray = templateData(width, height);
    const templateBuffer = gray.buffer.slice(0) as ArrayBuffer;
    const init: MatchWorkerRequest = {
      type: 'init',
      requestId: 1,
      templates: [
        { file: 'always-run.png', mode: 'always-run', theme: 'dark', width, height, data: templateBuffer.slice(0) },
        { file: 'run.png', mode: 'run', theme: 'dark', width, height, data: templateBuffer },
      ],
    };
    const readyPromise = waitFor(worker, 1);
    worker.postMessage(init, init.templates.map((template) => template.data));
    const ready = await readyPromise;
    assert.equal(ready.type, 'ready');

    const cropWidth = 96;
    const cropHeight = 72;
    const bgra = new Uint8Array(cropWidth * cropHeight * 4);
    bgra.fill(20);
    const expected = { x: 31, y: 27 };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const value = gray[y * width + x];
        const offset = ((expected.y + y) * cropWidth + expected.x + x) * 4;
        bgra[offset] = value;
        bgra[offset + 1] = value;
        bgra[offset + 2] = value;
        bgra[offset + 3] = 255;
      }
    }
    const cancelBuffer = new SharedArrayBuffer(4);
    const request: MatchWorkerRequest = {
      type: 'match',
      requestId: 2,
      mode: 'run',
      confidence: 0.99,
      crops: [{ id: 7, width: cropWidth, height: cropHeight, bgra: bgra.buffer }],
      cancelBuffer,
    };
    const resultPromise = waitFor(worker, 2);
    worker.postMessage(request, [bgra.buffer]);
    const result = await resultPromise;
    assert.equal(result.type, 'result');
    if (result.type !== 'result') return;
    assert.equal(result.variantCount, 7);
    assert.equal(result.match?.mode, 'run');
    assert.equal(result.match?.cropId, 7);
    assert.equal(result.match?.x, expected.x);
    assert.equal(result.match?.y, expected.y);

    const large = new Uint8Array(1280 * 720 * 4);
    for (let i = 0; i < large.length; i += 4) {
      large[i] = 15;
      large[i + 1] = 25;
      large[i + 2] = 35;
      large[i + 3] = 255;
    }
    const cancellation = new SharedArrayBuffer(4);
    const cancelView = new Int32Array(cancellation);
    const cancelRequest: MatchWorkerRequest = {
      type: 'match',
      requestId: 3,
      mode: 'run',
      confidence: 0.99,
      crops: [{ id: 8, width: 1280, height: 720, bgra: large.buffer }],
      cancelBuffer: cancellation,
    };
    const cancelledPromise = waitFor(worker, 3);
    worker.postMessage(cancelRequest, [large.buffer]);
    Atomics.store(cancelView, 0, 1);
    const cancelled = await cancelledPromise;
    assert.equal(cancelled.type, 'result');
    if (cancelled.type === 'result') assert.equal(cancelled.cancelled, true);
  } finally {
    await worker.terminate();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { Worker } from 'node:worker_threads';
import Jimp from 'jimp';
import type { MatchWorkerRequest, MatchWorkerResponse } from '../src/shared/match-protocol';
import { loadTemplate } from '../src/main/matcher';
import { resizeGray } from '../src/worker/matcher-core';

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

async function loadBgraFixture(file: string): Promise<{
  width: number;
  height: number;
  bgra: Uint8Array;
}> {
  const image = await Jimp.read(file);
  const rgba = image.bitmap.data;
  const bgra = new Uint8Array(rgba.length);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    bgra[offset] = rgba[offset + 2];
    bgra[offset + 1] = rgba[offset + 1];
    bgra[offset + 2] = rgba[offset];
    bgra[offset + 3] = rgba[offset + 3];
  }
  return { width: image.bitmap.width, height: image.bitmap.height, bgra };
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
      crops: [{
        id: 7,
        width: cropWidth,
        height: cropHeight,
        captureToNativeScaleX: 1,
        captureToNativeScaleY: 1,
        bgra: bgra.buffer,
      }],
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
      crops: [{
        id: 8,
        width: 1280,
        height: 720,
        captureToNativeScaleX: 1,
        captureToNativeScaleY: 1,
        bgra: large.buffer,
      }],
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

test('worker applies the detector capture ratio to template scales', async () => {
  const workerPath = path.join(__dirname, '..', 'src', 'worker', 'match-worker.js');
  const worker = new Worker(workerPath);
  try {
    const width = 40;
    const height = 24;
    const gray = templateData(width, height);
    const templateBuffer = gray.buffer.slice(0) as ArrayBuffer;
    const init: MatchWorkerRequest = {
      type: 'init',
      requestId: 10,
      templates: [
        { file: 'run.png', mode: 'run', theme: 'dark', width, height, data: templateBuffer },
      ],
    };
    const readyPromise = waitFor(worker, 10);
    worker.postMessage(init, [templateBuffer]);
    await readyPromise;

    // The target UI is at the existing 0.8 DPI scale, then the 2048x1152
    // desktop capture is uniformly capped by 0.9375: effective scale 0.75.
    const target = resizeGray({ width, height, data: gray }, 0.75);
    const cropWidth = 640;
    const cropHeight = 480;
    const bgra = new Uint8Array(cropWidth * cropHeight * 4);
    bgra.fill(20);
    const expected = { x: 421, y: 333 };
    for (let y = 0; y < target.height; y++) {
      for (let x = 0; x < target.width; x++) {
        const value = Math.round(target.data[y * target.width + x]);
        const offset = ((expected.y + y) * cropWidth + expected.x + x) * 4;
        bgra[offset] = value;
        bgra[offset + 1] = value;
        bgra[offset + 2] = value;
        bgra[offset + 3] = 255;
      }
    }
    const request: MatchWorkerRequest = {
      type: 'match',
      requestId: 11,
      mode: 'run',
      confidence: 0.99,
      crops: [{
        id: 9,
        width: cropWidth,
        height: cropHeight,
        captureToNativeScaleX: 0.9375,
        captureToNativeScaleY: 0.9375,
        bgra: bgra.buffer,
      }],
      cancelBuffer: new SharedArrayBuffer(4),
    };
    const resultPromise = waitFor(worker, 11);
    worker.postMessage(request, [bgra.buffer]);
    const result = await resultPromise;

    assert.equal(result.type, 'result');
    if (result.type !== 'result') return;
    assert.equal(result.match?.mode, 'run');
    assert.equal(result.match?.templateWidth, target.width);
    assert.equal(result.match?.templateHeight, target.height);
    assert.ok(Math.abs((result.match?.x ?? -100) - expected.x) <= 1);
    assert.ok(Math.abs((result.match?.y ?? -100) - expected.y) <= 1);
  } finally {
    await worker.terminate();
  }
});

test('worker returns best-miss details only when match debugging is enabled', async () => {
  const workerPath = path.join(__dirname, '..', 'src', 'worker', 'match-worker.js');
  const worker = new Worker(workerPath, {
    env: { ...process.env, CURSOR_AUTO_RUNNER_DEBUG_MATCH: '1' },
  });
  try {
    const width = 12;
    const height = 10;
    const gray = templateData(width, height);
    const templateBuffer = gray.buffer.slice(0) as ArrayBuffer;
    const init: MatchWorkerRequest = {
      type: 'init',
      requestId: 20,
      templates: [
        { file: 'run.png', mode: 'run', theme: 'dark', width, height, data: templateBuffer },
      ],
    };
    const readyPromise = waitFor(worker, 20);
    worker.postMessage(init, [templateBuffer]);
    await readyPromise;

    const cropWidth = 96;
    const cropHeight = 72;
    const bgra = new Uint8Array(cropWidth * cropHeight * 4);
    for (let index = 0; index < cropWidth * cropHeight; index++) {
      const value = (index * 7 + Math.floor(index / cropWidth) * 11) % 90;
      const offset = index * 4;
      bgra[offset] = value;
      bgra[offset + 1] = value;
      bgra[offset + 2] = value;
      bgra[offset + 3] = 255;
    }
    const request: MatchWorkerRequest = {
      type: 'match',
      requestId: 21,
      mode: 'run',
      confidence: 0.99,
      crops: [{
        id: 12,
        width: cropWidth,
        height: cropHeight,
        captureToNativeScaleX: 0.9375,
        captureToNativeScaleY: 0.9375,
        bgra: bgra.buffer,
      }],
      cancelBuffer: new SharedArrayBuffer(4),
    };
    const resultPromise = waitFor(worker, 21);
    worker.postMessage(request, [bgra.buffer]);
    const result = await resultPromise;

    assert.equal(result.type, 'result');
    if (result.type !== 'result') return;
    assert.equal(result.match, null);
    assert.equal(result.bestMiss?.file, 'run.png');
    assert.equal(result.bestMiss?.captureToNativeScaleX, 0.9375);
    assert.equal(typeof result.bestMiss?.coarseScore, 'number');
    assert.equal(typeof result.bestMiss?.refinedScore, 'number');
  } finally {
    await worker.terminate();
  }
});

test('worker detects real Run, Always Run, and Allow capped fixtures', async () => {
  const workerPath = path.join(__dirname, '..', 'src', 'worker', 'match-worker.js');
  const worker = new Worker(workerPath);
  try {
    const cases = [
      { mode: 'run' as const, template: 'run-2.png', fixture: 'run-capped.png' },
      {
        mode: 'always-run' as const,
        template: 'always-run-2.png',
        fixture: 'always-run-capped.png',
      },
      { mode: 'allow' as const, template: 'allow.png', fixture: 'allow-capped.png' },
    ];
    const loaded = await Promise.all(
      cases.map(async (entry) => ({
        ...entry,
        image: await loadTemplate(
          path.join(process.cwd(), 'assets', 'templates', 'dark', entry.template)
        ),
      }))
    );
    const templates = loaded.map((entry) => ({
      file: entry.template,
      mode: entry.mode,
      theme: 'dark' as const,
      width: entry.image.width,
      height: entry.image.height,
      data: entry.image.data.buffer.slice(0) as ArrayBuffer,
    }));
    const init: MatchWorkerRequest = {
      type: 'init',
      requestId: 30,
      templates,
    };
    const readyPromise = waitFor(worker, 30);
    worker.postMessage(init, templates.map((template) => template.data));
    await readyPromise;

    let requestId = 31;
    for (const entry of cases) {
      const fixture = await loadBgraFixture(
        path.join(process.cwd(), 'tests', 'fixtures', entry.fixture)
      );
      const cropWidth = 800;
      const cropHeight = 500;
      const bgra = new Uint8Array(cropWidth * cropHeight * 4);
      for (let index = 0; index < cropWidth * cropHeight; index++) {
        const offset = index * 4;
        bgra[offset] = 24;
        bgra[offset + 1] = 24;
        bgra[offset + 2] = 24;
        bgra[offset + 3] = 255;
      }
      const expected = { x: 683, y: 411 };
      for (let y = 0; y < fixture.height; y++) {
        for (let x = 0; x < fixture.width; x++) {
          const offset = ((expected.y + y) * cropWidth + expected.x + x) * 4;
          const sourceOffset = (y * fixture.width + x) * 4;
          bgra[offset] = fixture.bgra[sourceOffset];
          bgra[offset + 1] = fixture.bgra[sourceOffset + 1];
          bgra[offset + 2] = fixture.bgra[sourceOffset + 2];
          bgra[offset + 3] = fixture.bgra[sourceOffset + 3];
        }
      }
      if (entry.mode === 'always-run') {
        const run = await loadBgraFixture(
          path.join(process.cwd(), 'tests', 'fixtures', 'run-capped.png')
        );
        const runPosition = { x: 751, y: 410 };
        for (let y = 0; y < run.height; y++) {
          for (let x = 0; x < run.width; x++) {
            const offset = ((runPosition.y + y) * cropWidth + runPosition.x + x) * 4;
            const sourceOffset = (y * run.width + x) * 4;
            bgra[offset] = run.bgra[sourceOffset];
            bgra[offset + 1] = run.bgra[sourceOffset + 1];
            bgra[offset + 2] = run.bgra[sourceOffset + 2];
            bgra[offset + 3] = run.bgra[sourceOffset + 3];
          }
        }
      }
      const request: MatchWorkerRequest = {
        type: 'match',
        requestId,
        mode: entry.mode,
        confidence: 0.88,
        crops: [{
          id: requestId,
          width: cropWidth,
          height: cropHeight,
          captureToNativeScaleX: 0.75,
          captureToNativeScaleY: 0.75,
          bgra: bgra.buffer,
        }],
        cancelBuffer: new SharedArrayBuffer(4),
      };
      const resultPromise = waitFor(worker, requestId);
      worker.postMessage(request, [bgra.buffer]);
      const result = await resultPromise;
      assert.equal(result.type, 'result');
      if (result.type === 'result') {
        assert.equal(result.match?.mode, entry.mode);
        assert.ok(Math.abs((result.match?.x ?? -100) - expected.x) <= 1);
        assert.ok(Math.abs((result.match?.y ?? -100) - expected.y) <= 1);
      }
      requestId++;
    }
  } finally {
    await worker.terminate();
  }
});

test('worker safely anchors all actions in cluttered full-window fixtures', async () => {
  const workerPath = path.join(__dirname, '..', 'src', 'worker', 'match-worker.js');
  const worker = new Worker(workerPath);
  try {
    const catalog = [
      { mode: 'run' as const, template: 'run-2.png' },
      { mode: 'always-run' as const, template: 'always-run-2.png' },
      { mode: 'allow' as const, template: 'allow.png' },
    ];
    const templates = await Promise.all(
      catalog.map(async (entry) => {
        const image = await loadTemplate(
          path.join(process.cwd(), 'assets', 'templates', 'dark', entry.template)
        );
        return {
          file: entry.template,
          mode: entry.mode,
          theme: 'dark' as const,
          width: image.width,
          height: image.height,
          data: image.data.buffer.slice(0) as ArrayBuffer,
        };
      })
    );
    const init: MatchWorkerRequest = { type: 'init', requestId: 40, templates };
    const readyPromise = waitFor(worker, 40);
    worker.postMessage(init, templates.map((template) => template.data));
    await readyPromise;

    const cases = [
      {
        requestMode: 'run' as const,
        fixture: 'cursor-run-always-window.png',
        expectedMode: 'run' as const,
        expected: { x: 914, y: 524 },
        path: 'accent' as const,
      },
      {
        requestMode: 'always-run' as const,
        fixture: 'cursor-run-always-window.png',
        expectedMode: 'always-run' as const,
        expected: { x: 721, y: 525 },
        path: 'anchored-row' as const,
      },
      {
        requestMode: 'run' as const,
        fixture: 'cursor-allow-window.png',
        expectedMode: 'allow' as const,
        expected: { x: 895, y: 513 },
        path: 'accent' as const,
      },
      {
        requestMode: 'always-run' as const,
        fixture: 'cursor-allow-window.png',
        expectedMode: 'allow' as const,
        expected: { x: 895, y: 513 },
        path: 'accent' as const,
      },
    ];

    let requestId = 41;
    for (const entry of cases) {
      const fixture = await loadBgraFixture(
        path.join(process.cwd(), 'tests', 'fixtures', entry.fixture)
      );
      if (entry.fixture === 'cursor-run-always-window.png') {
        const sameRowDistractor = await loadBgraFixture(
          path.join(process.cwd(), 'tests', 'fixtures', 'always-run-capped.png')
        );
        for (let y = 0; y < sameRowDistractor.height; y++) {
          for (let x = 0; x < sameRowDistractor.width; x++) {
            const targetOffset = ((525 + y) * fixture.width + 286 + x) * 4;
            const sourceOffset = (y * sameRowDistractor.width + x) * 4;
            fixture.bgra[targetOffset] = sameRowDistractor.bgra[sourceOffset];
            fixture.bgra[targetOffset + 1] = sameRowDistractor.bgra[sourceOffset + 1];
            fixture.bgra[targetOffset + 2] = sameRowDistractor.bgra[sourceOffset + 2];
            fixture.bgra[targetOffset + 3] = sameRowDistractor.bgra[sourceOffset + 3];
          }
        }
      }
      const bgraBuffer = fixture.bgra.buffer as ArrayBuffer;
      const request: MatchWorkerRequest = {
        type: 'match',
        requestId,
        mode: entry.requestMode,
        confidence: 0.88,
        crops: [{
          id: requestId,
          width: fixture.width,
          height: fixture.height,
          captureToNativeScaleX: 0.75,
          captureToNativeScaleY: 0.75,
          bgra: bgraBuffer,
        }],
        cancelBuffer: new SharedArrayBuffer(4),
      };
      const resultPromise = waitFor(worker, requestId);
      worker.postMessage(request, [bgraBuffer]);
      const result = await resultPromise;

      assert.equal(result.type, 'result');
      if (result.type !== 'result') continue;
      assert.equal(result.match?.mode, entry.expectedMode);
      assert.equal(result.match?.path, entry.path);
      assert.ok(Math.abs((result.match?.x ?? -100) - entry.expected.x) <= 1);
      assert.ok(Math.abs((result.match?.y ?? -100) - entry.expected.y) <= 1);
      assert.ok(result.matchMs < 750, `full-window match took ${result.matchMs.toFixed(1)} ms`);
      requestId++;
    }

    const noButton = await loadBgraFixture(
      path.join(process.cwd(), 'tests', 'fixtures', 'cursor-allow-window.png')
    );
    for (let y = 505; y < 538; y++) {
      for (let x = 885; x < 940; x++) {
        const offset = (y * noButton.width + x) * 4;
        noButton.bgra[offset] = 24;
        noButton.bgra[offset + 1] = 24;
        noButton.bgra[offset + 2] = 24;
        noButton.bgra[offset + 3] = 255;
      }
    }
    const noButtonBuffer = noButton.bgra.buffer as ArrayBuffer;
    const noButtonRequest: MatchWorkerRequest = {
      type: 'match',
      requestId,
      mode: 'always-run',
      confidence: 0.88,
      crops: [{
        id: requestId,
        width: noButton.width,
        height: noButton.height,
        captureToNativeScaleX: 0.75,
        captureToNativeScaleY: 0.75,
        bgra: noButtonBuffer,
      }],
      cancelBuffer: new SharedArrayBuffer(4),
    };
    const noButtonPromise = waitFor(worker, requestId);
    worker.postMessage(noButtonRequest, [noButtonBuffer]);
    const noButtonResult = await noButtonPromise;
    assert.equal(noButtonResult.type, 'result');
    if (noButtonResult.type === 'result') {
      assert.equal(noButtonResult.match, null);
      assert.ok(
        noButtonResult.matchMs < 500,
        `colored no-button path took ${noButtonResult.matchMs.toFixed(1)} ms`
      );
    }
  } finally {
    await worker.terminate();
  }
});

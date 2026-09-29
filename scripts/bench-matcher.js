/* Synthetic matcher benchmark: CPU work stays in a worker while this process
 * records event-loop heartbeat latency. No screen capture or clicks occur. */
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { performance } = require('node:perf_hooks');

const worker = new Worker(path.join(__dirname, '..', 'dist', 'src', 'worker', 'match-worker.js'));
let requestId = 0;

function request(message, transfer = []) {
  const id = ++requestId;
  message.requestId = id;
  return new Promise((resolve, reject) => {
    const onMessage = (response) => {
      if (response.requestId !== id) return;
      cleanup();
      response.type === 'error' ? reject(new Error(response.message)) : resolve(response);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      worker.off('message', onMessage);
      worker.off('error', onError);
    };
    worker.on('message', onMessage);
    worker.on('error', onError);
    worker.postMessage(message, transfer);
  });
}

function template(mode, seed, dimensions) {
  const width = dimensions?.width ?? (mode === 'always-run' ? 78 : 54);
  const height = dimensions?.height ?? 24;
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data[y * width + x] = (x * 19 + y * 37 + seed) % 255;
  }
  return { file: `${mode}-${seed}.png`, mode, theme: 'dark', width, height, data: data.buffer };
}

function noButtonCrop(width, height) {
  const bgra = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const value = (i * 13 + Math.floor(i / width) * 17) % 80;
    const offset = i * 4;
    bgra[offset] = value;
    bgra[offset + 1] = value;
    bgra[offset + 2] = value;
    bgra[offset + 3] = 255;
  }
  return bgra;
}

async function matchCrop(mode, width, height, bgra) {
  const startedAt = performance.now();
  const result = await request(
    {
      type: 'match',
      mode,
      confidence: 0.88,
      crops: [{
        id: 0,
        width,
        height,
        captureToNativeScaleX: 1,
        captureToNativeScaleY: 1,
        bgra: bgra.buffer,
      }],
      cancelBuffer: new SharedArrayBuffer(4),
    },
    [bgra.buffer]
  );
  return { result, wallMs: performance.now() - startedAt };
}

function percentile(values, value) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor((value / 100) * ordered.length))];
}

(async () => {
  try {
    const templates = [
      template('always-run', 1),
      template('always-run', 2),
      template('run', 3),
      template('run', 4),
    ];
    const ready = await request(
      { type: 'init', templates },
      templates.map((item) => item.data)
    );

    const width = 1280;
    const height = 720;
    const heartbeat = [];
    let expected = performance.now() + 10;
    const timer = setInterval(() => {
      const now = performance.now();
      heartbeat.push(Math.max(0, now - expected));
      expected = now + 10;
    }, 10);
    const largeNoButton = await matchCrop(
      'always-run',
      width,
      height,
      noButtonCrop(width, height)
    );

    const tinyTemplates = [
      template('always-run', 11, { width: 52, height: 16 }),
      template('always-run', 12, { width: 52, height: 16 }),
      template('run', 13, { width: 40, height: 18 }),
      template('run', 14, { width: 40, height: 18 }),
    ];
    const target = {
      width: tinyTemplates[2].width,
      height: tinyTemplates[2].height,
      data: new Float32Array(tinyTemplates[2].data.slice(0)),
    };
    const tinyReady = await request(
      { type: 'init', templates: tinyTemplates },
      tinyTemplates.map((item) => item.data)
    );
    const tinyNoButton = await matchCrop('always-run', width, height, noButtonCrop(width, height));

    const matchedBgra = noButtonCrop(width, height);
    const targetPosition = { x: 947, y: 571 };
    for (let y = 0; y < target.height; y++) {
      for (let x = 0; x < target.width; x++) {
        const value = Math.round(target.data[y * target.width + x]);
        const offset = ((targetPosition.y + y) * width + targetPosition.x + x) * 4;
        matchedBgra[offset] = value;
        matchedBgra[offset + 1] = value;
        matchedBgra[offset + 2] = value;
      }
    }
    const tinyMatch = await matchCrop('run', width, height, matchedBgra);
    clearInterval(timer);

    const summary = {
      templateCount: ready.templateCount,
      variantCount: largeNoButton.result.variantCount,
      largeNoButtonWallMs: Number(largeNoButton.wallMs.toFixed(1)),
      largeNoButtonMatchMs: Number(largeNoButton.result.matchMs.toFixed(1)),
      tinyTemplateCount: tinyReady.templateCount,
      tinyNoButtonWallMs: Number(tinyNoButton.wallMs.toFixed(1)),
      tinyNoButtonMatchMs: Number(tinyNoButton.result.matchMs.toFixed(1)),
      tinyMatchWallMs: Number(tinyMatch.wallMs.toFixed(1)),
      tinyMatchMs: Number(tinyMatch.result.matchMs.toFixed(1)),
      tinyMatchPath: tinyMatch.result.match?.path ?? null,
      tinyMatchPyramid: tinyMatch.result.match?.pyramid ?? null,
      heartbeatP50Ms: Number(percentile(heartbeat, 50).toFixed(1)),
      heartbeatP95Ms: Number(percentile(heartbeat, 95).toFixed(1)),
      heartbeatMaxMs: Number(Math.max(0, ...heartbeat).toFixed(1)),
      workerHeapMiB: Number((tinyMatch.result.workerHeapBytes / 1024 / 1024).toFixed(1)),
    };
    console.log(JSON.stringify(summary, null, 2));
    if (summary.largeNoButtonMatchMs > 2000 || summary.tinyNoButtonMatchMs > 2000) {
      throw new Error(
        `no-button match exceeded 2000 ms CI budget: large=${summary.largeNoButtonMatchMs}, tiny=${summary.tinyNoButtonMatchMs}`
      );
    }
    if (
      !tinyMatch.result.match ||
      Math.abs(tinyMatch.result.match.x - targetPosition.x) > 1 ||
      Math.abs(tinyMatch.result.match.y - targetPosition.y) > 1 ||
      summary.tinyMatchPyramid !== 'half'
    ) {
      throw new Error(`tiny-template match failed: ${JSON.stringify(tinyMatch.result.match)}`);
    }
    if (summary.tinyMatchMs > 1000) {
      throw new Error(`tiny-template match exceeded 1000 ms CI budget: ${summary.tinyMatchMs}`);
    }
    if (summary.heartbeatP95Ms > 50 || summary.heartbeatMaxMs > 100) {
      throw new Error(
        `main-thread heartbeat exceeded budget: p95=${summary.heartbeatP95Ms}, max=${summary.heartbeatMaxMs}`
      );
    }
  } finally {
    await worker.terminate();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

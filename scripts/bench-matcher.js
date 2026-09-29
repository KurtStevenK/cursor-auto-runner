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

function template(mode, seed) {
  const width = mode === 'always-run' ? 78 : 54;
  const height = 24;
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data[y * width + x] = (x * 19 + y * 37 + seed) % 255;
  }
  return { file: `${mode}-${seed}.png`, mode, theme: 'dark', width, height, data: data.buffer };
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
    const bgra = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const value = (i * 13 + Math.floor(i / width) * 17) % 80;
      const offset = i * 4;
      bgra[offset] = value;
      bgra[offset + 1] = value;
      bgra[offset + 2] = value;
      bgra[offset + 3] = 255;
    }

    const heartbeat = [];
    let expected = performance.now() + 10;
    const timer = setInterval(() => {
      const now = performance.now();
      heartbeat.push(Math.max(0, now - expected));
      expected = now + 10;
    }, 10);
    const startedAt = performance.now();
    const result = await request(
      {
        type: 'match',
        mode: 'always-run',
        confidence: 0.88,
        crops: [{ id: 0, width, height, bgra: bgra.buffer }],
        cancelBuffer: new SharedArrayBuffer(4),
      },
      [bgra.buffer]
    );
    const wallMs = performance.now() - startedAt;
    clearInterval(timer);

    const summary = {
      templateCount: ready.templateCount,
      variantCount: result.variantCount,
      wallMs: Number(wallMs.toFixed(1)),
      workerMatchMs: Number(result.matchMs.toFixed(1)),
      heartbeatP50Ms: Number(percentile(heartbeat, 50).toFixed(1)),
      heartbeatP95Ms: Number(percentile(heartbeat, 95).toFixed(1)),
      heartbeatMaxMs: Number(Math.max(0, ...heartbeat).toFixed(1)),
      workerHeapMiB: Number((result.workerHeapBytes / 1024 / 1024).toFixed(1)),
    };
    console.log(JSON.stringify(summary, null, 2));
    if (summary.workerMatchMs > 2000) {
      throw new Error(`worker match exceeded 2000 ms CI budget: ${summary.workerMatchMs}`);
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

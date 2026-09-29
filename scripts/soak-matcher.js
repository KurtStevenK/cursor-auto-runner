/* Long-running worker soak. Safe: uses generated pixels, never captures or clicks. */
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { performance } = require('node:perf_hooks');

const durationMinutes = Number(process.env.SOAK_MINUTES || 30);
const intervalMs = Number(process.env.SOAK_INTERVAL_MS || 4000);
const deadline = performance.now() + durationMinutes * 60_000;
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
  for (let i = 0; i < data.length; i++) data[i] = (i * 31 + seed * 17) % 255;
  return { file: `${mode}-${seed}.png`, mode, theme: 'dark', width, height, data: data.buffer };
}

function makeCrop(iteration) {
  const width = 1280;
  const height = 720;
  const bgra = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const value = (i * 13 + iteration * 7) % 80;
    const offset = i * 4;
    bgra[offset] = value;
    bgra[offset + 1] = value;
    bgra[offset + 2] = value;
    bgra[offset + 3] = 255;
  }
  return {
    id: 0,
    width,
    height,
    captureToNativeScaleX: 1,
    captureToNativeScaleY: 1,
    bgra: bgra.buffer,
  };
}

function percentile(values, percentileValue) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((percentileValue / 100) * sorted.length))];
}

(async () => {
  const templates = [
    template('always-run', 1),
    template('always-run', 2),
    template('run', 3),
    template('run', 4),
  ];
  await request({ type: 'init', templates }, templates.map((entry) => entry.data));

  const heartbeat = [];
  let expected = performance.now() + 20;
  const heartbeatTimer = setInterval(() => {
    const now = performance.now();
    heartbeat.push(Math.max(0, now - expected));
    expected = now + 20;
  }, 20);

  const heapSamples = [];
  const matchSamples = [];
  let iterations = 0;
  while (performance.now() < deadline) {
    const crop = makeCrop(iterations);
    const response = await request(
      {
        type: 'match',
        mode: 'always-run',
        confidence: 0.88,
        crops: [crop],
        cancelBuffer: new SharedArrayBuffer(4),
      },
      [crop.bgra]
    );
    heapSamples.push(response.workerHeapBytes);
    matchSamples.push(response.matchMs);
    iterations++;
    const remaining = deadline - performance.now();
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));
  }
  clearInterval(heartbeatTimer);

  const firstHeap = heapSamples[0] || 0;
  const lastHeap = heapSamples[heapSamples.length - 1] || 0;
  const summary = {
    durationMinutes,
    iterations,
    matchP95Ms: Number(percentile(matchSamples, 95).toFixed(1)),
    heartbeatP99Ms: Number(percentile(heartbeat, 99).toFixed(1)),
    heartbeatMaxMs: Number(Math.max(0, ...heartbeat).toFixed(1)),
    firstWorkerHeapMiB: Number((firstHeap / 1024 / 1024).toFixed(1)),
    lastWorkerHeapMiB: Number((lastHeap / 1024 / 1024).toFixed(1)),
    workerHeapGrowthMiB: Number(((lastHeap - firstHeap) / 1024 / 1024).toFixed(1)),
  };
  console.log(JSON.stringify(summary, null, 2));

  if (summary.heartbeatP99Ms > 50) throw new Error(`heartbeat p99 exceeded 50 ms: ${summary.heartbeatP99Ms}`);
  if (lastHeap - firstHeap > 32 * 1024 * 1024) throw new Error('worker heap grew by more than 32 MiB');
})()
  .finally(() => worker.terminate())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

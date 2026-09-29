/* Post-package smoke: run real button pixels through the exact unpacked worker. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const asar = require('@electron/asar');
const Jimp = require('jimp');

const resourcesPath = path.join(__dirname, '..', 'release', 'win-unpacked', 'resources');
const workerPath = path.join(
  resourcesPath,
  'app.asar.unpacked',
  'dist',
  'src',
  'worker',
  'match-worker.js'
);
const corePath = path.join(path.dirname(workerPath), 'matcher-core.js');
const archivePath = path.join(resourcesPath, 'app.asar');
assert.equal(fs.existsSync(workerPath), true, `missing packaged worker: ${workerPath}`);
assert.equal(fs.existsSync(corePath), true, `missing packaged matcher core: ${corePath}`);
assert.equal(fs.existsSync(archivePath), true, `missing packaged app archive: ${archivePath}`);
const packagedTemplates = asar
  .listPackage(archivePath)
  .map((entry) => entry.replaceAll('\\', '/').replace(/^\/+/, ''))
  .filter((entry) => entry.startsWith('assets/templates/') && entry.endsWith('.png'))
  .sort();
assert.deepEqual(packagedTemplates, [
  'assets/templates/dark/allow.png',
  'assets/templates/dark/always-run-2.png',
  'assets/templates/dark/always-run.png',
  'assets/templates/dark/run-2.png',
  'assets/templates/dark/run.png',
]);

function grayscale(image) {
  const { width, height, data } = image.bitmap;
  const gray = new Float32Array(width * height);
  for (let index = 0; index < gray.length; index++) {
    const offset = index * 4;
    gray[index] =
      0.299 * data[offset] +
      0.587 * data[offset + 1] +
      0.114 * data[offset + 2];
  }
  return { width, height, data: gray };
}

function bgra(image) {
  const { width, height, data } = image.bitmap;
  const pixels = new Uint8Array(data.length);
  for (let offset = 0; offset < data.length; offset += 4) {
    pixels[offset] = data[offset + 2];
    pixels[offset + 1] = data[offset + 1];
    pixels[offset + 2] = data[offset];
    pixels[offset + 3] = data[offset + 3];
  }
  return { width, height, data: pixels };
}

async function imageFromArchive(relativePath) {
  const archiveEntry = relativePath.split('/').join(path.sep);
  return grayscale(await Jimp.read(asar.extractFile(archivePath, archiveEntry)));
}

const worker = new Worker(workerPath);
let requestId = 0;

function request(message, transfer = []) {
  const id = ++requestId;
  message.requestId = id;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`packaged worker request ${id} timed out`));
    }, 5000);
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
      clearTimeout(timeout);
      worker.off('message', onMessage);
      worker.off('error', onError);
    };
    worker.on('message', onMessage);
    worker.on('error', onError);
    worker.postMessage(message, transfer);
  });
}

(async () => {
  const templateEntries = [
    { mode: 'run', template: 'run-2.png', fixture: 'run-capped.png' },
    { mode: 'always-run', template: 'always-run-2.png', fixture: 'always-run-capped.png' },
    { mode: 'allow', template: 'allow.png', fixture: 'allow-capped.png' },
  ];
  const loaded = await Promise.all(
    templateEntries.map(async (entry) => ({
      ...entry,
      image: await imageFromArchive(`assets/templates/dark/${entry.template}`),
    }))
  );
  const templates = loaded.map((entry) => ({
    file: entry.template,
    mode: entry.mode,
    theme: 'dark',
    width: entry.image.width,
    height: entry.image.height,
    data: entry.image.data.buffer.slice(0),
  }));
  const ready = await request(
    { type: 'init', templates },
    templates.map((template) => template.data)
  );
  assert.equal(ready.type, 'ready');
  assert.equal(ready.templateCount, 3);

  const cases = [
    {
      requestMode: 'run',
      expectedMode: 'run',
      fixture: 'cursor-run-always-window.png',
      expected: { x: 914, y: 524 },
      path: 'accent',
    },
    {
      requestMode: 'always-run',
      expectedMode: 'always-run',
      fixture: 'cursor-run-always-window.png',
      expected: { x: 721, y: 525 },
      path: 'anchored-row',
    },
    {
      requestMode: 'run',
      expectedMode: 'allow',
      fixture: 'cursor-allow-window.png',
      expected: { x: 895, y: 513 },
      path: 'accent',
    },
    {
      requestMode: 'always-run',
      expectedMode: 'allow',
      fixture: 'cursor-allow-window.png',
      expected: { x: 895, y: 513 },
      path: 'accent',
    },
  ];
  for (const entry of cases) {
    const fixture = bgra(
      await Jimp.read(path.join(__dirname, '..', 'tests', 'fixtures', entry.fixture))
    );
    const result = await request(
      {
        type: 'match',
        mode: entry.requestMode,
        confidence: 0.88,
        crops: [{
          id: 1,
          width: fixture.width,
          height: fixture.height,
          captureToNativeScaleX: 0.75,
          captureToNativeScaleY: 0.75,
          bgra: fixture.data.buffer,
        }],
        cancelBuffer: new SharedArrayBuffer(4),
      },
      [fixture.data.buffer]
    );
    assert.equal(result.type, 'result');
    assert.equal(result.match?.mode, entry.expectedMode);
    assert.equal(result.match?.path, entry.path);
    assert.ok(Math.abs(result.match.x - entry.expected.x) <= 1);
    assert.ok(Math.abs(result.match.y - entry.expected.y) <= 1);
  }

  console.log('PACKAGED MATCHER OK: Run, Always Run, and Allow', workerPath);
})()
  .finally(() => worker.terminate())
  .catch((error) => {
    console.error('PACKAGED WORKER FAILED', error);
    process.exitCode = 1;
  });

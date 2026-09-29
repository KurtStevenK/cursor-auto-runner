/* Post-package smoke: load the exact worker entry from app.asar.unpacked. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

const workerPath = path.join(
  __dirname,
  '..',
  'release',
  'win-unpacked',
  'resources',
  'app.asar.unpacked',
  'dist',
  'src',
  'worker',
  'match-worker.js'
);
const corePath = path.join(path.dirname(workerPath), 'matcher-core.js');
assert.equal(fs.existsSync(workerPath), true, `missing packaged worker: ${workerPath}`);
assert.equal(fs.existsSync(corePath), true, `missing packaged matcher core: ${corePath}`);

const worker = new Worker(workerPath);
const timeout = setTimeout(() => {
  console.error('PACKAGED WORKER FAILED: startup timeout');
  void worker.terminate();
  process.exitCode = 1;
}, 5000);

worker.once('error', (error) => {
  clearTimeout(timeout);
  console.error('PACKAGED WORKER FAILED', error);
  process.exitCode = 1;
});
worker.once('message', async (response) => {
  clearTimeout(timeout);
  assert.equal(response.type, 'ready');
  assert.equal(response.templateCount, 0);
  console.log('PACKAGED WORKER OK', workerPath);
  await worker.terminate();
});
worker.postMessage({ type: 'init', requestId: 1, templates: [] });

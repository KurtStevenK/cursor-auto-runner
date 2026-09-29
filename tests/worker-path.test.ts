import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { resolveMatchWorkerPath } from '../src/shared/worker-path';

test('development worker path targets the compiled worker directory', () => {
  const mainDirectory = path.join('project', 'dist', 'src', 'main');
  assert.equal(
    resolveMatchWorkerPath(mainDirectory, false),
    path.join('project', 'dist', 'src', 'worker', 'match-worker.js')
  );
});

test('packaged worker path resolves into app.asar.unpacked', () => {
  const mainDirectory = path.join(
    path.parse(process.cwd()).root,
    'resources',
    'app.asar',
    'dist',
    'src',
    'main'
  );
  const resolved = resolveMatchWorkerPath(mainDirectory, true);

  assert.match(resolved, /app\.asar\.unpacked/);
  assert.equal(
    resolved.endsWith(path.join('dist', 'src', 'worker', 'match-worker.js')),
    true
  );
});

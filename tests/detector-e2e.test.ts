import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { Detector, type Matcher } from '../src/main/detector';
import { MatchWorkerClient } from '../src/main/match-worker-client';
import type {
  CaptureProvider,
  DisplayInfo,
  WindowInfo,
  WindowProvider,
} from '../src/main/detector';
import { loadBgraFixture, loadTemplate } from './helpers/load-template';

const ROOT = process.cwd();
const fixture = (name: string) => path.join(ROOT, 'tests', 'fixtures', name);

const WINDOW: WindowInfo = {
  left: 0,
  top: 0,
  width: 1280,
  height: 720,
  title: 'Cursor',
  focus: async () => true,
};
const DISPLAY: DisplayInfo = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1280, height: 720 },
  size: { width: 1280, height: 720 },
  scaleFactor: 1,
};

async function setup(getBgra: () => Promise<{ width: number; height: number; bgra: Uint8Array }>) {
  const windows: WindowProvider = { list: async () => [WINDOW] };
  const capture: CaptureProvider = {
    async captureCrops() {
      const image = await getBgra();
      // Fresh copy per call: the worker transfers (detaches) the buffer.
      const bgra = image.bgra.slice().buffer as ArrayBuffer;
      return {
        sourceMissCount: 0,
        crops: [
          {
            id: 0,
            payload: {
              id: 0,
              width: image.width,
              height: image.height,
              captureToNativeScaleX: 0.75,
              captureToNativeScaleY: 0.75,
              bgra,
            },
            display: DISPLAY,
            captureScaleX: 1,
            captureScaleY: 1,
            cropX: 0,
            cropY: 0,
            windowKey: `${WINDOW.title}\0${WINDOW.left}\0${WINDOW.top}`,
            focus: WINDOW.focus,
          },
        ],
      };
    },
  };
  const real = new MatchWorkerClient({
    workerPath: path.join(__dirname, '..', 'src', 'worker', 'match-worker.js'),
  });
  let matchCalls = 0;
  const matcher: Matcher = {
    initialize: (templates) => real.initialize(templates),
    match: (...args) => {
      matchCalls++;
      return real.match(...args);
    },
    cancelCurrent: () => real.cancelCurrent(),
    dispose: () => real.dispose(),
  };
  const detector = new Detector({
    windows,
    capture,
    matcher,
    displays: () => [DISPLAY],
    templateDirs: () => [path.join(ROOT, 'assets', 'templates')],
    loadImage: loadTemplate,
  });
  return { detector, matchCalls: () => matchCalls };
}

function insideWindow(x: number, y: number): boolean {
  return x >= WINDOW.left && x <= WINDOW.left + WINDOW.width && y >= WINDOW.top && y <= WINDOW.top + WINDOW.height;
}

test('detector finds Run and Always run in a captured Cursor window', async () => {
  const image = await loadBgraFixture(fixture('cursor-run-always-window.png'));
  // Same distractor as the worker test: an always-run button on the Run row.
  const distractor = await loadBgraFixture(fixture('always-run-capped.png'));
  for (let y = 0; y < distractor.height; y++) {
    for (let x = 0; x < distractor.width; x++) {
      const target = ((525 + y) * image.width + 286 + x) * 4;
      const source = (y * distractor.width + x) * 4;
      for (let c = 0; c < 4; c++) image.bgra[target + c] = distractor.bgra[source + c];
    }
  }
  const { detector } = await setup(async () => image);
  try {
    const run = await detector.detect('run', 0.88);
    assert.ok(run, 'expected a run match');
    assert.equal(run.mode, 'run');
    assert.ok(insideWindow(run.x, run.y), `(${run.x}, ${run.y}) outside window`);
    assert.equal(detector.windowFound, true);
    assert.equal(detector.hasTemplates(), true);

    const always = await detector.detect('always-run', 0.88);
    assert.ok(always, 'expected an always-run match');
    assert.equal(always.mode, 'always-run');
    assert.ok(insideWindow(always.x, always.y));
  } finally {
    await detector.dispose();
  }
});

test('detector skips matching when a missed crop is unchanged', async () => {
  const gray = {
    width: 400,
    height: 300,
    bgra: new Uint8Array(400 * 300 * 4).fill(128),
  };
  const { detector, matchCalls } = await setup(async () => gray);
  try {
    assert.equal(await detector.detect('run', 0.88), null);
    assert.equal(matchCalls(), 1);
    assert.equal(detector.lastMetrics.skippedUnchanged, 0);

    assert.equal(await detector.detect('run', 0.88), null);
    assert.equal(matchCalls(), 1, 'matcher must not run on an unchanged crop');
    assert.ok(detector.lastMetrics.skippedUnchanged >= 1);
  } finally {
    await detector.dispose();
  }
});

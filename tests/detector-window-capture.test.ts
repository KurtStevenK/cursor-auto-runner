import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { MatchWorkerClient } from '../src/main/match-worker-client';
import { Detector, type Matcher } from '../src/main/detector';
import type {
  CaptureProvider,
  CropContext,
  DisplayInfo,
  WindowInfo,
  WindowProvider,
} from '../src/main/detector';
import { loadTemplate } from './helpers/load-template';
import type { CropPayload } from '../src/shared/match-protocol';

const WINDOW: WindowInfo = {
  left: 0,
  top: 0,
  width: 400,
  height: 300,
  title: 'Cursor',
  focus: async () => true,
};
const DISPLAY: DisplayInfo = {
  id: 1,
  bounds: { x: 0, y: 0, width: 400, height: 300 },
  size: { width: 400, height: 300 },
  scaleFactor: 1,
};
const KEY = `${WINDOW.title}\0${WINDOW.left}\0${WINDOW.top}`;

function crop(id: number, width: number, height: number): CropContext {
  return {
    id,
    payload: {
      id,
      width,
      height,
      captureToNativeScaleX: 1,
      captureToNativeScaleY: 1,
      bgra: new Uint8Array(width * height * 4).fill(100).buffer as ArrayBuffer,
    },
    display: DISPLAY,
    captureScaleX: 1,
    captureScaleY: 1,
    cropX: 0,
    cropY: 0,
    windowKey: KEY,
    focus: WINDOW.focus,
  };
}

async function run(useWindowCapture: (() => boolean) | undefined) {
  let windowCalls = 0;
  const matched: Array<{ id: number; width: number }> = [];
  const capture: CaptureProvider = {
    async captureCrops() {
      return { sourceMissCount: 0, crops: [crop(0, 400, 300)] };
    },
    async captureWindowCrops(_windows, startId) {
      windowCalls++;
      return [crop(startId, 800, 600)];
    },
  };
  const real = new MatchWorkerClient({
    workerPath: path.join(__dirname, '..', 'src', 'worker', 'match-worker.js'),
  });
  const matcher: Matcher = {
    initialize: (templates) => real.initialize(templates),
    match: (mode, conf, crops: CropPayload[]) => {
      for (const c of crops) matched.push({ id: c.id, width: c.width });
      return real.match(mode, conf, crops);
    },
    cancelCurrent: () => real.cancelCurrent(),
    dispose: () => real.dispose(),
  };
  const windows: WindowProvider = { list: async () => [WINDOW] };
  const detector = new Detector({
    windows,
    capture,
    matcher,
    displays: () => [DISPLAY],
    templateDirs: () => [path.join(process.cwd(), 'assets', 'templates')],
    loadImage: loadTemplate,
    useWindowCapture,
  });
  try {
    await detector.detect('run', 0.88).catch(() => null);
  } finally {
    await detector.dispose();
  }
  return { windowCalls, matched };
}

test('window capture is used when useWindowCapture returns true and replaces display crops', async () => {
  const r = await run(() => true);
  assert.equal(r.windowCalls, 1);
  assert.deepEqual(
    r.matched.map((c) => c.width),
    [800],
    'window crop replaces the display crop for the same window key'
  );
});

test('window capture is skipped when useWindowCapture returns false', async () => {
  const r = await run(() => false);
  assert.equal(r.windowCalls, 0);
  assert.deepEqual(
    r.matched.map((c) => c.width),
    [400]
  );
});

test('default follows the platform (darwin only)', async () => {
  const r = await run(undefined);
  assert.equal(r.windowCalls, process.platform === 'darwin' ? 1 : 0);
});

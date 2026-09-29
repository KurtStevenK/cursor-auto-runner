import test from 'node:test';
import assert from 'node:assert/strict';
import {
  capturePointToPhysical,
  captureRequestSize,
  captureToNativeScales,
} from '../src/main/capture-geometry';

test('capture sizing applies one uniform scale to a high-DPI display', () => {
  const request = captureRequestSize(
    { size: { width: 1024, height: 576 }, scaleFactor: 2 },
    1920,
    1080
  );

  assert.deepEqual(request, {
    width: 1920,
    height: 1080,
    nativeWidth: 2048,
    nativeHeight: 1152,
    downscale: 0.9375,
  });
});

test('capture sizing preserves an ultrawide aspect ratio', () => {
  const request = captureRequestSize(
    { size: { width: 3440, height: 1440 }, scaleFactor: 1 },
    1920,
    1080
  );

  assert.equal(request.width, 1920);
  assert.equal(request.height, 804);
  assert.ok(Math.abs(request.width / request.height - 3440 / 1440) < 0.002);
});

test('capture ratios and click coordinates map back to physical pixels', () => {
  const templateScale = captureToNativeScales(
    { width: 1920, height: 1080 },
    { width: 2048, height: 1152 }
  );
  assert.deepEqual(templateScale, { x: 0.9375, y: 0.9375 });

  const point = capturePointToPhysical(
    {
      bounds: { x: 0, y: 0, width: 1024, height: 576 },
      scaleFactor: 2,
    },
    { x: 1920 / 1024, y: 1080 / 576 },
    { x: 960, y: 540 }
  );
  assert.deepEqual(point, { x: 1024, y: 576 });
});

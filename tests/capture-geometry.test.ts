import test from 'node:test';
import assert from 'node:assert/strict';
import {
  capturePointToPhysical,
  captureRequestSize,
  captureToNativeScales,
  normalizeWindowRegionForDisplay,
  windowCapturePointToPhysical,
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

test('normalizeWindowRegionForDisplay scales physical nut regions on Retina', () => {
  const display = {
    bounds: { x: 0, y: 0, width: 1440, height: 900 },
    size: { width: 1440, height: 900 },
    scaleFactor: 2,
  };
  const normalized = normalizeWindowRegionForDisplay(
    { left: 200, top: 100, width: 2800, height: 1700 },
    display
  );
  assert.deepEqual(normalized, { left: 100, top: 50, width: 1400, height: 850 });
});

test('normalizeWindowRegionForDisplay leaves logical regions unchanged', () => {
  const display = {
    bounds: { x: 0, y: 0, width: 1440, height: 900 },
    size: { width: 1440, height: 900 },
    scaleFactor: 2,
  };
  const region = { left: 12, top: 34, width: 1200, height: 800 };
  assert.deepEqual(normalizeWindowRegionForDisplay(region, display), region);
});

test('windowCapturePointToPhysical maps window-local matches to physical pixels', () => {
  const point = windowCapturePointToPhysical(
    { left: 100, top: 50, width: 1200, height: 800 },
    { scaleFactor: 2 },
    { x: 2, y: 2 },
    { x: 200, y: 100 }
  );
  assert.deepEqual(point, { x: 400, y: 200 });
});

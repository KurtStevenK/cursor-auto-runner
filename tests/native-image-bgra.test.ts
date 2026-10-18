import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedBgraByteLength, repackBgraRows } from '../src/main/native-image-bgra';

test('expectedBgraByteLength is width * height * 4', () => {
  assert.equal(expectedBgraByteLength(10, 20), 800);
});

test('repackBgraRows strips row padding', () => {
  const width = 2;
  const height = 2;
  const stride = 12;
  const source = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dst = y * stride + x * 4;
      source[dst] = 10 + x;
      source[dst + 1] = 20 + y;
      source[dst + 2] = 30;
      source[dst + 3] = 255;
    }
  }
  const tight = repackBgraRows(source, width, height, stride);
  assert.equal(tight.byteLength, expectedBgraByteLength(width, height));
  assert.deepEqual(tight.subarray(0, 4), Uint8Array.from([10, 20, 30, 255]));
  assert.deepEqual(tight.subarray(4, 8), Uint8Array.from([11, 20, 30, 255]));
  assert.deepEqual(tight.subarray(8, 12), Uint8Array.from([10, 21, 30, 255]));
});

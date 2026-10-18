import test from 'node:test';
import assert from 'node:assert/strict';
import { CROP_HASH_PIXEL_STRIDE, hashBgra } from '../src/shared/crop-hash';

function makeBuffer(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i++) data[i] = (i * 31 + 7) & 0xff;
  return data;
}

test('identical buffers hash equal', () => {
  const a = makeBuffer(200, 100);
  const b = new Uint8Array(a);
  assert.equal(hashBgra(a, 200, 100), hashBgra(b, 200, 100));
});

test('a changed sampled pixel changes the hash', () => {
  const a = makeBuffer(200, 100);
  const b = new Uint8Array(a);
  const pixel = CROP_HASH_PIXEL_STRIDE * 10;
  b[pixel * 4] ^= 0xff;
  assert.notEqual(hashBgra(a, 200, 100), hashBgra(b, 200, 100));
});

test('different dimensions hash differently', () => {
  const a = makeBuffer(200, 100);
  assert.notEqual(hashBgra(a, 200, 100), hashBgra(a, 100, 200));
});

test('hashing a 1920x1080 crop is fast', () => {
  const a = makeBuffer(1920, 1080);
  let best = Infinity;
  for (let run = 0; run < 5; run++) {
    const start = performance.now();
    hashBgra(a, 1920, 1080);
    best = Math.min(best, performance.now() - start);
  }
  assert.ok(best < 20 * (Number(process.env.TEST_TIMING_SCALE) || 1), `best run took ${best.toFixed(2)} ms`);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { hashBgra } from '../src/shared/crop-hash';

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

test('a button-sized change anywhere changes the hash', () => {
  const w = 480;
  const h = 270;
  const a = makeBuffer(w, h);
  const base = hashBgra(a, w, h);
  const positions: Array<[number, number]> = [
    [0, 0],
    [w - 25, h - 10],
    [w - 25, 0],
    [0, h - 10],
    [3, 5],
    [211, 131],
    [61, 61],
    [122, 1],
    [300, 200],
    [457, 259],
  ];
  for (const [px, py] of positions) {
    const b = new Uint8Array(a);
    for (let y = py; y < py + 10; y++) {
      for (let x = px; x < px + 25; x++) b[(y * w + x) * 4 + 1] ^= 0x55;
    }
    assert.notEqual(hashBgra(b, w, h), base, `change at (${px}, ${py}) not detected`);
  }
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
  assert.ok(
    best < 20 * (Number(process.env.TEST_TIMING_SCALE) || 1),
    `best run took ${best.toFixed(2)} ms`
  );
  console.log(`hashBgra 1920x1080 best: ${best.toFixed(2)} ms`);
});

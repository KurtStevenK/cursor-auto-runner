import test from 'node:test';
import assert from 'node:assert/strict';
import { ModeController } from '../src/main/controller';

type Hit = { x: number; y: number; mode: 'run' | 'always-run'; focus: () => Promise<boolean> };
const hit = (x: number, y: number): Hit => ({ x, y, mode: 'run', focus: async () => true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setup(
  script: Array<Hit | null | Error>,
  opts: { pollIntervalMs?: number; cooldownMs?: number } = {}
) {
  const detectTimes: number[] = [];
  const clicks: Array<[number, number]> = [];
  const recorded: string[] = [];
  let i = 0;
  const detector = {
    windowFound: true,
    watchedKind: 'cursor' as const,
    cancelPending() {},
    async detect() {
      detectTimes.push(Date.now());
      const step = i < script.length ? script[i] : script[script.length - 1];
      i++;
      if (step instanceof Error) throw step;
      return step as never;
    },
  };
  let healthEvents = 0;
  const c = new ModeController(
    detector as never,
    { record: (m: string) => void recorded.push(m) } as never,
    { pollIntervalMs: 20, confidence: 0.9, cooldownMs: 10_000, retryDelayMs: 5, ...opts },
    undefined,
    undefined,
    undefined,
    () => void healthEvents++,
    async (x, y) => void clicks.push([x, y])
  );
  return { c, detectTimes, clicks, recorded, events: () => healthEvents };
}

test('a detect result triggers one click and a stats record', async () => {
  const t = setup([hit(100, 100), null]);
  t.c.set('run');
  await sleep(150);
  t.c.set('idle');
  assert.equal(t.clicks.length, 1);
  assert.deepEqual(t.recorded, ['run']);
  assert.ok(t.c.health.lastMatchAt !== null);
  assert.ok(t.events() > 0);
});

test('cooldown prevents a second click', async () => {
  const t = setup([hit(100, 100), null, hit(500, 500)], { cooldownMs: 10_000 });
  t.c.set('run');
  await sleep(300);
  t.c.set('idle');
  assert.equal(t.clicks.length, 1);
});

test('near-retry clicks again when the button is still within 80px, stops when it moved', async () => {
  const t = setup([hit(100, 100), hit(130, 100), hit(400, 400), null]);
  t.c.set('run');
  await sleep(200);
  t.c.set('idle');
  assert.deepEqual(t.clicks, [
    [100, 100],
    [130, 100],
  ]);
});

test("set('idle') stops the loop promptly", async () => {
  const t = setup([null]);
  t.c.set('run');
  await sleep(100);
  t.c.set('idle');
  await sleep(60); // let any in-flight iteration drain
  const n = t.detectTimes.length;
  await sleep(200);
  assert.equal(t.detectTimes.length, n);
});

test('consecutive detect errors back off exponentially', async () => {
  const orig = console.error;
  console.error = () => {};
  try {
    const t = setup([new Error('boom')], { pollIntervalMs: 20 });
    t.c.set('run');
    await sleep(900);
    t.c.set('idle');
    const gaps = t.detectTimes.slice(1).map((v, k) => v - t.detectTimes[k]);
    assert.ok(gaps.length >= 3, `gaps: ${gaps}`);
    assert.ok(gaps[2] > gaps[0] * 1.5, `gaps should grow: ${gaps}`);
    assert.ok(t.c.health.consecutiveErrors >= 3);
    assert.equal(t.c.health.lastError, 'boom');
    assert.ok(t.c.health.lastErrorAt !== null);
  } finally {
    console.error = orig;
  }
});

test('health resets after a successful detect', async () => {
  const orig = console.error;
  console.error = () => {};
  try {
    const t = setup([new Error('x'), new Error('x'), null], { pollIntervalMs: 20 });
    t.c.set('run');
    await sleep(400);
    t.c.set('idle');
    assert.equal(t.c.health.consecutiveErrors, 0);
    assert.ok(t.c.health.lastDetectAt !== null);
    assert.equal(t.c.health.lastError, 'x'); // last error is kept for display
  } finally {
    console.error = orig;
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { ModeController } from '../src/main/controller';

type Hit = { x: number; y: number; mode: 'run' | 'always-run'; focus: () => Promise<boolean> };
const hit = (x: number, y: number): Hit => ({ x, y, mode: 'run', focus: async () => true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setup(
  script: Array<Hit | null | Error>,
  opts: {
    pollIntervalMs?: number;
    cooldownMs?: number;
    focusBeforeClick?: boolean;
    pauseWhileTyping?: boolean;
  } = {},
  idleSeconds?: () => number,
  clicker?: (x: number, y: number) => Promise<void>
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
    clicker ?? (async (x, y) => void clicks.push([x, y])),
    idleSeconds
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

test('setConfidence and setCooldown apply live and are clamped', () => {
  const t = setup([null]);
  t.c.setConfidence(0.95);
  t.c.setCooldown(500);
  assert.equal((t.c as never as { opts: { confidence: number } }).opts.confidence, 0.95);
  assert.equal((t.c as never as { opts: { cooldownMs: number } }).opts.cooldownMs, 500);
  t.c.setConfidence(5);
  t.c.setCooldown(-1);
  assert.equal((t.c as never as { opts: { confidence: number } }).opts.confidence, 0.99);
  assert.equal((t.c as never as { opts: { cooldownMs: number } }).opts.cooldownMs, 0);
});

test('focus runs before the click by default and is skipped when disabled', async () => {
  let focuses = 0;
  const h: Hit = {
    x: 5,
    y: 5,
    mode: 'run',
    focus: async () => {
      focuses++;
      return true;
    },
  };
  const on = setup([h, null], {}, () => 60);
  on.c.set('run');
  await sleep(120);
  on.c.set('idle');
  assert.equal(on.clicks.length, 1);
  assert.equal(focuses, 1);

  focuses = 0;
  const off = setup([h, null], { focusBeforeClick: false }, () => 60);
  off.c.set('run');
  await sleep(120);
  off.c.set('idle');
  assert.equal(off.clicks.length, 1);
  assert.equal(focuses, 0);
});

test('pauseWhileTyping defers the click until the user is idle, without counting an error', async () => {
  let idle = 0.2;
  const t = setup([hit(10, 10)], { cooldownMs: 0 }, () => idle);
  t.c.set('run');
  await sleep(120);
  assert.equal(t.clicks.length, 0);
  assert.equal(t.recorded.length, 0);
  assert.equal(t.c.health.consecutiveErrors, 0);
  idle = 5;
  await sleep(120);
  t.c.set('idle');
  assert.ok(t.clicks.length >= 1);
});

test('pauseWhileTyping=false clicks even while the user is active', async () => {
  const t = setup([hit(10, 10), null], { pauseWhileTyping: false }, () => 0);
  t.c.set('run');
  await sleep(120);
  t.c.set('idle');
  assert.equal(t.clicks.length, 1);
});

test('idle 0 right after our own click does not block the repeat click', async () => {
  let clickedAt = 0;
  const t = setup(
    [hit(100, 100), hit(110, 100), null],
    { cooldownMs: 10_000 },
    () => (clickedAt && Date.now() - clickedAt < 1500 ? 0 : 5),
    async (x, y) => {
      clickedAt = Date.now();
      t.clicks.push([x, y]);
    }
  );
  t.c.set('run');
  await sleep(200);
  t.c.set('idle');
  assert.deepEqual(t.clicks, [
    [100, 100],
    [110, 100],
  ]);
});

test('idle 0 before any click still defers the click', async () => {
  const t = setup([hit(10, 10)], { cooldownMs: 0 }, () => 0);
  t.c.set('run');
  await sleep(120);
  t.c.set('idle');
  assert.equal(t.clicks.length, 0);
});

test('persistent click failures accumulate, back off, and are reported', async () => {
  const orig = console.error;
  console.error = () => {};
  try {
    const attempts: number[] = [];
    const t = setup(
      [hit(10, 10)],
      { cooldownMs: 0, pollIntervalMs: 20 },
      () => 60,
      async () => {
        attempts.push(Date.now());
        throw new Error('no accessibility');
      }
    );
    t.c.set('run');
    await sleep(500);
    t.c.set('idle');
    assert.ok(attempts.length >= 3, `attempts: ${attempts.length}`);
    assert.ok(t.c.health.consecutiveErrors >= 3);
    assert.equal(t.c.health.lastError, 'no accessibility');
    const gaps = attempts.slice(1).map((v, k) => v - attempts[k]);
    assert.ok(gaps[2] === undefined || gaps[1] > gaps[0], `gaps should grow: ${gaps}`);
  } finally {
    console.error = orig;
  }
});

import { nextPollIntervalMs, FAST_POLLS_AFTER_CLICK } from '../src/main/controller';

const ps = (o: Partial<Parameters<typeof nextPollIntervalMs>[0]> = {}) => ({
  baseMs: 1000,
  windowFound: true,
  idleSeconds: 0,
  fastPollsLeft: 0,
  ...o,
});

test('nextPollIntervalMs keeps the user interval in the normal case', () => {
  assert.equal(nextPollIntervalMs(ps()), 1000);
});

test('nextPollIntervalMs slows down without a window and when the user is away', () => {
  assert.equal(nextPollIntervalMs(ps({ windowFound: false })), 2000);
  assert.equal(nextPollIntervalMs(ps({ windowFound: false, baseMs: 4000 })), 4000);
  assert.equal(nextPollIntervalMs(ps({ idleSeconds: 301 })), 5000);
  assert.equal(nextPollIntervalMs(ps({ idleSeconds: 300 })), 1000);
  assert.equal(nextPollIntervalMs(ps({ idleSeconds: 600, baseMs: 6000 })), 6000);
  assert.equal(nextPollIntervalMs(ps({ idleSeconds: 600, windowFound: false })), 5000);
});

test('nextPollIntervalMs speeds up right after a click, never slower than the setting', () => {
  assert.equal(nextPollIntervalMs(ps({ baseMs: 4000, fastPollsLeft: 2 })), 500);
  assert.equal(nextPollIntervalMs(ps({ baseMs: 300, fastPollsLeft: 1 })), 300);
  assert.equal(nextPollIntervalMs(ps({ baseMs: 4000, fastPollsLeft: 1, windowFound: false })), 500);
  assert.equal(FAST_POLLS_AFTER_CLICK, 3);
});

test('effectivePollIntervalMs reflects adaptive state while the setting is unchanged', () => {
  const t = setup([null], { pollIntervalMs: 20 }, () => 0);
  assert.equal(t.c.effectivePollIntervalMs, 20);
  (t.c as never as { fastPollsLeft: number }).fastPollsLeft = 0;
  assert.equal(t.c.pollIntervalMs, 20);
});

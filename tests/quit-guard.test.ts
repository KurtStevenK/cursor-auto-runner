import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuitGuard } from '../src/main/quit-guard';

function fakeEvent() {
  let prevented = 0;
  return {
    event: {
      preventDefault: () => {
        prevented++;
      },
    },
    get prevented() {
      return prevented;
    },
  };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

test('first before-quit prevents default, runs cleanup, then requests quit once', async (t) => {
  t.mock.method(console, 'error', () => {});
  const gate = deferred();
  let cleanupCalls = 0;
  let quitCalls = 0;
  const guard = createQuitGuard(
    async () => {
      cleanupCalls++;
      await gate.promise;
    },
    () => {
      quitCalls++;
    }
  );
  const ev = fakeEvent();
  guard(ev.event);
  assert.equal(ev.prevented, 1);
  assert.equal(cleanupCalls, 1);
  assert.equal(quitCalls, 0, 'quit must wait for cleanup');
  gate.resolve();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(quitCalls, 1);
});

test('re-entrant before-quit from app.quit() does not prevent or re-run cleanup', async (t) => {
  t.mock.method(console, 'error', () => {});
  let cleanupCalls = 0;
  let quitCalls = 0;
  const guard = createQuitGuard(
    () => {
      cleanupCalls++;
    },
    () => {
      quitCalls++;
    }
  );
  const first = fakeEvent();
  guard(first.event);
  // Second before-quit while cleanup is still pending (same tick).
  const during = fakeEvent();
  guard(during.event);
  assert.equal(during.prevented, 0);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(quitCalls, 1);

  // Second before-quit after cleanup finished (the app.quit() re-entry).
  const after = fakeEvent();
  guard(after.event);
  assert.equal(after.prevented, 0);
  assert.equal(cleanupCalls, 1);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(quitCalls, 1, 'requestQuit must not be called again');
});

test('a rejecting cleanup is logged and still leads to requestQuit', async (t) => {
  const errors: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => {
    errors.push(args);
  });
  let quitCalls = 0;
  const guard = createQuitGuard(
    async () => {
      throw new Error('dispose failed');
    },
    () => {
      quitCalls++;
    }
  );
  const ev = fakeEvent();
  guard(ev.event);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(quitCalls, 1);
  assert.equal(errors.length, 1);
});

test('a synchronously throwing cleanup still leads to requestQuit', async (t) => {
  t.mock.method(console, 'error', () => {});
  let quitCalls = 0;
  const guard = createQuitGuard(
    () => {
      throw new Error('boom');
    },
    () => {
      quitCalls++;
    }
  );
  guard(fakeEvent().event);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(quitCalls, 1);
});

test('a never-resolving cleanup leads to requestQuit after the timeout', async (t) => {
  t.mock.method(console, 'error', () => {});
  const quitted = deferred();
  let quitCalls = 0;
  const guard = createQuitGuard(
    () => new Promise<void>(() => {}),
    () => {
      quitCalls++;
      quitted.resolve();
    },
    50
  );
  const ev = fakeEvent();
  guard(ev.event);
  assert.equal(quitCalls, 0);
  await quitted.promise;
  assert.equal(quitCalls, 1);
});

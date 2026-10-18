import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StatsStore } from '../src/main/stats';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'car-stats-'));
const quiet = () => {
  const { log, warn } = console;
  console.log = () => {};
  console.warn = () => {};
  return () => {
    console.log = log;
    console.warn = warn;
  };
};

test('record and snapshot counts (JSON fallback under plain Node)', () => {
  const restore = quiet();
  const dir = tmp();
  const store = new StatsStore(dir);
  try {
    store.record('run' as never);
    store.record('run' as never);
    store.record('run' as never);
    const snap = store.snapshot('run');
    for (const k of ['session', 'day', 'week', 'month', 'total'] as const)
      assert.equal(snap[k], 3, k);
    assert.equal(snap.mode, 'run');
    assert.equal(snap.byDay.length, 7);
    assert.equal(snap.byDay[6].count, 3);
    assert.equal(
      snap.byDay.slice(0, 6).every((d) => d.count === 0),
      true
    );
  } finally {
    store.dispose();
    restore();
  }
});

test('dispose flushes JSON and a new store reads it back', () => {
  const restore = quiet();
  const dir = tmp();
  const a = new StatsStore(dir);
  a.record('run' as never);
  a.record('run' as never);
  a.dispose();
  // Whether better-sqlite3 loads under plain Node depends on the ABI it was
  // built for, so accept either backend: the SQLite file or the JSON fallback.
  const jsonFile = path.join(dir, 'clicks-fallback.json');
  const dbFile = path.join(dir, 'stats.db');
  assert.equal(fs.existsSync(jsonFile) || fs.existsSync(dbFile), true);
  if (fs.existsSync(jsonFile)) {
    assert.equal(JSON.parse(fs.readFileSync(jsonFile, 'utf8')).length, 2);
  }
  const b = new StatsStore(dir);
  const snap = b.snapshot('idle');
  assert.equal(snap.total, 2);
  b.dispose();
  restore();
});

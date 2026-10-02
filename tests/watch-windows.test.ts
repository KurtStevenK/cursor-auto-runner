import test from 'node:test';
import assert from 'node:assert/strict';
import { selectWatchWindows, watchKindForTitle } from '../src/main/watch-windows';

test('watch titles accept Cursor and RustDesk and skip the runner', () => {
  assert.equal(watchKindForTitle('Cursor'), 'cursor');
  assert.equal(watchKindForTitle('project — Cursor'), 'cursor');
  assert.equal(watchKindForTitle('Cursor Auto Runner'), null);
  assert.equal(watchKindForTitle('cursor-auto-runner'), null);
  assert.equal(watchKindForTitle('RustDesk'), 'rustdesk');
  assert.equal(watchKindForTitle('Office-PC - RustDesk'), 'rustdesk');
  assert.equal(watchKindForTitle('Notepad'), null);
});

test('a fullscreen RustDesk session hides Cursor windows on that display', () => {
  const display = { x: 0, y: 0, width: 1920, height: 1080 };
  const other = { x: 1920, y: 0, width: 1920, height: 1080 };
  const selected = selectWatchWindows(
    [
      { title: 'Cursor', left: 100, top: 100, width: 800, height: 600 },
      { title: 'Office-PC - RustDesk', left: 0, top: 0, width: 1920, height: 1080 },
      { title: 'Cursor', left: 2000, top: 40, width: 900, height: 700 },
      { title: 'Cursor Auto Runner', left: 10, top: 10, width: 400, height: 300 },
    ],
    [display, other]
  );
  assert.deepEqual(
    selected.map((window) => window.title),
    ['Office-PC - RustDesk', 'Cursor']
  );
  assert.equal(selected[1].left, 2000);
});

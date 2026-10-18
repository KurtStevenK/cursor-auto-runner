import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectWatchWindows,
  watchKindForTitle,
  watchKindForWindow,
} from '../src/main/watch-windows';

test('watch titles accept Cursor and RustDesk and skip the runner', () => {
  assert.equal(watchKindForTitle('Cursor'), 'cursor');
  assert.equal(watchKindForTitle('project — Cursor'), 'cursor');
  // Workspace folder is the repo slug. macOS titles are "file — cursor-auto-runner";
  // Windows titles are "file - cursor-auto-runner - Cursor". Both are the IDE.
  assert.equal(watchKindForTitle('cursor-auto-runner'), 'cursor');
  assert.equal(watchKindForTitle('CHANGELOG.md — cursor-auto-runner'), 'cursor');
  assert.equal(watchKindForTitle('CHANGELOG.md - cursor-auto-runner - Cursor'), 'cursor');
  assert.equal(watchKindForTitle('Cursor Auto Runner'), null);
  assert.equal(watchKindForTitle('Cursor Auto Runner — Stats'), null);
  assert.equal(watchKindForTitle('RustDesk'), 'rustdesk');
  assert.equal(watchKindForTitle('Office-PC - RustDesk'), 'rustdesk');
  assert.equal(watchKindForTitle('Notepad'), null);
  assert.equal(watchKindForTitle('CHANGELOG.md — FeatherShot'), null);
  assert.equal(
    watchKindForWindow({ title: 'CHANGELOG.md — FeatherShot', owner: 'Cursor' }),
    'cursor'
  );
  assert.equal(watchKindForWindow({ title: 'Button test', owner: 'Cursor Auto Runner' }), 'cursor');
  assert.equal(
    watchKindForWindow({ title: 'Cursor Auto Runner — Stats', owner: 'Cursor Auto Runner' }),
    null
  );
});

test('Cursor is recognized by the owning app when the title is only the project name', () => {
  const display = { x: 0, y: 0, width: 2560, height: 1440 };
  const selected = selectWatchWindows(
    [
      {
        title: 'CHANGELOG.md — FeatherShot',
        owner: 'Cursor',
        left: 89,
        top: 39,
        width: 2391,
        height: 1335,
      },
      {
        title: 'Button test',
        owner: 'Cursor Auto Runner',
        left: 40,
        top: 80,
        width: 520,
        height: 300,
      },
      {
        title: 'Cursor Auto Runner — Stats',
        owner: 'Cursor Auto Runner',
        left: 10,
        top: 10,
        width: 400,
        height: 560,
      },
    ],
    [display]
  );
  assert.deepEqual(
    selected.map((window) => window.title),
    ['CHANGELOG.md — FeatherShot', 'Button test']
  );
});

test('a local Cursor workspace is watched when RustDesk is not covering the display', () => {
  const display = { x: 0, y: 0, width: 2560, height: 1440 };
  const selected = selectWatchWindows(
    [
      { title: 'CHANGELOG.md — cursor-auto-runner', left: 215, top: 30, width: 2340, height: 1346 },
      { title: 'Cursor Auto Runner — Stats', left: 400, top: 200, width: 400, height: 560 },
    ],
    [display]
  );
  assert.deepEqual(
    selected.map((window) => window.title),
    ['CHANGELOG.md — cursor-auto-runner']
  );
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

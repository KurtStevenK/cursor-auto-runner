import test from 'node:test';
import assert from 'node:assert/strict';
import { ownerForWindow, parseOwnedWindowList } from '../src/main/owned-windows';

const sep = '\u001f';

test('owned-window rows keep the app name separate from the document title', () => {
  const text = [
    ['Cursor', 'CHANGELOG.md — FeatherShot', '89', '39', '2391', '1335'].join(sep),
    ['Cursor', 'CHANGELOG.md — cursor-auto-runner', '215', '30', '2340', '1346'].join(sep),
    ['RustDesk', '171972163 - RustDesk', '2260', '30', '300', '490'].join(sep),
    '',
  ].join('\n');
  assert.deepEqual(parseOwnedWindowList(text), [
    {
      owner: 'Cursor',
      title: 'CHANGELOG.md — FeatherShot',
      left: 89,
      top: 39,
      width: 2391,
      height: 1335,
    },
    {
      owner: 'Cursor',
      title: 'CHANGELOG.md — cursor-auto-runner',
      left: 215,
      top: 30,
      width: 2340,
      height: 1346,
    },
    {
      owner: 'RustDesk',
      title: '171972163 - RustDesk',
      left: 2260,
      top: 30,
      width: 300,
      height: 490,
    },
  ]);
});

test('owner lookup matches the same title at the same origin', () => {
  const owned = parseOwnedWindowList(
    ['Cursor', 'CHANGELOG.md — FeatherShot', '89', '39', '2391', '1335'].join(sep)
  );
  assert.equal(
    ownerForWindow(
      { title: 'CHANGELOG.md — FeatherShot', left: 90, top: 40, width: 2391, height: 1335 },
      owned
    ),
    'Cursor'
  );
  assert.equal(
    ownerForWindow(
      { title: 'CHANGELOG.md — FeatherShot', left: 400, top: 400, width: 800, height: 600 },
      owned
    ),
    'Cursor'
  );
  assert.equal(
    ownerForWindow({ title: 'Other', left: 89, top: 39, width: 100, height: 100 }, owned),
    null
  );
});

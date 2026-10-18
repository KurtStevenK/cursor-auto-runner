import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..');
// biome-ignore lint/suspicious/noExplicitAny: plain CommonJS script without types
const feeds: any = require(path.join(repoRoot, 'scripts', 'fix-update-feeds.js'));

test('publishedNameFor maps electron-builder safe names to published names', () => {
  const v = '1.2.102';
  assert.equal(
    feeds.publishedNameFor('Cursor-Auto-Runner-Setup-1.2.102.exe', v),
    'Cursor.Auto.Runner.Setup.1.2.102.exe'
  );
  assert.equal(
    feeds.publishedNameFor('Cursor-Auto-Runner-1.2.102-arm64-mac.zip', v),
    'Cursor.Auto.Runner-1.2.102-arm64-mac.zip'
  );
  assert.equal(
    feeds.publishedNameFor('Cursor-Auto-Runner-1.2.102.dmg', v),
    'Cursor.Auto.Runner-1.2.102.dmg'
  );
});

test('publishedNameFor is idempotent and maps spaces to dots', () => {
  const v = '1.2.102';
  for (const name of ['Cursor.Auto.Runner.Setup.1.2.102.exe', 'Cursor.Auto.Runner-1.2.102.dmg']) {
    assert.equal(feeds.publishedNameFor(name, v), name);
  }
  assert.equal(
    feeds.publishedNameFor('Cursor Auto Runner Setup 1.2.102.exe', v),
    'Cursor.Auto.Runner.Setup.1.2.102.exe'
  );
});

const SAMPLE = `version: 1.2.102
files:
  - url: Cursor-Auto-Runner-1.2.102-mac.zip
    sha512: T7XA5ZvTzU6uR1oS0VtC8wr2iIpaQceo3bppLThkYk1af3/BHfUNGBLEKT/5AREJ8IGvlN3aN6H290L5DWwKng==
    size: 157605456
  - url: Cursor-Auto-Runner-1.2.102-arm64.dmg
    sha512: BbWSh92YTyG5x4JWczVhwUus82S6yvvae3UKuxarIA6oOO6qTEnqjFdDahVDyRDd0Ri1S2LuETTpp18Qw9L+xw==
    size: 151348318
path: Cursor-Auto-Runner-1.2.102-mac.zip
sha512: T7XA5ZvTzU6uR1oS0VtC8wr2iIpaQceo3bppLThkYk1af3/BHfUNGBLEKT/5AREJ8IGvlN3aN6H290L5DWwKng==
releaseDate: '2026-10-01T23:46:29.744Z'
`;

test('rewriteFeed changes url/path lines only and is idempotent', () => {
  const seen: string[] = [];
  const out: string = feeds.rewriteFeed(SAMPLE, '1.2.102', (from: string) => seen.push(from));
  assert.equal(seen.length, 3);
  assert.match(out, /- url: Cursor\.Auto\.Runner-1\.2\.102-mac\.zip\n/);
  assert.match(out, /- url: Cursor\.Auto\.Runner-1\.2\.102-arm64\.dmg\n/);
  assert.match(out, /^path: Cursor\.Auto\.Runner-1\.2\.102-mac\.zip$/m);
  const sha = (t: string) => t.split('\n').filter((l) => l.includes('sha512:'));
  assert.deepEqual(sha(out), sha(SAMPLE));
  assert.ok(out.includes('size: 157605456') && out.includes("releaseDate: '2026"));
  assert.equal(feeds.rewriteFeed(out, '1.2.102'), out);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const candidateRoot = path.resolve(__dirname, '..', '..');
const repoRoot = fs.existsSync(path.join(candidateRoot, 'scripts')) ? candidateRoot : process.cwd();
// biome-ignore lint/suspicious/noExplicitAny: plain CommonJS script without types
const feeds: any = require(path.join(repoRoot, 'scripts', 'refresh-update-feed-hashes.js'));

test('refreshFeedFile rewrites sha512 and size for existing files only', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-feed-'));
  try {
    const bytes = Buffer.from('signed installer bytes');
    fs.writeFileSync(path.join(dir, 'Cursor Auto Runner Setup 1.2.3.exe'), bytes);
    const feed = path.join(dir, 'latest.yml');
    fs.writeFileSync(
      feed,
      [
        'version: 1.2.3',
        'files:',
        '  - url: Cursor-Auto-Runner-Setup-1.2.3.exe',
        '    sha512: STALE',
        '    size: 1',
        '  - url: Missing-File.exe',
        '    sha512: KEEP',
        '    size: 7',
        'path: Cursor-Auto-Runner-Setup-1.2.3.exe',
        'sha512: STALE',
        "releaseDate: '2026-01-01T00:00:00.000Z'",
        '',
      ].join('\n')
    );
    assert.equal(feeds.refreshFeedFile(feed, dir), true);
    const out = fs.readFileSync(feed, 'utf8');
    const expected = crypto.createHash('sha512').update(bytes).digest('base64');
    assert.equal(out.split(`sha512: ${expected}`).length - 1, 2);
    assert.match(out, new RegExp(`size: ${bytes.length}\\n`));
    assert.match(out, /sha512: KEEP\n {4}size: 7\n/);
    assert.doesNotMatch(out, /STALE/);
    assert.equal(feeds.refreshFeedFile(feed, dir), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

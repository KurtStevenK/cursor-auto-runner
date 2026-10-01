#!/usr/bin/env node
/**
 * Write firebase-landing/src/data/release-<version>.json from GitHub Release assets.
 * Usage: node scripts/sync-firebase-release-data.js [version]
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { pipeline } = require('node:stream/promises');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = process.argv[2] || pkg.version;
const repo = process.env.GITHUB_REPOSITORY || 'KurtStevenK/cursor-auto-runner';
const out = path.join(root, 'firebase-landing', 'src', 'data', `release-${version}.json`);

function platformFor(name) {
  const n = name.toLowerCase();
  if (n.endsWith('.exe')) return 'Windows';
  if (n.endsWith('.dmg') || n.endsWith('.zip')) return 'macOS';
  if (n.endsWith('.deb') || n.endsWith('.appimage') || n.endsWith('.pacman')) return 'Linux';
  return null;
}

async function sha256FromUrl(url) {
  const headers = { Accept: 'application/octet-stream' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers, redirect: 'follow' });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const hash = createHash('sha256');
  await pipeline(res.body, hash);
  return hash.digest('hex');
}

async function main() {
  const apiUrl = `https://api.github.com/repos/${repo}/releases/tags/v${version}`;
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(apiUrl, { headers });
  if (!res.ok) {
    console.error(`[sync-release-data] GitHub API ${res.status} for v${version}`);
    process.exit(1);
  }
  const release = await res.json();
  const assets = [];
  for (const a of release.assets || []) {
    if (a.name.endsWith('.blockmap') || a.name.endsWith('.nupkg')) continue;
    const platform = platformFor(a.name);
    if (!platform) continue;
    process.stderr.write(`[sync-release-data] hashing ${a.name}…\n`);
    const sha256 = await sha256FromUrl(a.url);
    assets.push({ name: a.name, sha256, platform });
  }

  if (assets.length === 0) {
    console.error(`[sync-release-data] No installer assets on v${version}`);
    process.exit(1);
  }

  const manifest = { version, assets };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[sync-release-data] Wrote ${out} (${assets.length} assets)`);
}

main().catch((err) => {
  console.error('[sync-release-data]', err.message || err);
  process.exit(1);
});

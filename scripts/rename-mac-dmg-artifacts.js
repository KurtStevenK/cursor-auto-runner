#!/usr/bin/env node
/**
 * electron-builder uses productName (spaces) in DMG basenames; GitHub Releases,
 * the Homebrew cask, and landing links use dotted names. Rename after dist:mac.
 */
const fs = require("fs");
const path = require("path");

const version = require("../package.json").version;
const releaseDir = path.join(__dirname, "..", "release");

const renames = [
  [`Cursor Auto Runner-${version}.dmg`, `Cursor.Auto.Runner-${version}.dmg`],
  [
    `Cursor Auto Runner-${version}-arm64.dmg`,
    `Cursor.Auto.Runner-${version}-arm64.dmg`,
  ],
  [
    `Cursor Auto Runner-${version}.dmg.blockmap`,
    `Cursor.Auto.Runner-${version}.dmg.blockmap`,
  ],
  [
    `Cursor Auto Runner-${version}-arm64.dmg.blockmap`,
    `Cursor.Auto.Runner-${version}-arm64.dmg.blockmap`,
  ],
];

for (const [from, to] of renames) {
  const src = path.join(releaseDir, from);
  const dst = path.join(releaseDir, to);
  if (!fs.existsSync(src)) {
    continue;
  }
  if (fs.existsSync(dst)) {
    fs.unlinkSync(dst);
  }
  fs.renameSync(src, dst);
  console.log(`renamed ${from} -> ${to}`);
}

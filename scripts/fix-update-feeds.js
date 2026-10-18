// Points electron-builder's update feeds (latest*.yml) at the artifact names that are
// actually published: mac DMG/ZIP files are renamed by rename-mac-dmg-artifacts.js and
// GitHub converts the spaces in the Windows installer name to dots. Idempotent.
const fs = require('node:fs');
const path = require('node:path');

const PRODUCT_SAFE = 'Cursor-Auto-Runner';
const PRODUCT_PUBLISHED = 'Cursor.Auto.Runner';

function publishedNameFor(safeName, version) {
  let name = String(safeName);
  const v = version ? String(version).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '[^/]+?';
  const setup = new RegExp(`^${PRODUCT_SAFE}-Setup-(${v}.*)$`);
  if (setup.test(name)) {
    name = name.replace(setup, `${PRODUCT_PUBLISHED}.Setup.$1`);
  } else if (name.startsWith(`${PRODUCT_SAFE}-`)) {
    name = PRODUCT_PUBLISHED + name.slice(PRODUCT_SAFE.length);
  }
  return name.replace(/ /g, '.');
}

function rewriteFeed(yamlText, version, onRewrite) {
  return yamlText.replace(
    /^(\s*(?:-\s+)?(?:url|path):\s*)(['"]?)([^'"\r\n]*?)\2(\s*)$/gm,
    (match, prefix, quote, value, trail) => {
      const next = publishedNameFor(value, version);
      if (next === value) return match;
      if (onRewrite) onRewrite(value, next);
      return `${prefix}${quote}${next}${quote}${trail}`;
    }
  );
}

function main() {
  const releaseDir = path.join(__dirname, '..', 'release');
  for (const file of ['latest.yml', 'latest-mac.yml', 'latest-linux.yml']) {
    const full = path.join(releaseDir, file);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, 'utf8');
    const version = /^version:\s*['"]?([^'"\r\n]+?)['"]?\s*$/m.exec(text)?.[1];
    const out = rewriteFeed(text, version, (from, to) => console.log(`${file}: ${from} -> ${to}`));
    if (out !== text) fs.writeFileSync(full, out);
    else console.log(`${file}: already up to date`);
  }
}

module.exports = { publishedNameFor, rewriteFeed };

if (require.main === module) main();

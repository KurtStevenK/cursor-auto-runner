/**
 * Copies the overlay's static assets (HTML/CSS) into dist after tsc,
 * so the packaged app can load them next to the compiled renderer JS.
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'overlay');
const out = path.join(__dirname, '..', 'dist', 'src', 'overlay');
fs.mkdirSync(out, { recursive: true });
for (const file of fs.readdirSync(src).filter((f) => !f.endsWith('.ts'))) {
  fs.copyFileSync(path.join(src, file), path.join(out, file));
  console.log(`copied ${file}`);
}

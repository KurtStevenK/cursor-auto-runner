/**
 * Bundles the files that cannot use tsc's per-file output:
 *  - the two sandboxed preloads (they may only require('electron')), and
 *  - the overlay renderer (loaded as a standalone ES module by index.html).
 * Runs after tsc and overwrites/creates the outputs under dist/src, so they can
 * import shared code (IPC channel names, poll ladder, types) from src/shared.
 */
const path = require('path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const out = (p) => path.join(root, 'dist', p);
const src = (p) => path.join(root, p);

const common = { bundle: true, minify: false, sourcemap: false, logLevel: 'warning' };

const builds = [
  {
    ...common,
    entryPoints: [src('src/main/preload.ts')],
    outfile: out('src/main/preload.js'),
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
    target: 'node22',
  },
  {
    ...common,
    entryPoints: [src('src/main/capture-preload.ts')],
    outfile: out('src/main/capture-preload.js'),
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
    target: 'node22',
  },
  {
    ...common,
    entryPoints: [src('src/overlay/overlay.ts')],
    outfile: out('src/overlay/overlay.js'),
    platform: 'browser',
    format: 'esm',
    target: 'chrome130',
  },
];

Promise.all(builds.map((b) => esbuild.build(b)))
  .then(() => console.log(`bundled ${builds.length} renderer files`))
  .catch(() => process.exit(1));

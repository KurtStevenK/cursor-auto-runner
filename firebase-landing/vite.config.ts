import react from '@vitejs/plugin-react';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const appPkg = JSON.parse(
  readFileSync(path.resolve(root, '../package.json'), 'utf8'),
) as { version: string };

/** Newest release-<version>.json in src/data, by numeric version. */
function newestManifestPath(): string | null {
  const dir = path.resolve(root, 'src/data');
  const candidates = readdirSync(dir)
    .map((name) => /^release-(\d+)\.(\d+)\.(\d+)\.json$/.exec(name))
    .filter((match): match is RegExpExecArray => match !== null)
    .sort((a, b) => {
      for (let i = 1; i <= 3; i++) {
        const diff = Number(b[i]) - Number(a[i]);
        if (diff !== 0) return diff;
      }
      return 0;
    });
  return candidates.length ? path.resolve(dir, candidates[0][0]) : null;
}

/**
 * package.json is bumped per task, so it usually runs ahead of the latest
 * published release. Prefer the exact manifest, otherwise the newest one.
 */
function loadReleaseManifest(version: string) {
  const versioned = path.resolve(root, 'src/data', `release-${version}.json`);
  const file = existsSync(versioned) ? versioned : newestManifestPath();
  if (!file) throw new Error('[vite] no release-*.json manifest in src/data; run scripts/sync-firebase-release-data.js <version>');
  if (file !== versioned) {
    console.warn(`[vite] No release-${version}.json — using ${path.basename(file)} (newest published release).`);
  }
  return JSON.parse(readFileSync(file, 'utf8')) as { version?: string };
}

const releaseManifest = loadReleaseManifest(appPkg.version);

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(releaseManifest.version ?? appPkg.version),
    __RELEASE_DATA__: JSON.stringify(releaseManifest),
    __STORAGE_BUCKET__: JSON.stringify(
      'cursor-auto-runner-linux.firebasestorage.app',
    ),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000, // async three chunk only
  },
});

import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const appPkg = JSON.parse(
  readFileSync(path.resolve(root, '../package.json'), 'utf8'),
) as { version: string };

function loadReleaseManifest(version: string) {
  const versioned = path.resolve(root, 'src/data', `release-${version}.json`);
  const fallback = path.resolve(root, 'src/data', 'release-1.2.28.json');
  const file = existsSync(versioned) ? versioned : fallback;
  if (!existsSync(versioned)) {
    console.warn(
      `[vite] Missing release-${version}.json — using ${path.basename(file)}. Run: node scripts/sync-firebase-release-data.js`,
    );
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

const releaseManifest = loadReleaseManifest(appPkg.version);

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appPkg.version),
    __RELEASE_DATA__: JSON.stringify(releaseManifest),
    __STORAGE_BUCKET__: JSON.stringify(
      'cursor-auto-runner-linux.firebasestorage.app',
    ),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});

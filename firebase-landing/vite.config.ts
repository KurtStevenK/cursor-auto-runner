import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const appPkg = JSON.parse(
  readFileSync(path.resolve(root, '../package.json'), 'utf8'),
) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appPkg.version),
    __LINUX_MIRROR_VERSION__: JSON.stringify('1.2.28'),
    __STORAGE_BUCKET__: JSON.stringify(
      'cursor-auto-runner-linux.firebasestorage.app',
    ),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});

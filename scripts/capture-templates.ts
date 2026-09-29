/**
 * Standalone template capture — run with: npm run capture-templates -- [name] [theme]
 *   name:  run | always-run | allow  (default: run)
 *   theme: dark | light              (default: dark)
 *
 * Thin wrapper around src/main/capture.ts. The same capture is also
 * available in-app via the tray menu ("Capture templates…").
 */
import { app } from 'electron';
import { startCapture } from '../src/main/capture';

const name = process.argv.find((a) => a === 'run' || a === 'always-run' || a === 'allow') ?? 'run';
const theme = process.argv.find((a) => a === 'dark' || a === 'light') ?? 'dark';

app.whenReady().then(async () => {
  await startCapture(name, theme, {
    onDone: () => app.exit(0),
  });
}).catch((err) => {
  console.error(err);
  app.exit(1);
});

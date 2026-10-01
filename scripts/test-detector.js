/* Diagnostic: verify the detector loads templates and can detect on-screen buttons. */
const { app } = require('electron');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { Detector } = require(path.join(ROOT, 'dist', 'src', 'main', 'detector.js'));

const MODES = ['run', 'always-run', 'allow'];

app.whenReady().then(async () => {
  const detector = new Detector({ bundledRoot: ROOT });
  console.log('--- detection passes (cold + warm per mode, no clicks) ---');
  for (const mode of MODES) {
    for (const label of ['cold', 'warm']) {
      const startedAt = performance.now();
      const result = await detector.detect(mode);
      const elapsedMs = performance.now() - startedAt;
      console.log(`[${mode}/${label}] templates loaded:`, detector.hasTemplates());
      console.log(`[${mode}/${label}] cursor window found:`, detector.windowFound);
      console.log(
        `[${mode}/${label}] button detected:`,
        result
          ? JSON.stringify({
              x: result.x,
              y: result.y,
              mode: result.mode,
              score: Number(result.score.toFixed(4)),
              path: result.path,
              pyramid: result.pyramid,
              template: result.template,
            })
          : 'none on screen right now'
      );
      console.log(`[${mode}/${label}] elapsed ms:`, elapsedMs.toFixed(1));
      console.log(`[${mode}/${label}] phase metrics:`, JSON.stringify(detector.lastMetrics));
    }
  }
  await detector.dispose();
  app.exit(0);
}).catch((err) => {
  console.error('diag error:', err);
  app.exit(1);
});

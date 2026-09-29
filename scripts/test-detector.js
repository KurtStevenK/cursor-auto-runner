/* Diagnostic: verify the detector loads templates and can detect on-screen buttons. */
const { app } = require('electron');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { Detector } = require(path.join(ROOT, 'dist', 'src', 'main', 'detector.js'));

app.whenReady().then(async () => {
  // This script is Electron's entry point, so app.getAppPath() points near
  // dist/scripts instead of the project/app root. Pass the template root
  // explicitly to exercise the same bundled catalog as the real app.
  const detector = new Detector({ bundledRoot: ROOT });
  console.log('--- running two detection passes (cold + warm, no clicks are performed) ---');
  for (const label of ['cold', 'warm']) {
    const heartbeat = [];
    let expectedHeartbeat = performance.now() + 10;
    const heartbeatTimer = setInterval(() => {
      const now = performance.now();
      heartbeat.push(Math.max(0, now - expectedHeartbeat));
      expectedHeartbeat = now + 10;
    }, 10);
    const startedAt = performance.now();
    const result = await detector.detect('always-run');
    const elapsedMs = performance.now() - startedAt;
    clearInterval(heartbeatTimer);
    const orderedHeartbeat = heartbeat.sort((a, b) => a - b);
    const heartbeatP95 =
      orderedHeartbeat[Math.min(orderedHeartbeat.length - 1, Math.floor(orderedHeartbeat.length * 0.95))] || 0;
    console.log(`${label} templates loaded:`, detector.hasTemplates());
    console.log(`${label} cursor window found:`, detector.windowFound);
    console.log(
      `${label} button detected:`,
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
    console.log(`${label} elapsed ms:`, elapsedMs.toFixed(1));
    console.log(
      `${label} main heartbeat p95/max ms:`,
      heartbeatP95.toFixed(1),
      '/',
      Math.max(0, ...heartbeat).toFixed(1)
    );
    console.log(`${label} phase metrics:`, JSON.stringify(detector.lastMetrics));
  }
  await detector.dispose();
  app.exit(0);
}).catch((err) => { console.error('diag error:', err); app.exit(1); });

/* Diagnostic: verify the detector loads templates and can detect on-screen buttons. */
const { app } = require('electron');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { Detector } = require(path.join(ROOT, 'dist', 'src', 'main', 'detector.js'));

app.whenReady().then(async () => {
  const detector = new Detector();
  console.log('--- running one detection pass (no clicks are performed) ---');
  const result = await detector.detect('always-run');
  console.log('templates loaded:', detector.hasTemplates());
  console.log('cursor window found:', detector.windowFound);
  console.log('button detected:', result ? JSON.stringify({ x: result.x, y: result.y, mode: result.mode }) : 'none on screen right now');
  app.exit(0);
}).catch((err) => { console.error('diag error:', err); app.exit(1); });

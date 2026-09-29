/**
 * Template capture tool — run with: npm run capture-templates -- [name] [theme]
 *   name:  run | always-run        (default: run)
 *   theme: dark | light            (default: dark)
 *
 * Freezes your screen behind a fullscreen overlay window, then lets you
 * drag a rectangle around the Run / Always Run button in Cursor.
 * The crop is saved to assets/templates/<theme>/<name>.png.
 */
import { app, BrowserWindow, desktopCapturer, ipcMain, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const name = process.argv.find((a) => a === 'run' || a === 'always-run') ?? 'run';
const theme = process.argv.find((a) => a === 'dark' || a === 'light') ?? 'dark';

let win: BrowserWindow | null = null;
let shot: { image: Electron.NativeImage; scaleFactor: number } | null = null;

async function captureScreen(): Promise<void> {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const scale = display.scaleFactor;
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(display.size.width * scale),
      height: Math.round(display.size.height * scale),
    },
  });
  const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0];
  if (!source) throw new Error('no screen source');
  shot = { image: source.thumbnail, scaleFactor: scale };
}

const html = `<!DOCTYPE html>
<html><head><style>
  html,body{margin:0;overflow:hidden;cursor:crosshair;background:transparent;user-select:none;-webkit-user-select:none}
  #shot{position:absolute;inset:0;width:100vw;height:100vh;pointer-events:none}
  #rect{position:absolute;border:2px solid #22c55e;background:rgba(34,197,94,0.15);display:none;pointer-events:none}
  #hint{position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;
        font:14px 'Segoe UI',sans-serif;padding:10px 18px;border-radius:8px;border:1px solid #22c55e;z-index:10}
</style></head>
<body>
  <img id="shot" draggable="false" />
  <div id="rect"></div>
  <div id="hint">Drag a rectangle around the "${name}" button, then release. ESC = cancel.</div>
  <script>
    const { ipcRenderer } = require('electron');
    let sx=0, sy=0, dragging=false, saved=0;
    const rect = document.getElementById('rect');
    const hint = document.getElementById('hint');
    // Block native image drag — it swallows mouse events and breaks selection.
    document.addEventListener('dragstart', e => e.preventDefault());
    document.addEventListener('mousedown', e => { e.preventDefault(); dragging=true; sx=e.clientX; sy=e.clientY; rect.style.display='block'; });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      rect.style.left = Math.min(sx,e.clientX)+'px';
      rect.style.top = Math.min(sy,e.clientY)+'px';
      rect.style.width = Math.abs(e.clientX-sx)+'px';
      rect.style.height = Math.abs(e.clientY-sy)+'px';
    });
    document.addEventListener('mouseup', e => {
      if (!dragging) return; dragging=false;
      const x=Math.min(sx,e.clientX), y=Math.min(sy,e.clientY);
      const w=Math.abs(e.clientX-sx), h=Math.abs(e.clientY-sy);
      if (w > 4 && h > 4) ipcRenderer.send('capture-region', { x, y, w, h });
      else rect.style.display='none';
    });
    ipcRenderer.on('capture-saved', (_e, file) => {
      saved++;
      rect.style.display='none';
      hint.textContent = 'Saved #' + saved + ': ' + file + ' — drag the next one, or press ESC to finish.';
    });
    document.addEventListener('keydown', e => { if (e.key==='Escape') ipcRenderer.send('capture-cancel'); });
  </script>
</body></html>`;

async function main(): Promise<void> {
  await app.whenReady();
  await captureScreen();
  if (!shot) throw new Error('screen capture failed');

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.size.width,
    height: display.size.height,
    frame: false,
    fullscreen: false,
    alwaysOnTop: true,
    enableLargerThanScreen: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  // Freeze the screen behind the selection UI
  const shotData = shot.image.toDataURL();
  const htmlWithShot = html.replace('<img id="shot" />', `<img id="shot" src="${shotData}" />`);
  const tmpFile = path.join(app.getPath('temp'), 'cursor-auto-runner-capture.html');
  fs.writeFileSync(tmpFile, htmlWithShot);
  await win.loadFile(tmpFile);
  win.show();

  ipcMain.on('capture-region', (_e, r: { x: number; y: number; w: number; h: number }) => {
    if (!shot) return;
    const scale = shot.scaleFactor;
    const out = shot.image.crop({
      x: Math.round(r.x * scale),
      y: Math.round(r.y * scale),
      width: Math.round(r.w * scale),
      height: Math.round(r.h * scale),
    });
    const dir = path.join(app.getAppPath(), 'assets', 'templates', theme);
    fs.mkdirSync(dir, { recursive: true });
    // Add numbered variants (run.png, run-2.png, run-3.png…) instead of
    // overwriting, so the IDE button and agent-window button styles can
    // both be captured in one session.
    let file = path.join(dir, `${name}.png`);
    for (let i = 2; fs.existsSync(file); i++) {
      file = path.join(dir, `${name}-${i}.png`);
    }
    fs.writeFileSync(file, out.toPNG());
    console.log(`template saved: ${file} (${out.getSize().width}x${out.getSize().height})`);
    // Keep the window open so further variants can be captured; ESC finishes.
    win?.webContents.send('capture-saved', path.basename(file));
  });
  ipcMain.on('capture-cancel', () => app.exit(0));
}

main().catch((err) => {
  console.error(err);
  app.exit(1);
});

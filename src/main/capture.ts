/**
 * Template capture tool, usable from within the running app (tray menu)
 * or as a standalone script (scripts/capture-templates.ts).
 *
 * Freezes the screen behind a fullscreen overlay and lets the user drag a
 * rectangle around a Run / Always Run / Allow button. Each save appends a
 * numbered variant (run.png, run-2.png, …).
 */
import { app, BrowserWindow, desktopCapturer, ipcMain, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { validateTemplateDimensions } from './matcher';

export type CaptureName = 'run' | 'always-run' | 'allow';
export type CaptureTheme = 'dark' | 'light';

export interface CaptureCallbacks {
  onSaved?: (file: string) => void;
  onRejected?: (reason: string) => void;
  onDone?: () => void;
}

/** Where captured templates are stored (project dir in dev, userData when packaged). */
export function templatesBaseDir(): string {
  if (app.isPackaged) return app.getPath('userData');
  // In dev the compiled modules live at different depths (dist/src/main for
  // the app, dist/scripts for the capture CLI), so resolve the project root
  // by walking up to the directory that contains package.json. This must
  // match where the DETECTOR looks (see detector.ts) — a mismatch silently
  // hides freshly captured templates.
  let dir = path.dirname(__dirname);
  while (dir !== path.parse(dir).root && !fs.existsSync(path.join(dir, 'package.json'))) {
    dir = path.dirname(dir);
  }
  return dir;
}

// --- module state: one capture session at a time ---
let activeWin: BrowserWindow | null = null;
let shot: { image: Electron.NativeImage; scaleFactor: number } | null = null;
let target: { name: CaptureName; theme: CaptureTheme } | null = null;
let callbacks: CaptureCallbacks = {};
let handlersRegistered = false;

const html = (buttonName: string) => `<!DOCTYPE html>
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
  <div id="hint" role="status" aria-live="polite">Select only the stable "${buttonName}" label; exclude changing command text. ESC = finish.</div>
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
    ipcRenderer.on('capture-rejected', (_e, reason) => {
      rect.style.display='none';
      hint.textContent = 'Not saved: ' + reason + '. Select only the stable button label and try again.';
    });
    document.addEventListener('keydown', e => { if (e.key==='Escape') ipcRenderer.send('capture-cancel'); });
  </script>
</body></html>`;

function registerHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;
  ipcMain.on('capture-region', (_e, r: { x: number; y: number; w: number; h: number }) => {
    if (!shot || !target) return;
    const scale = shot.scaleFactor;
    const out = shot.image.crop({
      x: Math.round(r.x * scale),
      y: Math.round(r.y * scale),
      width: Math.round(r.w * scale),
      height: Math.round(r.h * scale),
    });
    const size = out.getSize();
    const validation = validateTemplateDimensions(size.width, size.height);
    if (!validation.valid) {
      const reason = validation.reason ?? 'invalid selection';
      callbacks.onRejected?.(reason);
      activeWin?.webContents.send('capture-rejected', reason);
      return;
    }
    const dir = path.join(templatesBaseDir(), 'assets', 'templates', target.theme);
    fs.mkdirSync(dir, { recursive: true });
    const png = out.toPNG();
    const existing = fs
      .readdirSync(dir)
      .filter(
        (name) =>
          name.toLowerCase().endsWith('.png') &&
          (name === `${target!.name}.png` || name.startsWith(`${target!.name}-`))
      );
    if (existing.some((name) => fs.readFileSync(path.join(dir, name)).equals(png))) {
      const reason = 'an identical template already exists';
      callbacks.onRejected?.(reason);
      activeWin?.webContents.send('capture-rejected', reason);
      return;
    }
    // Numbered variants instead of overwriting: run.png, run-2.png, …
    let file = path.join(dir, `${target.name}.png`);
    for (let i = 2; fs.existsSync(file); i++) {
      file = path.join(dir, `${target.name}-${i}.png`);
    }
    fs.writeFileSync(file, png);
    console.log(`template saved: ${file} (${size.width}x${size.height})`);
    callbacks.onSaved?.(file);
    activeWin?.webContents.send('capture-saved', path.basename(file));
  });
  ipcMain.on('capture-cancel', () => {
    callbacks.onDone?.();
    activeWin?.close();
  });
}

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
  if (!source) throw new Error('no screen source found');
  shot = { image: source.thumbnail, scaleFactor: scale };
}

/** Start a capture session. Resolves when the overlay window is ready. */
export async function startCapture(
  name: CaptureName,
  theme: CaptureTheme,
  cb: CaptureCallbacks = {}
): Promise<void> {
  registerHandlers();
  callbacks = cb;
  target = { name, theme };
  await captureScreen();
  if (!shot) throw new Error('screen capture failed');

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  activeWin?.close();
  activeWin = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.size.width,
    height: display.size.height,
    frame: false,
    // True fullscreen: a normal window would be clipped to the work area
    // (above the taskbar), which misaligns the frozen screenshot.
    fullscreen: true,
    alwaysOnTop: true,
    enableLargerThanScreen: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  activeWin.on('closed', () => {
    activeWin = null;
  });
  // Freeze the screen behind the selection UI. The screenshot is written
  // as a file next to the temp HTML because data: URLs fail to load.
  const tmpDir = app.getPath('temp');
  fs.writeFileSync(path.join(tmpDir, 'cursor-auto-runner-shot.png'), shot.image.toPNG());
  const tmpFile = path.join(tmpDir, 'cursor-auto-runner-capture.html');
  fs.writeFileSync(tmpFile, html(name).replace(
    '<img id="shot" draggable="false" />',
    '<img id="shot" draggable="false" src="cursor-auto-runner-shot.png" />'
  ));
  await activeWin.loadFile(tmpFile);
  activeWin.show();
}

/** Finish any running capture session (used by tray Quit). */
export function stopCapture(): void {
  activeWin?.close();
  activeWin = null;
}

/**
 * Tray test window. Shows the bundled Run, Always Run, and Allow images at
 * their template pixel size so Auto Run can click them without a Cursor prompt.
 * Always Run sits to the left of Run, which is where the matcher looks for it.
 */
import { app, BrowserWindow, screen } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BUTTON_TEST_TITLE, type WindowRect } from './watch-windows';

export interface ButtonTestWindow extends WindowRect {
  focus: () => Promise<boolean>;
}

let testWindow: BrowserWindow | null = null;
let onChange: (() => void) | null = null;

export function setButtonTestListener(listener: () => void): void {
  onChange = listener;
}

export function getButtonTestWindow(): ButtonTestWindow | null {
  if (!testWindow || testWindow.isDestroyed() || !testWindow.isVisible()) return null;
  const bounds = testWindow.getBounds();
  if (bounds.width < 50 || bounds.height < 50) return null;
  const win = testWindow;
  return {
    title: BUTTON_TEST_TITLE,
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height,
    focus: async () => {
      if (win.isDestroyed()) return false;
      win.focus();
      return true;
    },
  };
}

export function showButtonTest(): void {
  if (testWindow && !testWindow.isDestroyed()) {
    testWindow.show();
    testWindow.focus();
    onChange?.();
    return;
  }
  const point = screen.getCursorScreenPoint();
  const scale = screen.getDisplayNearestPoint(point).scaleFactor || 1;
  testWindow = new BrowserWindow({
    width: 440,
    height: 360,
    show: false,
    title: BUTTON_TEST_TITLE,
    resizable: false,
    minimizable: true,
    fullscreenable: false,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  testWindow.on('closed', () => {
    testWindow = null;
    onChange?.();
  });
  testWindow.on('move', () => onChange?.());
  testWindow.on('resize', () => onChange?.());
  void testWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(testHtml(scale))}`);
  testWindow.once('ready-to-show', () => {
    testWindow?.show();
    testWindow?.focus();
    onChange?.();
  });
}

function pngDataUrl(name: string): { src: string; width: number; height: number } | null {
  const file = path.join(app.getAppPath(), 'assets', 'templates', 'dark', name);
  if (!fs.existsSync(file)) return null;
  const bytes = fs.readFileSync(file);
  if (bytes.length < 24) return null;
  return {
    src: `data:image/png;base64,${bytes.toString('base64')}`,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function imageTag(name: string, scale: number): string {
  const image = pngDataUrl(name);
  if (!image) return '<p>Template image is missing.</p>';
  const width = Math.max(1, Math.round(image.width / scale));
  const height = Math.max(1, Math.round(image.height / scale));
  return `<img alt="" width="${width}" height="${height}" src="${image.src}" />`;
}

function testHtml(scale: number): string {
  const shellActions = `<div class="actions shell-actions">
    ${imageTag('always-run.png', scale)}
    ${imageTag('run.png', scale)}
  </div>`;
  const allowActions = `<div class="actions allow-actions">${imageTag('allow.png', scale)}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { margin: 0; background: #1e1e1e; color: #cccccc; font: 13px/1.45 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; }
  main { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .hint { margin: 0; color: #9aa0a6; font-size: 11px; line-height: 1.35; }
  .card {
    background: #252526;
    border: 1px solid #3c3c3c;
    border-radius: 8px;
    padding: 12px 14px 10px;
  }
  .card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #e0e0e0; font-size: 12px; font-weight: 600; }
  .card-head .badge {
    width: 18px; height: 18px; border-radius: 4px; background: #2d2d30;
    border: 1px solid #454545; display: inline-flex; align-items: center; justify-content: center;
    font-size: 10px; color: #9cdcfe;
  }
  .card p { margin: 0 0 8px; color: #b0b0b0; font-size: 12px; }
  .command {
    margin: 0 0 10px;
    padding: 8px 10px;
    background: #1e1e1e;
    border: 1px solid #333;
    border-radius: 6px;
    font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: #d4d4d4;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; min-height: 28px; }
  .shell-actions { margin-top: 2px; }
  img { display: block; image-rendering: pixelated; flex-shrink: 0; }
</style>
</head>
<body>
<main>
  <section class="card" aria-label="Shell approval">
    <div class="card-head"><span class="badge">&gt;_</span> Shell</div>
    <p>The agent wants to run this command. Use <strong>Start Auto Run</strong> to click the blue <strong>Run</strong> button, or <strong>Auto Always Run</strong> for <strong>Always Run</strong> (to its left).</p>
    <div class="command">echo "cursor-auto-runner test" &amp;&amp; cat package.json | head -n 3</div>
    ${shellActions}
  </section>
  <section class="card" aria-label="Permission approval">
    <div class="card-head"><span class="badge">!</span> Approval</div>
    <p>Some prompts only show a blue <strong>Allow</strong> control. Auto Run clicks it when it appears.</p>
    ${allowActions}
  </section>
  <p class="hint">Tray → Test buttons… · Images match bundled templates at native scale. Stats click count should increase when a mode is active.</p>
</main>
</body>
</html>`;
}

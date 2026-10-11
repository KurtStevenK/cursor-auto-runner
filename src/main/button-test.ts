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
    width: 520,
    height: 300,
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
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { margin: 0; background: #1e1e1e; color: #d4d4d4; font: 13px/1.4 -apple-system, Segoe UI, sans-serif; }
  main { padding: 20px 24px; }
  p { margin: 0 0 16px; max-width: 460px; }
  .row { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
  figure { margin: 0; }
  figcaption { color: #9aa0a6; font-size: 11px; margin-bottom: 6px; }
  img { display: block; image-rendering: pixelated; }
</style>
</head>
<body>
<main>
  <p>Start Auto Run to click Run or Allow. Start Auto Always Run to click Always Run, which sits to the left of Run. The click count in Stats should go up.</p>
  <div class="row">
    <figure><figcaption>Always Run</figcaption>${imageTag('always-run.png', scale)}</figure>
    <figure><figcaption>Run</figcaption>${imageTag('run.png', scale)}</figure>
  </div>
  <div class="row">
    <figure><figcaption>Allow</figcaption>${imageTag('allow.png', scale)}</figure>
  </div>
</main>
</body>
</html>`;
}

/* Diagnostic 2: call autoRunner.close() directly and trace the IPC. */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let overlay = null;
ipcMain.on('close-overlay', (e) => { console.log('IPC close-overlay received from webContents', e.sender.id); overlay?.close(); });

app.whenReady().then(async () => {
  overlay = new BrowserWindow({
    width: 380, height: 560, show: false, frame: false, resizable: false,
    alwaysOnTop: true, backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(ROOT, 'dist', 'src', 'main', 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  overlay.webContents.on('console-message', (_e, level, message) => console.log('[renderer]', message));
  await overlay.loadFile(path.join(ROOT, 'dist', 'src', 'overlay', 'index.html'));
  overlay.show();
  await new Promise((r) => setTimeout(r, 800));
  const state = await overlay.webContents.executeJavaScript(`
    (() => {
      try {
        window.autoRunner.close();
        return 'close() called without error';
      } catch (err) {
        return 'close() threw: ' + err.message;
      }
    })()
  `);
  console.log('renderer:', state);
  await new Promise((r) => setTimeout(r, 600));
  console.log('window destroyed after close():', overlay.isDestroyed());
  app.exit(0);
}).catch((err) => { console.error('diag error:', err); app.exit(1); });

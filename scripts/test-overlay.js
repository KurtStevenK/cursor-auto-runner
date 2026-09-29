/**
 * Temporary diagnostic: opens the stats overlay exactly like main.ts does,
 * registers the same IPC handlers (with a fake snapshot), then checks:
 *  1. does the preload expose window.autoRunner?
 *  2. does clicking #close reach the main process (CLOSE_OVERLAY)?
 *  3. does Escape reach it too?
 * Prints every renderer console message so preload errors show up.
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  ipcMain.handle('get-stats', () => ({
    session: 1, day: 2, week: 3, month: 4, total: 5,
    byDay: [{ date: '2026-09-29', count: 2 }], mode: 'always-run',
    since: new Date().toISOString(), windowFound: true, pollIntervalMs: 4000,
  }));
  ipcMain.on('set-mode', () => {});
  ipcMain.on('close-overlay', () => {
    console.log('>>> MAIN RECEIVED close-overlay — X button WORKS');
    app.quit();
  });

  const win = new BrowserWindow({
    width: 380, height: 560, show: false, frame: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'dist', 'src', 'main', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${sourceId}:${line} ${message}`);
  });
  win.loadFile(path.join(__dirname, '..', 'dist', 'src', 'overlay', 'index.html'));

  win.webContents.once('did-finish-load', async () => {
    try {
      const t = await win.webContents.executeJavaScript('typeof window.autoRunner');
      console.log('>>> typeof window.autoRunner =', t);
      if (t === 'undefined') {
        console.log('>>> PRELOAD BROKEN — this is the root cause');
        app.quit();
        return;
      }
      const snap = await win.webContents.executeJavaScript('window.autoRunner.getStats().then(s => s.total)');
      console.log('>>> getStats().total =', snap);
      await win.webContents.executeJavaScript("document.getElementById('close').click()");
      console.log('>>> clicked #close — waiting for IPC…');
      setTimeout(() => { console.log('>>> NO close-overlay received — X button BROKEN'); app.quit(); }, 3000);
    } catch (e) {
      console.log('>>> TEST ERROR:', e.message);
      app.quit();
    }
  });
});
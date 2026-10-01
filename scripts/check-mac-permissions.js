/* Log macOS permission APIs vs a short desktopCapturer probe (run with Electron). */
const { app, desktopCapturer, systemPreferences } = require('electron');
const macPerm = require('@nut-tree-fork/node-mac-permissions');

async function probeScreen() {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 64, height: 64 },
  });
  const source = sources[0];
  if (!source) return { ok: false, reason: 'no sources' };
  const size = source.thumbnail.getSize();
  const empty = source.thumbnail.isEmpty();
  return {
    ok: size.width >= 10 && size.height >= 10 && !empty,
    sourceCount: sources.length,
    size,
    empty,
  };
}

app.whenReady().then(async () => {
  const screenStatus = systemPreferences.getMediaAccessStatus('screen');
  const accessApi = systemPreferences.isTrustedAccessibilityClient(false);
  let probe = { ok: false, error: 'skipped' };
  try {
    probe = await probeScreen();
  } catch (err) {
    probe = { ok: false, error: String(err) };
  }
  console.log(
    JSON.stringify(
      {
        bundleId: app.isPackaged ? 'packaged' : 'dev',
        execPath: process.execPath,
        screenStatus,
        accessApi,
        macPermScreen: macPerm.getAuthStatus('screen'),
        macPermAccess: macPerm.getAuthStatus('accessibility'),
        screenProbe: probe,
      },
      null,
      2
    )
  );
  app.exit(0);
});

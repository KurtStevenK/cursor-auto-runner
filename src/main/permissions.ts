/**
 * macOS permission handling: the app needs Screen Recording (for screen
 * capture) and Accessibility (for window control / synthetic clicks).
 * Windows and Linux need no special permissions.
 */
import { systemPreferences, dialog, shell } from 'electron';
import * as path from 'path';

/** Warm up Screen Recording checks before desktopCapturer (macOS). */
export async function ensureMacScreenCapture(): Promise<void> {
  if (process.platform !== 'darwin') return;
  systemPreferences.getMediaAccessStatus('screen');
}

/** Returns true when all required macOS permissions are granted (or not on macOS at all). */
export async function ensureMacPermissions(): Promise<boolean> {
  if (process.platform !== 'darwin') return true;

  await ensureMacScreenCapture();
  const screenOk = systemPreferences.getMediaAccessStatus('screen') === 'granted';
  const accessOk = systemPreferences.isTrustedAccessibilityClient(false);
  if (screenOk && accessOk) return true;

  const { response } = await dialog.showMessageBox({
    type: 'warning',
    title: 'Cursor Auto Runner — permissions needed',
    message: 'macOS permissions required',
    detail:
      'Cursor Auto Runner needs two permissions to work:\n\n' +
      '1. Screen Recording — to watch the Cursor window for the Run button.\n' +
      '2. Accessibility — to move the mouse and click.\n\n' +
      'Grant both in System Settings → Privacy & Security, then start Auto Run again.',
    buttons: ['Open Screen Recording', 'Open Accessibility', 'Later'],
    defaultId: 0,
    icon: path.join(appIconDir(), 'icon-128.png'),
  });
  if (response === 0) {
    await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
  } else if (response === 1) {
    await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
  }
  return false;
}

function appIconDir(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const electron = require('electron');
  // app.getAppPath() is the project root in dev and resources/app.asar when packaged.
  return path.join(electron.app.getAppPath(), 'assets', 'icons');
}

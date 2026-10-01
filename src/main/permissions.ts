/**
 * macOS permission handling: the app needs Screen Recording (for screen
 * capture) and Accessibility (for window control / synthetic clicks).
 * Windows and Linux need no special permissions.
 */
import { dialog, shell } from 'electron';
import * as path from 'path';
import { formatMacPermissionDialogDetail } from './mac-permission-detail';
import { macPermissionsSnapshot, macScreenRecordingGranted } from './mac-permission-status';

/** Warm up Screen Recording checks before desktopCapturer (macOS). */
export async function ensureMacScreenCapture(): Promise<void> {
  if (process.platform !== 'darwin') return;
  await macScreenRecordingGranted();
}

/** Returns true when all required macOS permissions are granted (or not on macOS at all). */
export async function ensureMacPermissions(): Promise<boolean> {
  if (process.platform !== 'darwin') return true;

  for (;;) {
    const snapshot = await macPermissionsSnapshot();
    if (snapshot.screenOk && snapshot.accessOk) return true;

    const { response } = await dialog.showMessageBox({
      type: 'warning',
      title: 'Cursor Auto Runner — permissions needed',
      message: 'macOS permissions required',
      detail: formatMacPermissionDialogDetail(snapshot),
      buttons: ['Try again', 'Open Screen Recording', 'Open Accessibility', 'Cancel'],
      defaultId: 0,
      cancelId: 3,
      icon: path.join(appIconDir(), 'icon-128.png'),
    });

    if (response === 3) return false;
    if (response === 1) {
      await shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
      );
      continue;
    }
    if (response === 2) {
      await shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
      );
      continue;
    }
    /* Try again (0) or fall-through: re-check */
  }
}

function appIconDir(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const electron = require('electron');
  // app.getAppPath() is the project root in dev and resources/app.asar when packaged.
  return path.join(electron.app.getAppPath(), 'assets', 'icons');
}

import { desktopCapturer, systemPreferences } from 'electron';
import { getAuthStatus } from '@nut-tree-fork/node-mac-permissions';
import type { MacPermissionSnapshot } from './mac-permission-detail';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True when desktopCapturer returns a non-empty screen thumbnail (real capture works). */
export async function probeScreenCapture(): Promise<boolean> {
  const thumbnailSize = { width: 64, height: 64 };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize });
      const source = sources[0];
      const size = source?.thumbnail.getSize();
      if (source && size && size.width >= 10 && size.height >= 10 && !source.thumbnail.isEmpty()) {
        return true;
      }
    } catch {
      /* retry */
    }
    if (attempt < 2) await sleep(150 * (attempt + 1));
  }
  return false;
}

/** Screen Recording: Electron API, TCC, or a live capture probe (adhoc rebuilds often lie in API only). */
export async function macScreenRecordingGranted(): Promise<boolean> {
  systemPreferences.getMediaAccessStatus('screen');
  if (systemPreferences.getMediaAccessStatus('screen') === 'granted') return true;

  try {
    // Electron typings omit screen; macOS supports it for Screen Recording prompts.
    await (systemPreferences.askForMediaAccess as (mediaType: string) => Promise<boolean>)('screen');
  } catch {
    /* unsupported on older macOS */
  }
  if (systemPreferences.getMediaAccessStatus('screen') === 'granted') return true;
  if (getAuthStatus('screen') === 'authorized') return true;
  return await probeScreenCapture();
}

/** Accessibility: Electron trust check or native TCC status for this process. */
export function macAccessibilityGranted(): boolean {
  if (systemPreferences.isTrustedAccessibilityClient(false)) return true;
  return getAuthStatus('accessibility') === 'authorized';
}

export async function macPermissionsSnapshot(): Promise<MacPermissionSnapshot> {
  const screenOk = await macScreenRecordingGranted();
  const accessOk = macAccessibilityGranted();
  return {
    screenOk,
    accessOk,
    electronScreenStatus: systemPreferences.getMediaAccessStatus('screen'),
    macPermScreen: getAuthStatus('screen'),
    macPermAccessibility: getAuthStatus('accessibility'),
    electronAccessibility: systemPreferences.isTrustedAccessibilityClient(false),
  };
}

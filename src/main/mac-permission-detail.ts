export type MacPermissionSnapshot = {
  screenOk: boolean;
  accessOk: boolean;
  electronScreenStatus: string;
  macPermScreen: string;
  macPermAccessibility: string;
  electronAccessibility: boolean;
};

export function formatMacPermissionDialogDetail(snapshot: MacPermissionSnapshot): string {
  const missing: string[] = [];
  if (!snapshot.screenOk) {
    missing.push(
      `Screen Recording (Electron: ${snapshot.electronScreenStatus}, system: ${snapshot.macPermScreen})`
    );
  }
  if (!snapshot.accessOk) {
    missing.push(
      `Accessibility (Electron: ${snapshot.electronAccessibility ? 'trusted' : 'not trusted'}, system: ${snapshot.macPermAccessibility})`
    );
  }

  let detail =
    'Cursor Auto Runner needs Screen Recording (watch Cursor for Run) and Accessibility (click the button).\n\n';
  if (missing.length) {
    detail += `Still missing:\n${missing.map((line) => `• ${line}`).join('\n')}\n\n`;
  }
  detail +=
    'If both toggles are already ON in System Settings but this dialog keeps appearing:\n' +
    '1. Quit Cursor Auto Runner completely.\n' +
    '2. Remove it from both permission lists, then open /Applications/Cursor Auto Runner.app again.\n' +
    '3. Turn both permissions back ON and click Try again.\n\n' +
    'After a Homebrew upgrade you may need to do this once while the app is not Developer ID–signed.';
  return detail;
}

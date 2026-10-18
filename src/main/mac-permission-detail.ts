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
  if (!snapshot.screenOk) missing.push('Screen Recording (lets the app see Cursor)');
  if (!snapshot.accessOk) missing.push('Accessibility (lets the app click the button)');

  let detail = '';
  if (missing.length) {
    detail +=
      `Missing: ${missing.join(' and ')}.\n\n` +
      'What to do: click the matching "Open" button below, switch Cursor Auto Runner on in the list, then click Try again.\n\n';
  } else {
    detail += 'Both permissions look granted. Click Try again to continue.\n\n';
  }
  detail +=
    'If the switches are already on but this dialog keeps appearing:\n' +
    '1. Quit Cursor Auto Runner completely.\n' +
    '2. Remove it from both permission lists, then open /Applications/Cursor Auto Runner.app again.\n' +
    '3. Turn both permissions back on and click Try again.\n' +
    'After a Homebrew upgrade you may need to do this once while the app is not Developer ID–signed.\n\n';
  detail +=
    `Technical details: Screen Recording — Electron: ${snapshot.electronScreenStatus}, system: ${snapshot.macPermScreen}; ` +
    `Accessibility — Electron: ${snapshot.electronAccessibility ? 'trusted' : 'not trusted'}, system: ${snapshot.macPermAccessibility}.`;
  return detail;
}

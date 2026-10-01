/** Lazy load native TCC checks (macOS only; optional dep may be absent on other OSes in CI). */

export function macPermAuthStatus(type: string): string {
  if (process.platform !== 'darwin') return 'not determined';
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getAuthStatus } = require('@nut-tree-fork/node-mac-permissions') as {
      getAuthStatus: (t: string) => string;
    };
    return getAuthStatus(type);
  } catch {
    return 'not determined';
  }
}

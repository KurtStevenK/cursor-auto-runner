/** Compare numeric release tags. Pre-release suffixes are ignored. */

export const CASK_NAME = 'cursor-auto-runner';
export const BREW_CANDIDATES = ['/opt/homebrew/bin/brew', '/usr/local/bin/brew'];
export const BREW_UPGRADE_ARGS = ['upgrade', '--cask', CASK_NAME] as const;

export function parseVersion(value: string): [number, number, number] | null {
  const match = value
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Negative when `left` is older than `right`. Null when either side is not a version. */
export function compareVersions(left: string, right: string): number | null {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

export function isNewerVersion(latest: string, current: string): boolean {
  const order = compareVersions(latest, current);
  return order !== null && order > 0;
}

export function firstExistingPath(
  candidates: string[],
  exists: (file: string) => boolean
): string | null {
  return candidates.find((candidate) => exists(candidate)) ?? null;
}

/** `/opt/homebrew/bin/brew` → `/opt/homebrew/Caskroom/cursor-auto-runner`. */
export function caskroomForBrew(brewPath: string): string {
  const prefix = brewPath.replace(/\/bin\/brew$/, '');
  return `${prefix}/Caskroom/${CASK_NAME}`;
}

export type UpdateChannel = 'brew' | 'electron-updater' | 'github-page';

/** Which update mechanism applies: Homebrew cask, electron-updater (NSIS / macOS), or the release page. */
export function updateChannelFor(input: {
  platform: string;
  isPackaged: boolean;
  brewCask: boolean;
}): UpdateChannel {
  if (!input.isPackaged) return 'github-page';
  if (input.platform === 'darwin' && input.brewCask) return 'brew';
  if (input.platform === 'win32' || input.platform === 'darwin') return 'electron-updater';
  return 'github-page';
}

export const VERSION = __APP_VERSION__;
/** Linux Firebase mirror (may match latest GitHub release before next CI upload). */
export const LINUX_MIRROR_VERSION = __LINUX_MIRROR_VERSION__;
export const STORAGE_BUCKET = __STORAGE_BUCKET__;

const GITHUB = 'https://github.com/KurtStevenK/cursor-auto-runner';

export const links = {
  github: GITHUB,
  releases: `${GITHUB}/releases/latest`,
  releaseTag: (v: string) => `${GITHUB}/releases/tag/v${v}`,
  homebrew: 'https://github.com/KurtStevenK/homebrew-tap',
  apt: 'https://github.com/KurtStevenK/apt',
  ghPages: 'https://kurtstevenk.github.io/cursor-auto-runner/',
};

function storageUrl(objectPath: string) {
  const encoded = objectPath.split('/').map(encodeURIComponent).join('%2F');
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encoded}?alt=media`;
}

/** Legacy Linux path: `linux/<version>/<file>`. */
export function storageObjectUrl(version: string, fileName: string) {
  return storageUrl(`linux/${version}/${fileName}`);
}

/** All-platform mirror: `releases/<version>/<file>`. */
export function releaseMirrorUrl(version: string, fileName: string) {
  return storageUrl(`releases/${version}/${fileName}`);
}

export const linuxFiles = (version = VERSION) => ({
  appImage: `cursor-auto-runner-${version}.AppImage`,
  deb: `cursor-auto-runner_${version}_amd64.deb`,
  pacman: `cursor-auto-runner-${version}.pacman`,
});

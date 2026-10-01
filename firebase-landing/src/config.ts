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

/** Public download URL for objects under `linux/<version>/`. */
export function storageObjectUrl(version: string, fileName: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/linux%2F${version}%2F${encodeURIComponent(fileName)}?alt=media`;
}

export const linuxFiles = (version = VERSION) => ({
  appImage: `cursor-auto-runner-${version}.AppImage`,
  deb: `cursor-auto-runner_${version}_amd64.deb`,
  pacman: `cursor-auto-runner-${version}.pacman`,
});

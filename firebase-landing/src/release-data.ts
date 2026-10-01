import type { ReleaseManifest } from './release-types';
import { RELEASE_DATA } from './config';

export type ReleaseAsset = ReleaseManifest['assets'][number];

export const releaseData: ReleaseManifest = RELEASE_DATA;

export function assetsForPlatform(platform: ReleaseAsset['platform']) {
  return releaseData.assets.filter((a) => a.sha256 && a.platform === platform);
}

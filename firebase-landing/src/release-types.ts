export type ReleaseManifest = {
  version: string;
  assets: {
    name: string;
    sha256: string;
    platform: 'macOS' | 'Linux' | 'Windows';
  }[];
};

import { CopyCommand } from './CopyCommand';
import { releaseMirrorUrl } from '../config';
import releaseData from '../data/release-1.2.28.json';

export type ReleaseAsset = (typeof releaseData.assets)[number];

export function assetsForPlatform(platform: ReleaseAsset['platform']) {
  return releaseData.assets.filter((a) => a.sha256 && a.platform === platform);
}

function linuxVerify(asset: ReleaseAsset) {
  return `echo "${asset.sha256}  ${asset.name}" | sha256sum -c -`;
}

function macVerify(asset: ReleaseAsset) {
  return `echo "${asset.sha256}  ${asset.name}" | shasum -a 256 -c -`;
}

function winVerify(asset: ReleaseAsset) {
  return `certutil -hashfile "${asset.name}" SHA256`;
}

export function ChecksumBlock({ assets, version }: { assets: ReleaseAsset[]; version: string }) {
  if (assets.length === 0) return null;

  return (
    <div className="install-checksums">
      <p className="install-checksums-title">Checksums &amp; verify</p>
      {assets.map((asset) => (
        <div key={asset.name} className="install-checksum-asset">
          <a
            href={releaseMirrorUrl(version, asset.name)}
            target="_blank"
            rel="noreferrer"
            className="file-link install-checksum-file"
          >
            {asset.name}
          </a>
          <CopyCommand
            label="SHA-256"
            command={asset.sha256}
            hint="Expected digest for this file. Your local hash must match exactly (case-insensitive on Windows)."
          />
          {asset.platform === 'Linux' && (
            <CopyCommand
              label="Verify (Linux)"
              command={linuxVerify(asset)}
              hint={`Save the file as ${asset.name} in your current directory, then run — sha256sum -c confirms integrity.`}
            />
          )}
          {asset.platform === 'macOS' && (
            <CopyCommand
              label="Verify (macOS)"
              command={macVerify(asset)}
              hint={`File must be named ${asset.name} in the working directory. shasum -c prints OK when the hash matches.`}
            />
          )}
          {asset.platform === 'Windows' && (
            <CopyCommand
              label="Verify (Windows)"
              command={winVerify(asset)}
              hint="Run in cmd or PowerShell where the installer was downloaded; compare the printed hash to SHA-256 above."
            />
          )}
        </div>
      ))}
    </div>
  );
}

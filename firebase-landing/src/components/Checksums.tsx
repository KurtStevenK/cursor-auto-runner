import { CopyCommand } from './CopyCommand';
import { releaseMirrorUrl } from '../config';
import releaseData from '../data/release-1.2.28.json';

type Asset = (typeof releaseData.assets)[number];

function linuxVerify(asset: Asset) {
  return `echo "${asset.sha256}  ${asset.name}" | sha256sum -c -`;
}

function macVerify(asset: Asset) {
  return `echo "${asset.sha256}  ${asset.name}" | shasum -a 256 -c -`;
}

function winVerify(asset: Asset) {
  return `certutil -hashfile "${asset.name}" SHA256`;
}

export function Checksums() {
  const v = releaseData.version;
  const withHash = releaseData.assets.filter((a) => a.sha256);

  return (
    <section className="section checksums">
      <h2>Checksums &amp; verify</h2>
      <p className="section-sub">
        Mirrors live under <code>releases/{v}/</code> on Firebase Storage. Download, then run the
        matching verify command (one copy per step).
      </p>
      <div className="checksum-list">
        {withHash.map((asset) => (
          <article key={asset.name} className="checksum-card">
            <div className="checksum-head">
              <span className="platform-tag">{asset.platform}</span>
              <a
                href={releaseMirrorUrl(v, asset.name)}
                target="_blank"
                rel="noreferrer"
                className="file-link"
              >
                {asset.name}
              </a>
            </div>
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
          </article>
        ))}
      </div>
    </section>
  );
}

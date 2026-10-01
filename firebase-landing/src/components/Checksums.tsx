import { useId, useState } from 'react';
import { CopyCommand } from './CopyCommand';
import { links, releaseMirrorUrl } from '../config';
import releaseData from '../data/release-1.2.28.json';

type Asset = (typeof releaseData.assets)[number];

type ChecksumTab = 'mac' | 'win' | 'linux' | 'dev';

const TABS: { id: ChecksumTab; label: string; icon: string }[] = [
  { id: 'mac', label: 'macOS', icon: '🍎' },
  { id: 'win', label: 'Windows', icon: '🪟' },
  { id: 'linux', label: 'Linux', icon: '🐧' },
  { id: 'dev', label: 'Development', icon: '🛠️' },
];

const PLATFORM_BY_TAB: Record<Exclude<ChecksumTab, 'dev'>, Asset['platform']> = {
  mac: 'macOS',
  win: 'Windows',
  linux: 'Linux',
};

function linuxVerify(asset: Asset) {
  return `echo "${asset.sha256}  ${asset.name}" | sha256sum -c -`;
}

function macVerify(asset: Asset) {
  return `echo "${asset.sha256}  ${asset.name}" | shasum -a 256 -c -`;
}

function winVerify(asset: Asset) {
  return `certutil -hashfile "${asset.name}" SHA256`;
}

function AssetChecksums({ asset }: { asset: Asset }) {
  return (
    <article className="checksum-card">
      <div className="checksum-head">
        <a
          href={releaseMirrorUrl(releaseData.version, asset.name)}
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
  );
}

export function Checksums() {
  const baseId = useId();
  const [tab, setTab] = useState<ChecksumTab>('linux');
  const v = releaseData.version;
  const withHash = releaseData.assets.filter((a) => a.sha256);

  const assetsForTab = (id: Exclude<ChecksumTab, 'dev'>) =>
    withHash.filter((a) => a.platform === PLATFORM_BY_TAB[id]);

  return (
    <section className="section checksums">
      <h2>Checksums &amp; verify</h2>
      <p className="section-sub">
        Mirrors live under <code>releases/{v}/</code> on Firebase Storage. Pick a platform tab, download
        the file, then copy the verify command for that artifact.
      </p>

      <div className="install-tabs-wrap">
        <div className="install-tabs" role="tablist" aria-label="Checksum platform and development">
          {TABS.map(({ id, label, icon }) => {
            const selected = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`${baseId}-tab-${id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${id}`}
                tabIndex={selected ? 0 : -1}
                className={`install-tab${selected ? ' install-tab--active' : ''}`}
                onClick={() => setTab(id)}
              >
                <span className="install-tab-icon" aria-hidden="true">{icon}</span>
                {label}
              </button>
            );
          })}
        </div>

        {(['mac', 'win', 'linux'] as const).map((id) => (
          <div
            key={id}
            id={`${baseId}-panel-${id}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${id}`}
            hidden={tab !== id}
            className="install-tabpanel"
          >
            <div className="checksum-list">
              {assetsForTab(id).map((asset) => (
                <AssetChecksums key={asset.name} asset={asset} />
              ))}
            </div>
          </div>
        ))}

        <div
          id={`${baseId}-panel-dev`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-dev`}
          hidden={tab !== 'dev'}
          className="install-tabpanel"
        >
          <div className="install-layout">
            <div className="checksum-card checksum-card--dev">
              <p className="checksum-dev-lead">
                Release checksums are listed per platform in the other tabs. Use these commands when
                mirroring or auditing a full GitHub release locally.
              </p>
              <CopyCommand
                label="Download all release assets"
                command={`gh release download v${v} --repo KurtStevenK/cursor-auto-runner`}
                hint="Requires GitHub CLI. Files land in the current directory — verify each with the platform tab commands."
              />
              <CopyCommand
                label="Open release in browser"
                command={`gh release view v${v} --repo KurtStevenK/cursor-auto-runner --web`}
                hint="GitHub shows attached DMG, EXE, AppImage, .deb, and .pacman for this version."
              />
              <p className="checksum-dev-footer">
                <a href={links.releases} target="_blank" rel="noreferrer">
                  Latest release on GitHub
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

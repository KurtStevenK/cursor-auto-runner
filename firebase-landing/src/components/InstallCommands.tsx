import { useId, useState, type ReactNode } from 'react';
import { ChecksumBlock, assetsForPlatform } from './ChecksumBlock';
import { CopyCommand } from './CopyCommand';
import releaseData from '../data/release-1.2.28.json';
import { links, linuxFiles, releaseMirrorUrl } from '../config';

type Props = { mirrorV: string };

type PlatformTab = 'mac' | 'win' | 'linux' | 'dev';

const APT_IMPORT_GPG =
  'curl -fsSL https://kurtstevenk.github.io/apt/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/cursor-auto-runner-archive-keyring.gpg';

const APT_ADD_SOURCE =
  'echo "deb [signed-by=/usr/share/keyrings/cursor-auto-runner-archive-keyring.gpg] https://kurtstevenk.github.io/apt stable main" | sudo tee /etc/apt/sources.list.d/cursor-auto-runner.list';

const HOMEBREW_INSTALL =
  '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';

const CHOCOLATEY_INSTALL =
  'Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString(\'https://community.chocolatey.org/install.ps1\'))';

const TABS: { id: PlatformTab; label: string; icon: string }[] = [
  { id: 'mac', label: 'macOS', icon: '🍎' },
  { id: 'win', label: 'Windows', icon: '🪟' },
  { id: 'linux', label: 'Linux', icon: '🐧' },
  { id: 'dev', label: 'Development', icon: '🛠️' },
];

function OsGroup({
  icon,
  title,
  description,
  children,
  checksum,
  footer,
  className = '',
}: {
  icon: string;
  title: string;
  description?: string;
  children: ReactNode;
  checksum?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`install-os-group ${className}`.trim()}>
      <h3 className="install-os-title">
        <span className="install-os-icon" aria-hidden="true">{icon}</span>
        {title}
      </h3>
      {description ? <p className="install-os-desc">{description}</p> : null}
      <div className="install-os-commands">{children}</div>
      {checksum}
      {footer ? <div className="install-os-footer">{footer}</div> : null}
    </div>
  );
}

export function InstallCommands({ mirrorV }: Props) {
  const baseId = useId();
  const [tab, setTab] = useState<PlatformTab>('linux');
  const linux = linuxFiles(mirrorV);
  const appImageUrl = releaseMirrorUrl(mirrorV, linux.appImage);
  const pacmanUrl = releaseMirrorUrl(mirrorV, linux.pacman);
  const debUrl = releaseMirrorUrl(mirrorV, linux.deb);
  const checksumV = releaseData.version;
  const macAssets = assetsForPlatform('macOS');
  const winAssets = assetsForPlatform('Windows');
  const linuxAssets = assetsForPlatform('Linux');
  const debChecksum = linuxAssets.filter((a) => a.name.includes('_amd64.deb'));
  const appImageChecksum = linuxAssets.filter((a) => a.name.endsWith('.AppImage'));
  const pacmanChecksum = linuxAssets.filter((a) => a.name.endsWith('.pacman'));

  return (
    <section id="install" className="section install">
      <h2>Install &amp; verify</h2>
      <p className="section-sub">
        Choose your platform — install commands and SHA-256 verify steps live in the same group. Mirrors
        under <code>releases/{checksumV}/</code> on Firebase Storage.
      </p>

      <div className="install-tabs-wrap">
        <div className="install-tabs" role="tablist" aria-label="Install platform and development">
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

        <div
          id={`${baseId}-panel-mac`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-mac`}
          hidden={tab !== 'mac'}
          className="install-tabpanel"
        >
          <div className="install-layout">
            <OsGroup
              icon="🍎"
              title="macOS"
              description="Homebrew cask installs the signed DMG into /Applications; upgrades with brew upgrade --cask."
              checksum={<ChecksumBlock version={checksumV} assets={macAssets} />}
            >
              <CopyCommand
                label="Add tap (first time)"
                command="brew tap KurtStevenK/tap"
                hint="Same repo as KurtStevenK/homebrew-tap on GitHub — Homebrew exposes it as KurtStevenK/tap. One-time; enables the short cask name below."
              />
              <CopyCommand
                label="Install cask"
                command="brew install --cask cursor-auto-runner"
                hint="Installs from Casks/cursor-auto-runner.rb in that tap. Grant Screen Recording and Accessibility after first launch."
              />
              <CopyCommand
                label="One-liner (skip tap step)"
                command="brew install --cask KurtStevenK/tap/cursor-auto-runner"
                fullWidth
                hint="Equivalent to tap + install cask when you do not want a permanent tap on your machine."
              />
              <CopyCommand
                label="Install Homebrew (optional)"
                command={HOMEBREW_INSTALL}
                fullWidth
                hint="Only if brew is not installed yet. Run this before the tap/cask steps. On Apple silicon, add brew to PATH using the lines the installer prints."
              />
            </OsGroup>
          </div>
        </div>

        <div
          id={`${baseId}-panel-win`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-win`}
          hidden={tab !== 'win'}
          className="install-tabpanel"
        >
          <div className="install-layout">
            <OsGroup
              icon="🪟"
              title="Windows"
              description="Chocolatey serves the same NSIS build as the Setup.exe download."
              checksum={<ChecksumBlock version={checksumV} assets={winAssets} />}
              footer={
                <a href={`${links.github}/blob/master/packaging/chocolatey/README.md`} target="_blank" rel="noreferrer">
                  Chocolatey packaging notes
                </a>
              }
            >
              <CopyCommand
                label="Install package"
                command="choco install cursor-auto-runner"
                hint="Use an elevated PowerShell or cmd if your org requires it. Upgrade: choco upgrade cursor-auto-runner"
              />
              <CopyCommand
                label="Install Chocolatey (optional)"
                command={CHOCOLATEY_INSTALL}
                fullWidth
                hint="Run in PowerShell as Administrator before choco install. Close and reopen the shell after install. See chocolatey.org/install for troubleshooting."
              />
            </OsGroup>
          </div>
        </div>

        <div
          id={`${baseId}-panel-linux`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-linux`}
          hidden={tab !== 'linux'}
          className="install-tabpanel"
        >
          <div className="install-layout">
            <OsGroup
              icon="🐧"
              title="Debian"
              description="Signed APT repo (amd64). Recommended on Debian 11+; use AppImage on very old glibc if the .deb refuses to start."
              checksum={<ChecksumBlock version={checksumV} assets={debChecksum} />}
              footer={
                <a href={links.aptReadme} target="_blank" rel="noreferrer">
                  Full APT repo documentation
                </a>
              }
            >
              <CopyCommand
                label="Import repo signing key"
                command={APT_IMPORT_GPG}
                hint="One-time per machine. Stores the KurtStevenK/apt signing key for apt."
              />
              <CopyCommand
                label="Add apt source"
                command={APT_ADD_SOURCE}
                hint="Points apt at https://kurtstevenk.github.io/apt stable main."
              />
              <CopyCommand
                label="Update package lists"
                command="sudo apt-get update"
                hint="Run after adding the source so apt sees cursor-auto-runner."
              />
              <CopyCommand
                label="Install package"
                command="sudo apt-get install cursor-auto-runner"
                hint="Installs menu entry and binary; future releases: sudo apt-get upgrade."
              />
              <CopyCommand
                label="Or install local .deb (optional)"
                command={`curl -fLO '${debUrl}' && sudo apt install ./${linux.deb}`}
                fullWidth
                hint="Alternative to the APT repo above — one version only. Same .deb on GitHub Releases or under Downloads."
              />
            </OsGroup>

            <OsGroup
              icon="🐧"
              title="Ubuntu"
              description="Same KurtStevenK/apt repository as Debian — typical targets: Ubuntu 22.04 LTS and 24.04 (amd64)."
              footer={
                <a href={links.aptRepo} target="_blank" rel="noreferrer">
                  APT repo on GitHub Pages
                </a>
              }
            >
              <CopyCommand
                label="Import repo signing key"
                command={APT_IMPORT_GPG}
                hint="Identical to Debian; safe to repeat if the keyring file already exists."
              />
              <CopyCommand
                label="Add apt source"
                command={APT_ADD_SOURCE}
                hint="Uses signed-by keyring — no apt-key deprecated workflow."
              />
              <CopyCommand
                label="Update package lists"
                command="sudo apt-get update"
              />
              <CopyCommand
                label="Install package"
                command="sudo apt-get install cursor-auto-runner"
                hint="Tray app needs a desktop session (Wayland/X11). Grant accessibility if your distro prompts for it."
              />
            </OsGroup>

            <OsGroup
              icon="📦"
              title="AppImage (any distro)"
              description="Portable binary — no root, no package manager. Best when APT/pacman does not fit or you want a single file."
              checksum={<ChecksumBlock version={checksumV} assets={appImageChecksum} />}
            >
              <CopyCommand
                label="Download AppImage"
                command={`curl -fLO '${appImageUrl}'`}
                hint="Firebase mirror; same file as GitHub Releases. Or pick AppImage under Downloads above."
              />
              <CopyCommand
                label="Run AppImage"
                command={`chmod +x ${linux.appImage} && ./${linux.appImage}`}
                hint="Run from the folder where you saved the file. If it fails to start, install FUSE (e.g. sudo apt install libfuse2 on Debian/Ubuntu)."
              />
            </OsGroup>

            <OsGroup
              icon="🐧"
              title="Arch Linux"
              description="Official release ships a .pacman package (not in AUR). Install with pacman -U after download."
              checksum={<ChecksumBlock version={checksumV} assets={pacmanChecksum} />}
              footer={
                <a href={`${links.github}/releases/latest`} target="_blank" rel="noreferrer">
                  .pacman on GitHub Releases
                </a>
              }
            >
              <CopyCommand
                label="Download .pacman"
                command={`curl -fLO '${pacmanUrl}'`}
                hint={`File name: ${linux.pacman}. Also attached to each GitHub release and listed under Linux downloads (.pacman link).`}
              />
              <CopyCommand
                label="Install package"
                command={`sudo pacman -U ${linux.pacman}`}
                hint="Installs system-wide. Upgrade: download the new .pacman and run pacman -U again (pacman may ask to replace the existing package)."
              />
            </OsGroup>
          </div>
        </div>

        <div
          id={`${baseId}-panel-dev`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-dev`}
          hidden={tab !== 'dev'}
          className="install-tabpanel"
        >
          <div className="install-layout">
            <OsGroup
              icon="🛠️"
              title="Development"
              description="Repos for hacking on the app, updating the Homebrew cask, or maintaining the Debian APT tree."
              footer={
                <a href={links.github} target="_blank" rel="noreferrer">KurtStevenK/cursor-auto-runner on GitHub</a>
              }
            >
              <CopyCommand
                label="Clone app"
                command="gh repo clone KurtStevenK/cursor-auto-runner"
                hint="npm install && npm run dev — requires Node.js 20+ and Linux/macOS/Windows build deps for native modules."
              />
              <CopyCommand
                label="Clone Homebrew tap (homebrew-tap)"
                command="gh repo clone KurtStevenK/homebrew-tap"
                hint="This is what macOS users add with brew tap KurtStevenK/tap. Edit Casks/cursor-auto-runner.rb (version + DMG sha256) after each release."
              />
              <CopyCommand
                label="Clone APT repository"
                command="gh repo clone KurtStevenK/apt"
                hint="gh-pages branch hosts the public apt repo; CI runs packaging/apt/publish.sh on release."
              />
              <CopyCommand
                label="Open release in browser"
                command={`gh release view v${mirrorV} --repo KurtStevenK/cursor-auto-runner --web`}
                hint="DMG, EXE, AppImage, .deb, and .pacman assets for the mirrored version."
              />
              <CopyCommand
                label="Download all release assets"
                command={`gh release download v${checksumV} --repo KurtStevenK/cursor-auto-runner`}
                fullWidth
                hint="Requires GitHub CLI. Verify each file with the SHA-256 blocks on the platform tabs."
              />
              <CopyCommand
                label="Install GitHub CLI (optional)"
                command="brew install gh"
                fullWidth
                hint="Needed for the gh repo clone commands above. macOS via Homebrew; on Linux see github.com/cli/cli#installation."
              />
            </OsGroup>
          </div>
        </div>
      </div>
    </section>
  );
}

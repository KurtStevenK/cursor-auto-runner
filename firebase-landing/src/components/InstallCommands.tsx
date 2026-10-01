import type { ReactNode } from 'react';
import { CopyCommand } from './CopyCommand';
import { links } from '../config';

type Props = { mirrorV: string };

function OsGroup({
  icon,
  title,
  description,
  children,
  footer,
  className = '',
}: {
  icon: string;
  title: string;
  description?: string;
  children: ReactNode;
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
      {footer ? <div className="install-os-footer">{footer}</div> : null}
    </div>
  );
}

export function InstallCommands({ mirrorV }: Props) {
  return (
    <section id="install" className="section install">
      <h2>Install commands</h2>
      <p className="section-sub">Install by OS; clone and tooling under Development.</p>
      <div className="install-layout">
        <OsGroup
          icon="🍎"
          title="macOS"
          description="Homebrew installs the signed DMG into /Applications and upgrades with brew upgrade --cask."
        >
          <CopyCommand
            label="Add tap (first time)"
            command="brew tap KurtStevenK/tap"
            hint="Registers the KurtStevenK/tap formulae so the short cask name works. Needs Homebrew on your Mac."
          />
          <CopyCommand
            label="Install cask"
            command="brew install --cask cursor-auto-runner"
            hint="After install, grant Screen Recording and Accessibility. Skip the tap step with: brew install --cask KurtStevenK/tap/cursor-auto-runner"
          />
        </OsGroup>

        <OsGroup
          icon="🪟"
          title="Windows"
          description="Same NSIS installer as the direct download; Chocolatey handles upgrades and uninstall."
          footer={
            <a href={`${links.github}/blob/master/packaging/chocolatey/README.md`} target="_blank" rel="noreferrer">
              Chocolatey notes
            </a>
          }
        >
          <CopyCommand
            label="Chocolatey"
            command="choco install cursor-auto-runner"
            hint="Run in an elevated shell if your Chocolatey policy requires it. Upgrade later with choco upgrade cursor-auto-runner."
          />
        </OsGroup>

        <OsGroup
          icon="🐧"
          title="Linux"
          description="Use APT for system-wide installs and updates, or AppImage when you want a single file with no package manager."
          footer={
            <a href={links.apt} target="_blank" rel="noreferrer">APT repo setup guide</a>
          }
        >
          <CopyCommand
            label="APT (Debian/Ubuntu)"
            command="sudo apt-get install cursor-auto-runner"
            hint="Add the KurtStevenK/apt repo once (see link below), then apt update. Delivers .deb with desktop entry and upgrades via apt."
          />
          <CopyCommand
            label="AppImage"
            command={`chmod +x cursor-auto-runner-${mirrorV}.AppImage && ./cursor-auto-runner-${mirrorV}.AppImage`}
            hint={`Download cursor-auto-runner-${mirrorV}.AppImage from Downloads above first. chmod makes it executable; run from any folder. Install libfuse2 if the AppImage will not start.`}
          />
        </OsGroup>

        <OsGroup
          icon="🛠️"
          title="Development"
          description="Clone these when you ship a release, refresh the Homebrew cask SHA256s, or maintain the Debian repo."
          footer={
            <a href={links.github} target="_blank" rel="noreferrer">KurtStevenK/cursor-auto-runner on GitHub</a>
          }
        >
          <CopyCommand
            label="Clone app"
            command="gh repo clone KurtStevenK/cursor-auto-runner"
            hint="Main Electron app: npm install, npm run dev for local tray testing, npm run dist:* for installers."
          />
          <CopyCommand
            label="Clone Homebrew tap"
            command="gh repo clone KurtStevenK/homebrew-tap"
            hint="Edit Casks/cursor-auto-runner.rb after each macOS release (version + sha256 for arm64 and x64)."
          />
          <CopyCommand
            label="Clone APT repository"
            command="gh repo clone KurtStevenK/apt"
            hint="Hosts apt metadata and .deb layout consumed by the release workflow and KurtStevenK/apt users."
          />
          <CopyCommand
            label="Open release in browser"
            command={`gh release view v${mirrorV} --repo KurtStevenK/cursor-auto-runner --web`}
            hint="Opens GitHub Releases for the mirrored version — grab assets if Firebase or a package mirror is slow."
          />
        </OsGroup>
      </div>
    </section>
  );
}

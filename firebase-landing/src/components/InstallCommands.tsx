import type { ReactNode } from 'react';
import { CopyCommand } from './CopyCommand';
import { links } from '../config';

type Props = { mirrorV: string };

function OsGroup({
  icon,
  title,
  children,
  footer,
  className = '',
}: {
  icon: string;
  title: string;
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
        <OsGroup icon="🍎" title="macOS">
          <CopyCommand label="Add tap (first time)" command="brew tap KurtStevenK/tap" />
          <CopyCommand
            label="Install cask"
            command="brew install --cask cursor-auto-runner"
            hint="Or without tapping: brew install --cask KurtStevenK/tap/cursor-auto-runner"
          />
        </OsGroup>

        <OsGroup
          icon="🪟"
          title="Windows"
          footer={
            <a href={`${links.github}/blob/master/packaging/chocolatey/README.md`} target="_blank" rel="noreferrer">
              Chocolatey notes
            </a>
          }
        >
          <CopyCommand label="Chocolatey" command="choco install cursor-auto-runner" />
        </OsGroup>

        <OsGroup
          icon="🐧"
          title="Linux"
          footer={
            <a href={links.apt} target="_blank" rel="noreferrer">APT repo setup guide</a>
          }
        >
          <CopyCommand
            label="APT (Debian/Ubuntu)"
            command="sudo apt-get install cursor-auto-runner"
            hint="Configure KurtStevenK/apt once before install"
          />
          <CopyCommand
            label="AppImage"
            command={`chmod +x cursor-auto-runner-${mirrorV}.AppImage && ./cursor-auto-runner-${mirrorV}.AppImage`}
          />
        </OsGroup>

        <OsGroup
          icon="🛠️"
          title="Development"
          footer={
            <a href={links.github} target="_blank" rel="noreferrer">KurtStevenK/cursor-auto-runner on GitHub</a>
          }
        >
          <CopyCommand label="Clone app" command="gh repo clone KurtStevenK/cursor-auto-runner" />
          <CopyCommand label="Clone Homebrew tap" command="gh repo clone KurtStevenK/homebrew-tap" />
          <CopyCommand label="Clone APT repository" command="gh repo clone KurtStevenK/apt" />
          <CopyCommand
            label="Open release in browser"
            command={`gh release view v${mirrorV} --repo KurtStevenK/cursor-auto-runner --web`}
          />
        </OsGroup>
      </div>
    </section>
  );
}

import { CopyCommand } from './CopyCommand';
import { links } from '../config';

type Props = { mirrorV: string };

export function InstallCommands({ mirrorV }: Props) {
  return (
    <section id="install" className="section install">
      <h2>Install commands</h2>
      <p className="section-sub">One line per action — use the copy icon on each command.</p>
      <div className="code-cards">
        <CopyCommand
          label="Homebrew (macOS)"
          command="brew install --cask KurtStevenK/tap/cursor-auto-runner"
          hint="Tap: KurtStevenK/homebrew-tap"
        />
        <CopyCommand
          label="Homebrew tap (first time)"
          command="brew tap KurtStevenK/tap"
        />
        <CopyCommand
          label="Chocolatey (Windows)"
          command="choco install cursor-auto-runner"
        />
        <CopyCommand
          label="APT (Debian/Ubuntu)"
          command="sudo apt-get install cursor-auto-runner"
          hint="One-time repo setup: see KurtStevenK/apt on GitHub"
        />
        <CopyCommand
          label="AppImage (Linux)"
          command={`chmod +x cursor-auto-runner-${mirrorV}.AppImage && ./cursor-auto-runner-${mirrorV}.AppImage`}
        />
        <CopyCommand
          label="Clone app repository"
          command="gh repo clone KurtStevenK/cursor-auto-runner"
        />
        <CopyCommand
          label="Clone Homebrew tap"
          command="gh repo clone KurtStevenK/homebrew-tap"
        />
        <CopyCommand
          label="Clone APT repository"
          command="gh repo clone KurtStevenK/apt"
        />
        <CopyCommand
          label="Open releases in browser"
          command={`gh release view v${mirrorV} --repo KurtStevenK/cursor-auto-runner --web`}
        />
        <p className="install-link">
          <a href={links.apt} target="_blank" rel="noreferrer">APT setup guide</a>
          {' · '}
          <a href={`${links.github}/blob/master/packaging/chocolatey/README.md`} target="_blank" rel="noreferrer">
            Chocolatey notes
          </a>
        </p>
      </div>
    </section>
  );
}

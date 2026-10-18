import { Reveal } from './components/Reveal';
import { InstallCommands } from './components/InstallCommands';
import { HeroBackdrop } from './components/HeroBackdrop';
import {
  MIRROR_VERSION,
  VERSION,
  links,
  linuxFiles,
  releaseMirrorUrl,
  storageObjectUrl,
} from './config';
import { releaseData } from './release-data';
import './App.css';

const mirrorV = MIRROR_VERSION;

export default function App() {
  const linuxMirror = linuxFiles(mirrorV);

  const macArmDmg = releaseMirrorUrl(mirrorV, `Cursor.Auto.Runner-${mirrorV}-arm64.dmg`);
  const macIntelDmg = releaseMirrorUrl(mirrorV, `Cursor.Auto.Runner-${mirrorV}.dmg`);
  const winExe = releaseMirrorUrl(mirrorV, `Cursor.Auto.Runner.Setup.${mirrorV}.exe`);

  const downloads = [
    {
      os: 'Linux',
      icon: '🐧',
      blurb: 'AppImage, .deb, and Arch .pacman on Firebase (same bytes as GitHub Releases).',
      primary: {
        label: 'AppImage',
        href: releaseMirrorUrl(mirrorV, linuxMirror.appImage),
      },
      secondary: [
        { label: '.deb', href: releaseMirrorUrl(mirrorV, linuxMirror.deb) },
        { label: '.pacman', href: releaseMirrorUrl(mirrorV, linuxMirror.pacman) },
      ],
      note: `Mirror v${mirrorV} · also linux/ path on Storage`,
    },
    {
      os: 'macOS',
      icon: '🍎',
      blurb: 'Developer ID–signed DMG (Apple silicon + Intel).',
      primary: { label: 'Apple silicon DMG', href: macArmDmg },
      secondary: [
        { label: 'Intel DMG', href: macIntelDmg },
        { label: 'GitHub Releases', href: links.releases },
      ],
      note: 'Grant Screen Recording & Accessibility on first run.',
    },
    {
      os: 'Windows',
      icon: '🪟',
      blurb: 'NSIS installer mirrored on Firebase Storage.',
      primary: { label: 'Download Setup.exe', href: winExe },
      secondary: [
        { label: 'GitHub Releases', href: links.releases },
        { label: 'Chocolatey docs', href: `${links.github}/blob/master/packaging/chocolatey/README.md` },
      ],
      note: 'Or: choco install cursor-auto-runner',
    },
  ];

  const features = [
    {
      title: 'Auto Run & Always Run',
      text: 'Clicks Run and Always Run in every Cursor window — IDE and agent chat.',
    },
    {
      title: 'Approve without stalling',
      text: 'Handles Allow / Approve prompts so agents keep moving.',
    },
    {
      title: 'Live stats overlay',
      text: 'Session, day, week, month, and lifetime click counts with a 7-day chart.',
    },
    {
      title: 'Tray-first control',
      text: 'Left-click toggles stats; right-click starts modes and captures templates.',
    },
    {
      title: 'Multi-monitor & themes',
      text: 'Finds Cursor on any display, dark and light UI, with per-display DPI scaling absorbed.',
    },
    {
      title: 'Cursor-safe clicking',
      text: 'Restores the mouse pointer after each click; cooldown and match checks avoid double clicks.',
    },
  ];

  return (
    <div className="page">
      <HeroBackdrop />
      <div className="grain" aria-hidden="true" />

      <header className="top">
        <Reveal className="logo-mark" variant="scale">
          <span className="logo-core" />
        </Reveal>
        <Reveal as="span" className="version-pill">
          v{VERSION}
        </Reveal>
      </header>

      <main className="content">
        <section className="hero">
          <Reveal as="h1" delay={0.08}>
            Cursor Auto
            <span className="hero-accent"> Runner</span>
          </Reveal>
          <Reveal as="p" className="hero-lead" delay={0.16}>
            A system-tray companion that clicks <em>Run</em>, <em>Always Run</em>, and permission
            buttons in Cursor — so you stay in flow while agents work.
          </Reveal>
          <Reveal as="div" className="hero-cta" delay={0.24}>
            <a className="btn btn-primary" href="#downloads">Get builds</a>
            <a className="btn btn-ghost" href="#install">Install commands</a>
            <a className="btn btn-ghost" href={links.github} target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
          </Reveal>
        </section>

        <Reveal as="section" id="downloads" inView className="section">
          <h2>Downloads</h2>
          <p className="section-sub">
            Public mirrors on Firebase Storage (<code>releases/{mirrorV}/</code>). Fallback:{' '}
            <a href={links.releases} target="_blank" rel="noreferrer">
              GitHub&nbsp;Releases
            </a>
            .
          </p>
          <div className="dl-grid">
            {downloads.map((card, i) => (
              <Reveal as="article" key={card.os} inView className="dl-card" delay={i * 0.1}>
                <div className="dl-head">
                  <span className="dl-icon">{card.icon}</span>
                  <h3>{card.os}</h3>
                </div>
                <p>{card.blurb}</p>
                <a
                  className="btn btn-primary btn-block"
                  href={card.primary.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {card.primary.label}
                </a>
                <div className="dl-secondary">
                  {card.secondary.map((s) => (
                    <a key={s.label} href={s.href} target="_blank" rel="noreferrer">
                      {s.label}
                    </a>
                  ))}
                </div>
                <span className="dl-note">{card.note}</span>
              </Reveal>
            ))}
          </div>
          <p className="legacy-linux">
            Legacy Linux URLs:{' '}
            <a href={storageObjectUrl(mirrorV, linuxMirror.appImage)} target="_blank" rel="noreferrer">
              linux/{mirrorV}/…
            </a>
          </p>
        </Reveal>

        <InstallCommands mirrorV={mirrorV} />

        <Reveal as="section" inView className="section" variant="fade">
          <h2>What it does</h2>
          <div className="feat-grid">
            {features.map((f, i) => (
              <Reveal key={f.title} inView className="feat-card" variant={i % 2 ? 'right' : 'left'} delay={i * 0.06}>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </Reveal>
            ))}
          </div>
        </Reveal>

        <Reveal as="section" inView className="section" variant="fade">
          <h2>Privacy</h2>
          <p>
            Screen captures are processed in memory and never uploaded. Only button templates you capture on purpose are saved to disk, alongside local click statistics. The only network calls are the optional update check against GitHub (toggle in the tray Settings) and Homebrew upgrades. No analytics or telemetry; logs stay local and contain no screen content.
          </p>
        </Reveal>
      </main>

      <footer className="footer">
        <p>
          MIT ·{' '}
          <a href={links.github} target="_blank" rel="noreferrer">KurtStevenK/cursor-auto-runner</a>
          {' · '}
          <a href={links.ghPages}>GitHub Pages</a>
          {' · '}
          Release data v{releaseData.version}
        </p>
      </footer>
    </div>
  );
}

import { motion, useReducedMotion } from 'framer-motion';
import { Scene } from './components/Scene';
import {
  LINUX_MIRROR_VERSION,
  VERSION,
  links,
  linuxFiles,
  storageObjectUrl,
} from './config';
import './App.css';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.65, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function App() {
  const reduceMotion = useReducedMotion();
  const mirrorV = LINUX_MIRROR_VERSION;
  const linuxMirror = linuxFiles(mirrorV);

  const downloads = [
    {
      os: 'Linux',
      icon: '🐧',
      blurb: 'Fast mirror on Firebase Storage (same builds as GitHub Releases).',
      primary: {
        label: 'AppImage',
        href: storageObjectUrl(mirrorV, linuxMirror.appImage),
      },
      secondary: [
        { label: '.deb', href: storageObjectUrl(mirrorV, linuxMirror.deb) },
        { label: '.pacman', href: storageObjectUrl(mirrorV, linuxMirror.pacman) },
      ],
      note: `Mirror v${mirrorV} · site v${VERSION}`,
    },
    {
      os: 'macOS',
      icon: '🍎',
      blurb: 'Developer ID–signed DMG (Intel + Apple silicon).',
      primary: {
        label: 'Download from GitHub',
        href: links.releases,
      },
      secondary: [{ label: 'Homebrew tap', href: links.homebrew }],
      note: 'Grant Screen Recording & Accessibility on first run.',
    },
    {
      os: 'Windows',
      icon: '🪟',
      blurb: 'NSIS installer for x64 and ARM64.',
      primary: {
        label: 'Download from GitHub',
        href: links.releases,
      },
      secondary: [{ label: 'Chocolatey', href: `${links.github}/blob/master/packaging/chocolatey/README.md` }],
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
  ];

  return (
    <div className="page">
      <Scene />
      <div className="grain" aria-hidden="true" />

      <header className="top">
        <motion.div
          className="logo-mark"
          initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="logo-core" />
        </motion.div>
        <motion.span
          className="version-pill"
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          v{VERSION}
        </motion.span>
      </header>

      <main className="content">
        <motion.section
          className="hero"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <motion.h1
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="show"
          >
            Cursor Auto
            <span className="hero-accent"> Runner</span>
          </motion.h1>
          <motion.p
            className="hero-lead"
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="show"
          >
            A system-tray companion that clicks{' '}
            <em>Run</em>, <em>Always Run</em>, and permission buttons in Cursor —
            so you stay in flow while agents work.
          </motion.p>
          <motion.div
            className="hero-cta"
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="show"
          >
            <a className="btn btn-primary" href="#downloads">
              Get builds
            </a>
            <a className="btn btn-ghost" href={links.github} target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
          </motion.div>
        </motion.section>

        <motion.section
          id="downloads"
          className="section"
          initial={reduceMotion ? false : { opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
        >
          <h2>Downloads</h2>
          <p className="section-sub">
            Linux packages are mirrored here for speed. macOS and Windows installers
            live on{' '}
            <a href={links.releases} target="_blank" rel="noreferrer">
              GitHub Releases
            </a>
            .
          </p>
          <div className="dl-grid">
            {downloads.map((card, i) => (
              <motion.article
                key={card.os}
                className="dl-card"
                initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.55 }}
                whileHover={reduceMotion ? undefined : { y: -6, transition: { duration: 0.2 } }}
              >
                <div className="dl-head">
                  <span className="dl-icon">{card.icon}</span>
                  <h3>{card.os}</h3>
                </div>
                <p>{card.blurb}</p>
                <a className="btn btn-primary btn-block" href={card.primary.href} target="_blank" rel="noreferrer">
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
              </motion.article>
            ))}
          </div>
        </motion.section>

        <motion.section
          className="section"
          initial={reduceMotion ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2>What it does</h2>
          <div className="feat-grid">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="feat-card"
                initial={reduceMotion ? false : { opacity: 0, x: i % 2 ? 20 : -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.5 }}
              >
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section
          className="section install"
          initial={reduceMotion ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2>Linux package managers</h2>
          <div className="code-cards">
            <div className="code-card">
              <span className="label">APT</span>
              <code>sudo apt-get install cursor-auto-runner</code>
              <a href={links.apt} target="_blank" rel="noreferrer">Repo setup</a>
            </div>
            <div className="code-card">
              <span className="label">AppImage</span>
              <code>chmod +x cursor-auto-runner-{mirrorV}.AppImage && ./cursor-auto-runner-{mirrorV}.AppImage</code>
            </div>
          </div>
        </motion.section>
      </main>

      <footer className="footer">
        <p>
          MIT ·{' '}
          <a href={links.github} target="_blank" rel="noreferrer">KurtStevenK/cursor-auto-runner</a>
          {' · '}
          <a href={links.ghPages}>GitHub Pages mirror</a>
        </p>
      </footer>
    </div>
  );
}

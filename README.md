<p align="center">
  <img src="assets/icons/icon-128.png" alt="Cursor Auto Runner logo" width="96" />
</p>

<h1 align="center">Cursor Auto Runner</h1>

<p align="center">
  A cross-platform system-tray app that automatically clicks the <b>Run</b>, <b>Always Run</b> and
  <b>Allow / Approve</b> buttons in the Cursor IDE — and keeps track of how often it did.
</p>

<p align="center">
  Independent open-source project by <a href="https://github.com/KurtStevenK">KurtStevenK</a>;
  not affiliated with Cursor (Anysphere) or any employer.
</p>

<p align="center">
  <a href="https://github.com/KurtStevenK/cursor-auto-runner/releases/latest"><img src="https://img.shields.io/github/v/release/KurtStevenK/cursor-auto-runner?label=release" alt="release" /></a>
  <a href="https://cursor-auto-runner-linux.web.app"><img src="https://img.shields.io/badge/download-Firebase_landing-red" alt="download" /></a>
  <img src="https://img.shields.io/badge/license-MIT-yellow" alt="license" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="platform" />
  <img src="https://img.shields.io/badge/electron-44-47848f?logo=electron&logoColor=white" alt="electron" />
  <img src="https://img.shields.io/badge/node-22-339933?logo=node.js&logoColor=white" alt="node" />
  <a href="https://github.com/KurtStevenK/cursor-auto-runner"><img src="https://img.shields.io/badge/source-open_on_GitHub-181717?logo=github" alt="source" /></a>
</p>

<p align="center">
  <a href="https://github.com/KurtStevenK/cursor-auto-runner/releases/latest"><img src="https://img.shields.io/badge/%CE%A3_release_binaries-VirusTotal_scanned-green" alt="VirusTotal scanned" /></a>
  <img src="https://img.shields.io/badge/VT_API_quota-4%2Fmin_%7C_500%2Fday-blue" alt="VirusTotal API quota" />
  <a href="https://github.com/KurtStevenK/cursor-auto-runner/releases/latest"><img src="https://img.shields.io/badge/SHA256-VT_report_links-blue" alt="SHA256 in release notes" /></a>
</p>

<p align="center">
  <a href="https://github.com/KurtStevenK/cursor-auto-runner/security/dependabot"><img src="https://img.shields.io/badge/dependabot-enabled-0366d6?logo=dependabot&logoColor=white" alt="dependabot" /></a>
  <a href="SECURITY.md"><img src="https://img.shields.io/badge/security-policy-0366d6?logo=github" alt="security policy" /></a>
  <img src="https://img.shields.io/badge/context--isolation-enabled-brightgreen" alt="context isolation" />
  <img src="https://img.shields.io/badge/nodeIntegration-disabled-brightgreen" alt="nodeIntegration disabled" />
  <img src="https://img.shields.io/badge/single--instance-enabled-brightgreen" alt="single instance" />
</p>

<p align="center">
  <a href="https://github.com/KurtStevenK/cursor-auto-runner/actions/workflows/build.yml"><img src="https://github.com/KurtStevenK/cursor-auto-runner/actions/workflows/build.yml/badge.svg" alt="Build releases" /></a>
  <a href="https://github.com/KurtStevenK/cursor-auto-runner/actions/workflows/codeql-analysis.yml"><img src="https://github.com/KurtStevenK/cursor-auto-runner/actions/workflows/codeql-analysis.yml/badge.svg" alt="CodeQL" /></a>
  <a href="packaging/homebrew/README.md"><img src="https://img.shields.io/badge/Homebrew-cursor--auto--runner-FBB040?logo=homebrew&logoColor=white" alt="Homebrew" /></a>
  <img src="https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions&logoColor=white" alt="CI" />
</p>

---

## Features

- **Auto Run mode** — clicks the *Run* button whenever it appears in a Cursor window, including Cursor shown inside a fullscreen RustDesk session on this computer.
- **RustDesk** — the app stays installed only on this machine. A fullscreen RustDesk window is watched like a local Cursor window, and the click is forwarded by RustDesk. The remote session has to accept mouse input.
- **Auto Always Run mode** — clicks *Always Run* when available, falls back to *Run* and also approves *Allow* / *Approve* prompts so your agent never stalls.
- **Allow / Approve buttons** — permission and tool-call approvals are clicked too, at any position, in both modes. Cursor has used different labels for this button over time (*Allow*, *Approve*); matching is image-based, so captured variants cover them.
- **Repeat clicks** — if a button stays visible after clicking (first click only focused the window, or Cursor asks again), the app clicks it again automatically.
- **Adjustable refresh interval** — set how often the screen is checked from the tray menu (*Faster* / *Slower*); the current value is shown right in the menu.
- **Updates** — Windows and macOS installs update in place (download, then *Restart now*); Homebrew installs upgrade the cask; Linux shows a notification with the release page. *Settings → Check for updates automatically* turns the launch-time check off.
- **Settings submenu** — *Start at login*, *Restore last mode on launch*, match *Confidence* (0.80–0.95) and *Click cooldown* (0.5–5 s) are changeable from the tray menu and apply immediately.
- **Global shortcut** — optionally toggle auto-run on and off from anywhere (*Settings → Keyboard shortcut*: Ctrl/Cmd+Alt+R, Ctrl/Cmd+Alt+Shift+A or Ctrl/Cmd+Alt+Shift+R). It switches between *Stop* and the last mode you used.
- **Focus and typing guards** — *Pause while I am typing* skips a click (and retries on the next check) while you are using the mouse or keyboard; *Focus Cursor before clicking* can be turned off to stop the app bringing Cursor to the front.
- **Adaptive polling** — the refresh interval you set is the baseline; the app checks less often while no Cursor window is visible (at most every 2 s) or you have been away for 5 minutes (every 5 s), and briefly checks faster right after a click. The overlay says when this is in effect.
- **Lock-screen and sleep pause** — auto-run pauses while the screen is locked or the computer sleeps and resumes in the same mode afterwards.
- **Detection health** — the stats overlay shows when the last click happened and how many templates are loaded, and warns when the matcher is failing (the tray tooltip adds *matcher retrying* and a notification appears after repeated failures) or when nothing has matched for 10+ minutes, with a *Capture Run template…* shortcut.
- **First-run welcome** — a short dialog explains what the app does, the macOS permissions and how to start, with a *Start at login* checkbox. It is shown once; reopen it from *Settings → Show welcome…*. The macOS permission dialog now says plainly what is missing and what to click, with diagnostics at the end.
- **System tray** with a state-colored icon: a **left click toggles the stats overlay**, right click opens the menu: *Start Auto Run*, *Start Auto Always Run*, *Stop*, *Capture templates…*, *Open templates folder*, *Stats…*, *Quit*.
- **Stats overlay** — a live, frameless mini-window showing clicks for the **session**, **day**, **week**, **month** and **total**, plus a 7-day bar chart. Also shows the current **refresh interval** with *Faster* / *Slower* buttons to change it right there.
- **Overlay window** — the stats window is resizable, remembers its size and position (and falls back to the screen centre if its display is gone), uses a normal always-on-top level that can be turned off (*Settings → Keep stats window on top*), and follows the system light/dark theme.
- **Multi-monitor** — the Cursor window is located on whatever display it is on; coordinates are resolved across the whole virtual desktop.
- **IDE + Agent windows** — all Cursor windows are searched (the main IDE and the agent/chat window place their buttons differently — both are handled).
- **Multi-theme, multi-scale** — dark/light button reference images, several scale variants to absorb per-display DPI scaling. Duplicate, oversized and excess captures are ignored so matching stays bounded.
- **Cursor-safe clicking** — the mouse pointer is restored immediately after each click; a 2 s cooldown and match verification prevent double clicks.
- **Responsive by design** — screen matching runs in a cancellable worker thread, leaving Electron's tray and stats UI responsive during every scan.

## How it works

The app looks up every window titled "Cursor" or "RustDesk" via the OS window list and captures only the display regions containing those windows. A worker thread runs grayscale normalized-cross-correlation (NCC) against a small, deduplicated template set, so CPU matching cannot block tray clicks. On a match the main process moves the mouse, clicks, restores the pointer, and records the click in SQLite (with an automatic JSON fallback).

```
Tray menu ──► Mode controller ──► Detector (window crops)
                   │                     │ transferable bitmap
                   │                     ▼
                   │                Matcher worker (NCC)
                   │                     │ button found
                   ▼                     ▼
              Stats store ◄──────────── Clicker (move → click → restore)
                   │
              Stats overlay (throttled IPC)
```

## Security & trust

This repository is **public and auditable** (MIT). Installers are built in [GitHub Actions](.github/workflows/build.yml) from tagged releases — not hand-uploaded binaries. The app does not load a remote web app; the stats overlay is **local HTML** only.

### Top facts

| # | What we do |
|---|------------|
| 1 | **VirusTotal on every release** (when `VIRUSTOTAL_API_KEY` is set in CI) — `Setup.exe`, `.dmg`, `.deb`, and `.AppImage` scanned (~70 engines); detection counts and **report links** (`virustotal.com/gui/file/{sha256}`) in GitHub Release notes |
| 2 | **Quota-safe VT API use** — Free tier **4 req/min, 500/day**; script paces uploads (~16 s between files); large installers use VT’s `upload_url` path for files **> 32 MB** |
| 3 | **Electron hardening (stats UI)** — Context isolation, `nodeIntegration: false`, minimal `contextBridge` preload ([`preload.ts`](src/main/preload.ts)); see [SECURITY.md](SECURITY.md); release builds also flip Electron fuses (no `ELECTRON_RUN_AS_NODE`, no `NODE_OPTIONS`/`--inspect`, app loads only from a hash-validated ASAR) |
| 4 | **No arbitrary browsing** — No embedded portal; `shell.openExternal` is used for macOS **System Settings** permission links only |
| 5 | **Sensitive OS access (by design)** — Screen capture and synthetic clicks need **Screen Recording** (macOS) and normal desktop automation permissions; stats stay in local SQLite under your profile |
| 6 | **Single-instance lock** — One tray process only |
| 7 | **Dependabot** — Weekly npm + GitHub Actions update PRs |
| 8 | **Reproducible CI builds** — [Build releases](.github/workflows/build.yml) on every `v*` tag (Windows, macOS, Linux) |
| 9 | **Homebrew checksums** — [`cursor-auto-runner` cask](packaging/homebrew/README.md) pins version + **SHA256** each release |
| 10 | **Responsible disclosure** — [GitHub Security Advisories](https://github.com/KurtStevenK/cursor-auto-runner/security/advisories/new) or the maintainer in [`package.json`](package.json) ([SECURITY.md](SECURITY.md)) |

### Verify a download

1. Download from [GitHub Releases](https://github.com/KurtStevenK/cursor-auto-runner/releases/latest), [Firebase landing](https://cursor-auto-runner-linux.web.app), or your package manager (Homebrew / APT / Chocolatey).
2. Open the release notes **VirusTotal** table (when present) and review the full multi-engine report — not a single flag.
3. On macOS via Homebrew, compare the DMG **SHA256** to the value in the [tap cask](https://github.com/KurtStevenK/homebrew-tap/blob/main/Casks/cursor-auto-runner.rb).

> **Note:** macOS DMGs are **Developer ID signed and notarized** when Apple secrets in [packaging/mac/README.md](packaging/mac/README.md) are set on GitHub Actions. Without those secrets the macOS job still publishes an unsigned DMG. Windows Authenticode is not configured. Some AV engines flag new Electron apps heuristically — read the **full** VirusTotal report. Local scans: `npm run scan:virustotal` after `npm run dist` (key in `.env.local`; see [.env.example](.env.example)).

## Privacy

- **Screen captures stay in memory.** Frames of the Cursor window are processed in RAM to find buttons and are never written to disk.
- **Only deliberate template captures are saved.** Button templates you create via tray → **Capture templates…** are PNG files in the app's user-data folder.
- **Nothing is uploaded.** Screen content never leaves your computer.
- **Click statistics are local.** They live in a SQLite database (`stats.db`), or a JSON fallback (`clicks-fallback.json`), in the user-data folder.
- **Only two kinds of network calls.** The optional update check against GitHub Releases (toggle **Check for updates automatically** in the tray Settings submenu), and `brew upgrade` on macOS Homebrew installs when an update is installed that way.
- **No analytics or telemetry.** The app does not report usage anywhere.
- **Logs stay local.** Tray → **Open log folder** opens a local log file that contains no screen content.

Screen Recording is needed to see the Cursor window, and Accessibility is needed to send the clicks; the app cannot work without them on macOS.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 22+ and npm
- The Cursor IDE ([cursor.com](https://cursor.com))

### Download a release (recommended)

Prebuilt packages are attached to every [GitHub Release](https://github.com/KurtStevenK/cursor-auto-runner/releases/latest).
Download overview: [Firebase landing](https://cursor-auto-runner-linux.web.app) (animated; Linux mirrors) and
[GitHub Pages](https://kurtstevenk.github.io/cursor-auto-runner/).

| Platform | Package | Install |
|---|---|---|
| Windows | `Cursor.Auto.Runner.Setup.<version>.exe` | Run the installer (x64/ARM64) |
| Windows | Chocolatey | `choco install cursor-auto-runner` |
| macOS | `Cursor.Auto.Runner-<version>.dmg` | Open the DMG (universal; grant Screen Recording & Accessibility) |
| macOS | Homebrew | `brew install --cask KurtStevenK/tap/cursor-auto-runner` — [tap setup](packaging/homebrew/README.md) |
| Linux (Debian/Ubuntu) | APT ([`KurtStevenK/apt`](https://github.com/KurtStevenK/apt)) | `sudo apt-get install cursor-auto-runner` — [one-time repo setup](packaging/apt/README.md) |
| Linux (Debian/Ubuntu) | `cursor-auto-runner_<version>_amd64.deb` | `sudo apt install ./cursor-auto-runner_<version>_amd64.deb` |
| Linux (Arch) | `cursor-auto-runner-<version>.pacman` | `sudo pacman -U cursor-auto-runner-<version>.pacman` |
| Linux (any distro) | `cursor-auto-runner-<version>.AppImage` | `chmod +x` and run. Direct downloads are on [Firebase Storage](https://cursor-auto-runner-linux.web.app) ([setup](packaging/linux/firebase/README.md)), not GitHub Releases. |

### Install (from source)

```bash
npm install
npm run compile
```

### Capture the button templates (one time, after every Cursor UI update)

The release includes minimal dark-theme Run, Always Run and Allow / Approve
references. Capture any light-theme or changed controls you use; Cursor changes
these buttons frequently, so local captures are intentionally preferred.

The easiest way: right-click the tray icon → **Capture templates…** → pick the button and theme.
The auto-clicker pauses while capturing and resumes afterwards; new templates are used immediately.

Or from the terminal:

```bash
npm run capture-templates -- run dark          # capture the "Run" button (dark theme)
npm run capture-templates -- run light         # capture the "Run" button (light theme)
npm run capture-templates -- always-run dark   # capture the "Always Run" button (dark theme)
npm run capture-templates -- always-run light  # capture the "Always Run" button (light theme)
npm run capture-templates -- allow dark        # capture the "Allow" / "Approve" button (dark theme)
npm run capture-templates -- allow light       # capture the "Allow" / "Approve" button (light theme)
```

The first argument selects the button, the second the theme — all combinations:

| Button | Dark theme | Light theme |
|---|---|---|
| **Run** | `npm run capture-templates -- run dark` | `npm run capture-templates -- run light` |
| **Always Run** | `npm run capture-templates -- always-run dark` | `npm run capture-templates -- always-run light` |
| **Allow / Approve** | `npm run capture-templates -- allow dark` | `npm run capture-templates -- allow light` |

The same six combinations are available from the tray context menu: right-click the
tray icon → **Capture templates…** → pick the button, then **(dark)** or **(light)**.
Omitting an argument defaults to `run dark`.

A fullscreen overlay freezes your screen — drag a rectangle tightly around only the stable button label, release, done. Do not include changing command names, counters or surrounding panel content; overly wide and duplicate captures are rejected.
The tool stays open: capture further variants (e.g. the same button in the agent window) and press
ESC when finished. Captures are saved as `run.png`, `run-2.png`, `run-3.png`, …; at most two
unique templates per button/theme are activated.

### Run

```bash
npm start
```

The app appears in your system tray. Right-click the tray icon:

| Menu item | Action |
|---|---|
| **Cursor Auto Runner *version*** | Shows the installed app version (informational) |
| **Start Auto Run** | Clicks every *Run* button that appears in a Cursor window |
| **Start Auto Always Run** | Prefers *Always Run*, falls back to *Run* |
| **Stop** | Stops the automation (enabled only while running) |
| **Refresh interval: 4000 ms** | Shows the current check interval (informational; default is 4000 ms) |
| **Faster / Slower** | Steps the interval up or down (150 ms – 6 s); applied live and persisted |
| **Capture templates…** | Submenu to capture reference images for *Run*, *Always Run* and *Allow*/*Approve* buttons, each in dark and light theme |
| **Open templates folder** | Opens the folder where captured templates are stored |
| **Stats…** | Opens the live stats overlay |
| **Test buttons…** | Opens a window with the Run, Always Run, and Allow images so you can confirm clicks without waiting for a Cursor prompt |
| **Check for updates…** | Windows and macOS (not Homebrew): downloads the signed update in the app and offers *Restart now / Later*. Homebrew installs and Linux compare against the latest GitHub Release |
| **Settings → Check for updates automatically** | On by default: one check a few seconds after launch. Turn it off to contact GitHub only when you choose *Check for updates…* |
| **Install updates with Homebrew** | When checked, a newer release upgrades the cask in the background (`brew upgrade --cask cursor-auto-runner`). The app quits when the new version is ready |
| **Quit** | Exits the app |

### Build installers

```bash
npm run dist        # builds for the current OS
npm run dist:win    # NSIS installer (x64 + arm64)
npm run dist:mac    # DMG (universal) — macOS only
npm run dist:linux  # AppImage + deb — Linux only
```

Installers land in `release/`.

Linux packages and the macOS DMG require the matching OS toolchain and are
built automatically by GitHub Actions on tagged releases (`.github/workflows/build.yml`):
push a tag like `v1.2.12` and the workflow attaches Setup.exe, .nupkg (Chocolatey),
AppImage, .deb, .pacman and .dmg to the release, publishes the Chocolatey package,
updates the Homebrew tap cask, publishes the `.deb` to the [`KurtStevenK/apt`](https://github.com/KurtStevenK/apt) repository for `apt-get install`, and (when configured) mirrors Linux artifacts to Firebase Storage.
Static landing pages: `landing/` on GitHub Pages (`.github/workflows/pages.yml`) and `firebase-landing/` on Firebase Hosting (`npm run deploy:firebase`).

## Platform notes

- **Windows** — works out of the box.
- **macOS** — grant two permissions on first use: *Screen Recording* and *Accessibility* (System Settings → Privacy & Security). The app shows a hint dialog with a direct link when needed.
- **Linux** — works out of the box on X11. Under Wayland see the Linux paragraph below.

### Linux (Wayland)

Wayland compositors restrict synthetic input and screen capture (you may get portal prompts, or clicks and screenshots may be blocked entirely, depending on the compositor). An X11 or XWayland session is recommended: choose "… on Xorg" on the login screen, or run `cursor-auto-runner` and Cursor under XWayland. Check which session you are in with:

```bash
echo $XDG_SESSION_TYPE   # x11 or wayland
```

When the app detects Wayland (`XDG_SESSION_TYPE=wayland`, or `WAYLAND_DISPLAY` set without `DISPLAY`) it logs a warning and shows a one-time notification.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Nothing is clicked | Capture templates for your theme (`npm run capture-templates`) |
| **Update did not install** | Windows and macOS installs update themselves through the tray menu (*Download update*, then *Restart to install*); a Homebrew install uses `brew upgrade --cask cursor-auto-runner` instead. Linux shows the release page. The update feeds (`latest.yml`, `latest-mac.yml`) are attached to each GitHub Release; if one is missing, the update check fails. Details are in the log folder. |
| **„Damaged“ / can’t be opened** after Homebrew (macOS) | The DMG was signed but not notarized, or CI stopped on `notarytool` HTTP 401. Regenerate the app-specific password and ship a new tag — [packaging/mac/README.md](packaging/mac/README.md). |
| **Permissions dialog every time** you start Auto Run (toggles already ON) | Upgrade to **v1.2.25+**. If it persists: quit the app, **remove** Cursor Auto Runner from Screen Recording and Accessibility, reopen from `/Applications`, enable both again, then use **Try again** in the dialog. Common after Homebrew upgrades while the DMG is ad-hoc signed. |
| Watching the Cursor window but **0 clicks** on macOS | Grant Screen Recording and Accessibility to **Cursor Auto Runner** (not Cursor IDE). Upgrade to the latest build, then re-capture dark-theme Run / Always Run if the UI changed. Run `CURSOR_AUTO_RUNNER_DEBUG_DETECT=1` from Terminal to see match diagnostics. |
| Need diagnostics from the packaged app | Logs go to `cursor-auto-runner.log` (macOS: `~/Library/Logs/Cursor Auto Runner/`, Windows: `%APPDATA%\Cursor Auto Runner\logs`, Linux: `~/.config/Cursor Auto Runner/logs`); use **Open log folder** in the tray menu. The previous file is kept as `cursor-auto-runner.1.log`. |
| Clicks stopped after a Cursor update | Cursor's UI changed — re-capture the templates |
| "Cursor window not found" in the overlay | Cursor is minimized, or the RustDesk session is not visible — unminimize Cursor or open the remote desktop fullscreen. On macOS the document title (for example FeatherShot) is enough; the app is identified by the Cursor process. Use **Test buttons…** in the tray menu to confirm clicking |
| Wrong clicks on a scaled monitor | Re-capture templates on that display (multi-scale matching covers common cases) |
| Tray or stats feels slow | Update to the worker-based build, remove captures containing command text, and run `npm run bench:matcher` |
| `[stats] better-sqlite3 unavailable` in dev after building an installer | electron-builder rebuilt the native module for another arch. Run `npm run rebuild:dev` (rebuilds for Electron x64) |

## Development

```bash
npm run compile          # type-check + build to dist/
npm start                # launch the app in dev mode
npm test                 # matcher, filtering, cancellation and worker regressions
npm run test:stats       # aggregated SQLite snapshot integration test
npm run bench:matcher    # worker latency + main-thread heartbeat benchmark
npm run soak:matcher     # 30-minute worker memory/responsiveness soak
npm run generate:icons   # regenerate all icons from the built-in logo renderer
```

Stats are stored in `%APPDATA%/Cursor Auto Runner/stats.db` (SQLite) or
`clicks-fallback.json` when the native SQLite module is unavailable.
See [PERFORMANCE.md](PERFORMANCE.md) for the recorded baseline, acceptance
measurements and opt-in live diagnostics.

## Versioning

Every shipped feature gets its own patch version, starting at `1.0.0` — see [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)

<p align="center">
  <img src="assets/icons/icon-128.png" alt="Cursor Auto Runner logo" width="96" />
</p>

<h1 align="center">Cursor Auto Runner</h1>

<p align="center">
  A cross-platform system-tray app that automatically clicks the <b>Run</b>, <b>Always Run</b> and
  <b>Allow / Approve</b> buttons in the Cursor IDE — and keeps track of how often it did.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="platform" />
  <img src="https://img.shields.io/badge/electron-33-47848f" alt="electron" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license" />
  <img src="https://img.shields.io/badge/version-1.2.12-22c55e" alt="version" />
</p>

---

## Features

- **Auto Run mode** — clicks the *Run* button whenever it appears in a Cursor window.
- **Auto Always Run mode** — clicks *Always Run* when available, falls back to *Run* and also approves *Allow* / *Approve* prompts so your agent never stalls.
- **Allow / Approve buttons** — permission and tool-call approvals are clicked too, at any position, in both modes. Cursor has used different labels for this button over time (*Allow*, *Approve*); matching is image-based, so captured variants cover them.
- **Repeat clicks** — if a button stays visible after clicking (first click only focused the window, or Cursor asks again), the app clicks it again automatically.
- **Adjustable refresh interval** — set how often the screen is checked from the tray menu (*Faster* / *Slower*); the current value is shown right in the menu.
- **System tray** with a state-colored icon: a **left click toggles the stats overlay**, right click opens the menu: *Start Auto Run*, *Start Auto Always Run*, *Stop*, *Capture templates…*, *Open templates folder*, *Stats…*, *Quit*.
- **Stats overlay** — a live, frameless mini-window showing clicks for the **session**, **day**, **week**, **month** and **total**, plus a 7-day bar chart. Also shows the current **refresh interval** with *Faster* / *Slower* buttons to change it right there.
- **Multi-monitor** — the Cursor window is located on whatever display it is on; coordinates are resolved across the whole virtual desktop.
- **IDE + Agent windows** — all Cursor windows are searched (the main IDE and the agent/chat window place their buttons differently — both are handled).
- **Multi-theme, multi-scale** — dark/light button reference images, several scale variants to absorb per-display DPI scaling. Duplicate, oversized and excess captures are ignored so matching stays bounded.
- **Cursor-safe clicking** — the mouse pointer is restored immediately after each click; a 2 s cooldown and match verification prevent double clicks.
- **Responsive by design** — screen matching runs in a cancellable worker thread, leaving Electron's tray and stats UI responsive during every scan.

## How it works

The app looks up every window titled "Cursor" via the OS window list and captures only the display regions containing those windows. A worker thread runs grayscale normalized-cross-correlation (NCC) against a small, deduplicated template set, so CPU matching cannot block tray clicks. On a match the main process moves the mouse, clicks, restores the pointer, and records the click in SQLite (with an automatic JSON fallback).

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

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 18+ and npm
- The Cursor IDE ([cursor.com](https://cursor.com))

### Download a release (recommended)

Prebuilt packages are attached to every [GitHub Release](https://github.com/KurtStevenK/cursor-auto-runner/releases/latest)
and shown on the [landing page](https://kurtstevenk.github.io/cursor-auto-runner/):

| Platform | Package | Install |
|---|---|---|
| Windows | `Cursor.Auto.Runner.Setup.<version>.exe` | Run the installer (x64/ARM64) |
| Windows | Chocolatey | `choco install cursor-auto-runner` |
| macOS | `Cursor.Auto.Runner-<version>.dmg` | Open the DMG (universal; grant Screen Recording & Accessibility) |
| macOS | Homebrew | `brew install --cask KurtStevenK/tap/cursor-auto-runner` |
| Linux (Debian/Ubuntu) | APT ([`KurtStevenK/apt`](https://github.com/KurtStevenK/apt)) | `sudo apt-get install cursor-auto-runner` — [one-time repo setup](packaging/apt/README.md) |
| Linux (Debian/Ubuntu) | `cursor-auto-runner_<version>_amd64.deb` | `sudo apt install ./cursor-auto-runner_<version>_amd64.deb` |
| Linux (Arch) | `cursor-auto-runner-<version>.pacman` | `sudo pacman -U cursor-auto-runner-<version>.pacman` |
| Linux (any distro) | `cursor-auto-runner-<version>.AppImage` | `chmod +x` and run |

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
| **Start Auto Run** | Clicks every *Run* button that appears in a Cursor window |
| **Start Auto Always Run** | Prefers *Always Run*, falls back to *Run* |
| **Stop** | Stops the automation (enabled only while running) |
| **Refresh interval: 4000 ms** | Shows the current check interval (informational; default is 4000 ms) |
| **Faster / Slower** | Steps the interval up or down (150 ms – 6 s); applied live and persisted |
| **Capture templates…** | Submenu to capture reference images for *Run*, *Always Run* and *Allow*/*Approve* buttons, each in dark and light theme |
| **Open templates folder** | Opens the folder where captured templates are stored |
| **Stats…** | Opens the live stats overlay |
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
updates the Homebrew tap cask, and publishes the `.deb` to the [`KurtStevenK/apt`](https://github.com/KurtStevenK/apt) repository for `apt-get install`. The landing page is served from
`landing/` via GitHub Pages (`.github/workflows/pages.yml`).

## Platform notes

- **Windows** — works out of the box.
- **macOS** — grant two permissions on first use: *Screen Recording* and *Accessibility* (System Settings → Privacy & Security). The app shows a hint dialog with a direct link when needed.
- **Linux** — works out of the box (X11; Wayland may restrict synthetic clicks depending on compositor).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Nothing is clicked | Capture templates for your theme (`npm run capture-templates`) |
| Clicks stopped after a Cursor update | Cursor's UI changed — re-capture the templates |
| "Cursor window not found" in the overlay | The Cursor window is minimized or all its windows are hidden — unminimize it |
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

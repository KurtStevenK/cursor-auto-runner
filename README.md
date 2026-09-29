<p align="center">
  <img src="assets/icons/icon-128.png" alt="Cursor Auto Runner logo" width="96" />
</p>

<h1 align="center">Cursor Auto Runner</h1>

<p align="center">
  A cross-platform system-tray app that automatically clicks the <b>Run</b> / <b>Always Run</b> button
  in the Cursor IDE — and keeps track of how often it did.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="platform" />
  <img src="https://img.shields.io/badge/electron-33-47848f" alt="electron" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license" />
  <img src="https://img.shields.io/badge/version-1.1.0-22c55e" alt="version" />
</p>

---

## Features

- **Auto Run mode** — clicks the *Run* button whenever it appears in a Cursor window.
- **Auto Always Run mode** — clicks *Always Run* when available, and falls back to *Run* so your agent never stalls waiting for approval.
- **System tray** with a state-colored icon and a simple menu: *Start Auto Run*, *Start Auto Always Run*, *Stop*, *Stats…*, *Quit*.
- **Stats overlay** — a live, frameless mini-window showing clicks for the **session**, **day**, **week**, **month** and **total**, plus a 7-day bar chart.
- **Multi-monitor** — the Cursor window is located on whatever display it is on; coordinates are resolved across the whole virtual desktop.
- **IDE + Agent windows** — all Cursor windows are searched (the main IDE and the agent/chat window place their buttons differently — both are handled).
- **Multi-theme, multi-scale** — dark/light button reference images, several scale variants to absorb per-display DPI scaling.
- **Cursor-safe clicking** — the mouse pointer is restored immediately after each click; a 2 s cooldown and match verification prevent double clicks.

## How it works

The app looks up every window titled "Cursor" via the OS window list, captures the displays where those windows are, and runs a grayscale normalized-cross-correlation (NCC) template match against your captured button reference images. On a match it moves the mouse, clicks, restores the pointer, and records the click in a SQLite database (with an automatic JSON fallback).

```
Tray menu ──► Mode controller ──► Detector (per-display capture + NCC)
                   │                     │ button found
                   ▼                     ▼
              Stats store ◄──────────── Clicker (move → click → restore)
                   │
              Stats overlay (IPC live updates)
```

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 18+ and npm
- The Cursor IDE ([cursor.com](https://cursor.com))

### Install

```bash
npm install
npm run compile
```

### Capture the button templates (one time, after every Cursor UI update)

The app matches buttons against *your* screenshots, so teach it what your buttons look like:

```bash
npm run capture-templates -- run dark          # capture the "Run" button (dark theme)
npm run capture-templates -- always-run dark   # capture the "Always Run" button (dark theme)
npm run capture-templates -- run light         # light theme variants if you use them
```

A fullscreen overlay freezes your screen — drag a rectangle tightly around the button, release, done.
Repeat for the **other button style too** (e.g. once from the IDE panel, once from the agent window):
captures are saved as `run.png`, `run-2.png`, `run-3.png`, … and all variants are matched.

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
| **Stats…** | Opens the live stats overlay |
| **Quit** | Exits the app |

### Build installers

```bash
npm run dist        # builds for the current OS
npm run dist:win    # NSIS installer (x64 + arm64)
npm run dist:mac    # DMG (universal)
npm run dist:linux  # AppImage + deb
```

Installers land in `release/`.

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

## Development

```bash
npm run compile          # type-check + build to dist/
npm start                # launch the app in dev mode
npm run generate:icons   # regenerate all icons from the built-in logo renderer
```

Stats are stored in `%APPDATA%/cursor-auto-runner/stats.db` (SQLite) or
`clicks-fallback.json` when the native SQLite module is unavailable.

## Versioning

Every shipped feature gets its own patch version, starting at `1.0.0` — see [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)

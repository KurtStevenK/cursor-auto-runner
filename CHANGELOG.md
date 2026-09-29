# Changelog

All notable changes to **Cursor Auto Runner** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and each shipped task gets its own version number.

## [1.1.6] - 2026-09-29

### Fixed
- Logo missing in the overlay header: the image path pointed two levels up (`dist/assets`) instead of three (`<root>/assets`).

## [1.1.5] - 2026-09-29

### Fixed
- Stats overlay opened as an empty black window: the overlay HTML/CSS was never copied into `dist` (tsc only compiles TypeScript). `npm run compile` now copies the overlay assets (`scripts/copy-overlay-assets.js`).
- Overlay is closable again: ✕ button renders with the loaded page, ESC now closes it, and the tray's *Stats…* entry toggles (click again = close).

## [1.1.4] - 2026-09-29

### Added
- **Allow** button support: permission-approval buttons are captured (`npm run capture-templates -- allow dark`) and auto-clicked at any position — in both Auto Run (Run → Allow) and Auto Always Run (Always Run → Run → Allow) priority.
- Repeat-click handling: buttons that stay visible after a click (first click only focused the window, or Cursor asks again immediately) are clicked again automatically — up to 3 clicks total, each recorded in the stats.

## [1.1.3] - 2026-09-29

### Fixed
- Capture tool showed the taskbar twice: the selection window was clipped to the Windows work area (above the taskbar), so the frozen screenshot — which includes the taskbar — appeared above the real one. The window is now true fullscreen, aligning the frozen image 1:1 with the actual screen.

## [1.1.2] - 2026-09-29

### Fixed
- Template capture tool showed a white screen instead of the frozen screenshot: the inline `data:` URL image is not loaded by this Electron build. The screenshot is now written to a temp PNG file and referenced relatively from the capture page.
- Added a screen-capture diagnostic script (`scripts/capture-debug.js`) that dumps every display's thumbnail to disk for troubleshooting.

## [1.1.1] - 2026-09-29

### Fixed
- Template capture tool: the frozen screenshot behaved as a draggable image, so dragging a selection started a native image drag-and-drop and the rectangle was never submitted (ESC was the only way out). Native dragging is now blocked (`draggable="false"`, `dragstart` prevented, `pointer-events: none` on the screenshot).
- The capture tool no longer exits after the first save — each successful drag saves the next numbered variant (`run.png`, `run-2.png`, …) and shows a confirmation in the hint bar; ESC finishes the session.

## [1.1.0] - 2026-09-29

### Added
- GitHub-ready `README.md` with features, architecture diagram, setup and capture guide, platform notes and troubleshooting.
- This `CHANGELOG.md`, maintained per version.

## [1.0.9] - 2026-09-29

### Added
- electron-builder packaging: NSIS installer (Windows x64/arm64), DMG (macOS universal), AppImage + deb (Linux); native `better-sqlite3` rebuild handled by electron-builder.
- Fixed ICO generation (contiguous directory table, BMP-encoded 256px entry); electron-builder converts from the 256px PNG.

## [1.0.8] - 2026-09-29

### Added
- macOS permission check before starting a mode: Screen Recording + Accessibility, with a hint dialog linking to System Settings. Windows/Linux unaffected.

## [1.0.7] - 2026-09-29

### Added
- Full multi-monitor support: each display is captured via `desktopCapturer` and searched where the Cursor window intersects it; click coordinates are absolute across the virtual desktop.
- Pure-JS grayscale NCC matcher (`matcher.ts`) with coarse-to-fine refinement — removes the dependency on nut.js screen search, which only covers the main display.
- Template capture tool (`npm run capture-templates`) with frozen-screen drag selection; saves numbered variants (`run.png`, `run-2.png`, …) so IDE and agent-window button styles can both be captured.
- All Cursor windows (IDE + agent window) are searched, not just the first match.

## [1.0.6] - 2026-09-29

### Added
- Stats overlay window: frameless, always-on-top, dark glass UI with session/day/week/month/total counters, mode badge with live pulse, 7-day bar chart, and detection status warnings. Live updates via IPC on every click.

## [1.0.5] - 2026-09-29

### Added
- Stats store with SQLite backend (better-sqlite3) and automatic JSON fallback; aggregations for session (since app start), day (local midnight), week (ISO Monday), month (1st) and total, plus 7-day history.

## [1.0.4] - 2026-09-29

### Added
- System tray with state-colored icons (idle/gray, Auto Run/green, Auto Always Run/blue) and menu: Start Auto Run, Start Auto Always Run, Stop (only while running), Stats…, Quit.

## [1.0.3] - 2026-09-29

### Added
- Mode controller state machine: one active mode at a time, fast-reacting stop, poll loop (~700 ms) with 2 s click cooldown and double-click prevention.

## [1.0.2] - 2026-09-29

### Added
- Clicker: moves the mouse to the detected button, clicks, and restores the previous cursor position.

## [1.0.1] - 2026-09-29

### Added
- Detection engine: Cursor window enumeration via the OS window list, template-based button matching with dark/light reference images and multiple scale variants (DPI tolerance), Auto Always Run falls back to Run when no Always Run button exists.

## [1.0.0] - 2026-09-29

### Added
- Initial scaffold: Electron + TypeScript project with tray-first architecture, software-rendered logo (rounded dark square, play triangle, speed bolt) exported to all icon sizes, Windows `.ico` and macOS tray template images.

[1.1.0]: #110---2026-09-29
[1.0.0]: #100---2026-09-29

# Changelog

All notable changes to **Cursor Auto Runner** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and each shipped task gets its own version number.

## [1.2.35] - 2026-10-01

### Changed
- **Firebase landing:** separate install groups for Debian, Ubuntu, AppImage, and Arch (.pacman); optional Homebrew/Chocolatey/gh CLI install commands at the end of each group.

## [1.2.34] - 2026-10-01

### Changed
- **Firebase landing:** per-panel and per-command hints on install steps and checksum verify (what to do before/after each copy).

## [1.2.33] - 2026-10-01

### Changed
- **Firebase landing:** install section stacks macOS, Windows, Linux, and Development as full-width rows (same layout as Development).

## [1.2.32] - 2026-10-01

### Fixed
- **CI macOS signing:** import `.p12` into a dedicated keychain before `electron-builder` (fixes `set-key-partition-list` / wrong passphrase on GitHub runners).

## [1.2.31] - 2026-10-01

### Added
- **`scripts/refresh-csc-github-secrets.sh`** — regenerate CI `.p12` and update `CSC_LINK` / `CSC_KEY_PASSWORD` on GitHub.
- **`.github/workflows/chocolatey-moderation-push.yml`** — rebuild and `choco push` a corrected nuspec (e.g. jsDelivr `iconUrl`) while a version is still in moderation.
- **`scripts/build-chocolatey-nupkg.sh`** — local nupkg build when `choco` is on PATH.

## [1.2.30] - 2026-10-01

### Added
- **Firebase landing:** per-command copy buttons (Homebrew, Chocolatey, APT, `gh repo clone`, checksum verify); full **releases/** mirror on Storage for v1.2.28 installers; smoother background parallax (window-level pointer smoothing).

### Changed
- `storage.rules` public read for `releases/{version}/*`; `scripts/mirror-release-firebase.sh` for CI/manual mirroring.

## [1.2.29] - 2026-10-01

### Added
- **Firebase landing site** at [cursor-auto-runner-linux.web.app](https://cursor-auto-runner-linux.web.app): React + Three.js + Framer Motion download page; `firebase-landing/` + `npm run deploy:firebase`.
- **Linux release mirror** on Firebase Storage (`cursor-auto-runner-linux.firebasestorage.app`) with CI secrets `FIREBASE_STORAGE_BUCKET` and `FIREBASE_SERVICE_ACCOUNT_LINUX`.

### Changed
- `scripts/upload-linux-firebase.sh` accepts CI AppImage filenames and uploads a stable `cursor-auto-runner-<version>.AppImage` object name.

## [1.2.28] - 2026-10-01

### Added
- **macOS release signing:** Developer ID + notarization in CI (required secrets on tagged releases); signed **DMG** and **ZIP** artifacts on GitHub Releases; helper scripts `scripts/mac-create-developer-id-csr.sh`, `scripts/push-apple-signing-to-github.sh`, `npm run dist:mac:signed` ([packaging/mac/README.md](packaging/mac/README.md)).

### Changed
- Bundle ID **`com.kurtstevenk.cursor-auto-runner`** for new signed builds (re-grant Screen Recording / Accessibility after upgrading from older IDs).

## [1.2.27] - 2026-10-01

### Fixed
- **CI:** Windows `npm test` compile no longer imports `@nut-tree-fork/node-mac-permissions` statically (lazy macOS-only require), fixing failed v1.2.25/v1.2.26 release builds.

## [1.2.26] - 2026-10-01

### Fixed
- **Chocolatey moderation:** `iconUrl` now uses jsDelivr (`cdn.jsdelivr.net/gh/...`) instead of `raw.githubusercontent.com`, per community package requirements.

### Changed
- **Windows:** `app.setAppUserModelId` aligned to `com.kurtstevenk.cursor-auto-runner`.

## [1.2.25] - 2026-10-01

### Fixed
- **macOS permissions loop:** Auto Run no longer blocks when System Settings already show Screen Recording and Accessibility ON but Electron’s APIs still report denied (common after Homebrew upgrades with ad-hoc builds). Checks native TCC status, runs a short screen-capture probe, and offers **Try again** with clearer reset steps.

## [1.2.24] - 2026-10-01

### Fixed
- **Quit crash on macOS:** detection miss logging no longer throws `EPIPE` when the app exits from the Dock (no terminal stdout). The poll loop stops before shutdown.

## [1.2.23] - 2026-10-01

### Fixed
- **macOS permissions:** Auto Run waits for Screen Recording and Accessibility before starting; the permission dialog links to both System Settings panes.

## [1.2.22] - 2026-10-01

### Fixed
- **macOS capture:** Prefer per-window `desktopCapturer` crops when available; retry empty screen thumbnails; load templates from the packaged app’s Application Support folder during dev.

## [1.2.21] - 2026-10-01

### Fixed
- **macOS window bounds:** Normalize Retina physical nut.js regions to Electron logical coordinates before cropping.

## [1.2.20] - 2026-10-01

### Added
- **macOS detection diagnostics:** throttled `[detector] no button match` warnings (`CURSOR_AUTO_RUNNER_DEBUG_DETECT=1`) and expanded `scripts/test-detector.js` coverage for `run`, `always-run`, and `allow`.

## [1.2.19] - 2026-09-30

### Fixed
- **macOS DMG** release filenames: rename dotted basenames after `dist:mac` (electron-builder does not support conditional `artifactName`); fixes failed v1.2.18 macOS CI job.

## [1.2.18] - 2026-09-30

### Added
- **Homebrew tap** maintainer docs and release smoke test ([packaging/homebrew/README.md](packaging/homebrew/README.md), [packaging/homebrew/smoke-test.sh](packaging/homebrew/smoke-test.sh)).

## [1.2.17] - 2026-09-30

### Changed
- **GitHub Pages landing** ([landing/index.html](landing/index.html)): version badge and direct download links updated to the current release.

## [1.2.16] - 2026-09-30

### Added
- Maintainer docs for **Chocolatey moderation** and manual push ([packaging/chocolatey/README.md](packaging/chocolatey/README.md)).
- **APT Pages verification** steps in [packaging/apt/README.md](packaging/apt/README.md) (`curl` check for `gpg.key`).

## [1.2.15] - 2026-09-30

### Added
- **Chocolatey push** workflow (`.github/workflows/chocolatey-push.yml`) — manually publish a release `.nupkg` after community moderation without re-tagging.

### Fixed
- Chocolatey skip gate no longer fails the job under `set -e` when `should-push.sh` exits with code 2.

## [1.2.14] - 2026-09-30

### Fixed
- **Build releases**: Chocolatey push is skipped (workflow stays green) while the community package has no approved version yet, avoiding HTTP 403 during first-package moderation.
- **APT publish**: CI now checks out the existing `gh-pages` branch on `KurtStevenK/apt` instead of recreating an orphan branch on every release.

### Added
- `packaging/chocolatey/should-push.sh` — queries the community package page before `choco push`.

## [1.2.13] - 2026-09-30

### Fixed
- **Build releases**: the `release` job now fails fast with a clear message when `TAP_TOKEN` or `APT_GPG_PRIVATE_KEY` is missing, instead of failing mid APT publish.

## [1.2.12] - 2026-09-29

### Fixed
- Restored current Cursor **Run**, **Always Run**, and **Allow** detection with a phase-complete half-resolution search for tiny templates and exact full-resolution verification.
- Blue Run/Allow controls now provide a bounded action-row anchor. Always Run is accepted only beside a template-verified Run button, preventing identical prose or history text from being clicked.

### Performance
- Real-color Cursor windows avoid expensive full-window sweeps after bounded button verification; a reproduced no-button pass now spends about 45 ms in the matcher instead of 12 seconds.
- Added sanitized cluttered-window, odd/even phase, false-positive, no-button budget, packaged-worker, and matcher soak coverage. Packaged builds contain only the five curated button templates.

## [1.2.11] - 2026-09-29

### Added
- **APT repository for Debian/Ubuntu**: tagged releases publish the `.deb` to [`KurtStevenK/apt`](https://github.com/KurtStevenK/apt) on `gh-pages` (GPG-signed) — `sudo apt-get install cursor-auto-runner` after a one-time repo setup ([packaging/apt/README.md](packaging/apt/README.md)).

### Fixed
- Restored Run and Always Run detection after the 1.2.9 capture cap changed the effective button scale. Template variants now follow each display thumbnail's exact native downscale instead of relying on a sparse fixed list alone.
- Coarse matching now refines multiple spatially distinct candidates, preventing unrelated Cursor text or icons from hiding a valid high-confidence button match.
- Bundled templates are guaranteed a bounded fallback slot ahead of local captures, with one complementary current-UI reference for Run and Always Run.
- Multi-monitor capture keeps each display's native aspect ratio and reports ambiguous source mappings instead of silently returning no crops.
- The detector diagnostic now receives the real project template root when it runs as Electron's entry point.

### Performance
- Capture-adjusted template variants are cached in the worker, coarse scanning uses a phase-tolerant stride, and the 0.88 final click threshold remains unchanged.
- Added real button-pixel regressions at native and capped scales, a coarse-distractor regression, packaged worker checks, and click-coordinate mapping coverage.

## [1.2.10] - 2026-09-29

### Added
- **Arch Linux support**: releases now include a `.pacman` package (electron-builder `pacman` target) — install with `sudo pacman -U cursor-auto-runner-<version>.pacman`.
- **Chocolatey distribution**: releases build a `.nupkg` and publish it automatically to [community.chocolatey.org](https://community.chocolatey.org/packages/cursor-auto-runner) — `choco install cursor-auto-runner`.
- **Homebrew tap for macOS**: CI computes the DMG sha256 and updates the `cursor-auto-runner` cask in the `KurtStevenK/homebrew-tap` repository on every tagged release — `brew install --cask KurtStevenK/tap/cursor-auto-runner`.
- **GitHub Pages landing page**: `landing/` is deployed to https://kurtstevenk.github.io/cursor-auto-runner/ on every push to `master` (`.github/workflows/pages.yml`); the page's download cards cover all install channels.
- Release notes on tagged releases are now composed from the matching CHANGELOG section plus a per-OS downloads & install table.

### Fixed
- **No tray icon in packaged (installer) builds.** Tray icons, bundled button templates and the macOS permission-dialog icon were resolved against `process.resourcesPath`, but electron-builder packs `assets/` inside `app.asar` — so the icon file was not found and the tray showed a blank slot (tooltip still worked). All asset paths now resolve via `app.getAppPath()`, which points into the asar when packaged and to the project root in dev. Packaged builds also regain the bundled Run / Always Run / Allow starter templates.

## [1.2.9] - 2026-09-29

### Fixed
- **Tray and stats clicks no longer wait for screen matching.** Grayscale conversion and NCC now run in a warm, cancellable worker thread; Electron's main event loop remains available for tray events.
- Auto Run no longer searches `always-run` templates first. Ineligible modes are filtered instead of receiving a negative sort rank.
- Stopping or changing mode cancels in-flight matching, and worker failures restart with backoff instead of falling back to blocking main-thread work.

### Changed
- Detection captures screen sources once, crops only displays containing visible Cursor windows, and skips full-screen matching when no Cursor window is known.
- Template preprocessing and haystack integral images are reused. Bundled template noise was reduced; duplicate, oversized, overly wide and excess captures are ignored.
- The bundled starter set contains one tight dark Run, Always Run and Allow / Approve reference; light-theme or changed controls require a local capture.
- The capture overlay now asks for invariant button labels, rejects duplicate/dynamic captures, and announces validation feedback.
- Overlay detection status uses lightweight IPC. Full stats are sent on meaningful changes or at most once per second, and SQLite snapshots use two prepared aggregate queries instead of twelve synchronous counts.
- Added opt-in event-loop/phase timings, a repeatable worker benchmark, matcher/cancellation regressions, an SQLite integration test, packaged-worker checks, and CI quality gates. See `PERFORMANCE.md`.

## [1.2.8] - 2026-09-29

### Changed
- **Default refresh interval is now 4000 ms** (was 700 ms). Existing installations keep their persisted value; the new default applies to fresh setups and to the interval shown before any snapshot arrives.
- Added a **landing page** (`landing/index.html`) with download buttons for all platforms and a **GitHub Actions workflow** (`.github/workflows/build.yml`) that builds Windows, Linux (AppImage + deb) and macOS (DMG) packages on tagged releases — Linux packages and the DMG cannot be produced on Windows itself.
- `package.json` metadata completed for Linux packaging (author email as deb maintainer, repository and homepage URLs).

## [1.2.7] - 2026-09-29

### Fixed
- **Tray captures in dev went to the wrong folder**: `templatesBaseDir()` resolved relative to the compiled file (`dist/`), but the detector reads templates from the project root — so templates captured via the tray menu in dev were silently ignored. The project root is now found by walking up to the folder containing `package.json` (same for the capture CLI), which is depth-independent. Stray captures from `dist/assets/templates` were moved into `assets/templates` as additional variants.

## [1.2.6] - 2026-09-29

### Fixed
- Stats overlay layout: the refresh-interval row could overlap the 7-day chart's date labels (the row wrapped to two lines and the fixed-height card squeezed the content). The chart area now absorbs remaining space while the interval row, status line and buttons are kept at their natural size; the window is slightly wider (400 px) and button labels shorter (`Faster → 700 ms`).

## [1.2.5] - 2026-09-29

### Changed
- Docs and tray labels now mention the **Approve** button: Cursor's approval button has appeared under different labels (*Allow*, *Approve*); the detector matches it via captured image templates either way. The tray's "Capture templates…" submenu shows the entry as "allow / approve".
- README version badge and description updated accordingly.

## [1.2.4] - 2026-09-29

### Added
- **Refresh interval visible and adjustable in the stats overlay**: the window now shows the current value (`Refresh interval: 700 ms`) next to *Faster* / *Slower* buttons — same ladder as the tray menu, applied live and persisted. The interval travels with the stats snapshot (`pollIntervalMs`), so both displays always agree.

## [1.2.3] - 2026-09-29

### Added
- **Left click on the tray icon now toggles the stats overlay** (open/closed). The full menu opens on right click; with `setContextMenu` Windows also opened the menu on left click, which would shadow the toggle.

## [1.2.2] - 2026-09-29

### Added
- **Refresh interval control in the tray menu**: shows the current value (`Refresh interval: 700 ms`) and offers *Faster* / *Slower* steps (150 ms – 6 s ladder). Persisted in `settings.json`, applied live — no restart needed.
- `scripts/test-overlay.js` diagnostic: loads the overlay in a test window, verifies the preload bridge and that the ✕ button reaches the main process.

### Fixed
- **Stats overlay was completely dead** (all zeros, status stuck at "Watching for the Cursor window…", ✕ and ESC did nothing): the renderer script was compiled to CommonJS but loaded by the page as a plain `<script>`, so it crashed immediately with `ReferenceError: exports is not defined` — before attaching any listeners or rendering any values. It is now compiled as a standalone ES module (`tsconfig.overlay.json`) and loaded with `<script type="module">`; the renderer is self-contained (no imports). Click stats, live updates, ✕ and ESC all work again.
- Renderer console errors are now logged in the main process output (`[overlay-renderer]`) so a broken overlay can never fail silently again.

## [1.2.1] - 2026-09-29

### Added
- Tray menu entry **"Open templates folder"** to review the captured button images (opens the folder where new captures are stored).

### Fixed
- `npm run rebuild:dev` used the wrong binary reference (`@electron/rebuild` — npm tried to launch Electron with it, showing "Unable to find Electron app at …\rebuild"). Now uses the correct `electron-rebuild` bin.

## [1.2.0] - 2026-09-29

### Added
- **Capture templates from the tray menu**: new "Capture templates…" submenu with an entry per button (Run / Always Run / Allow) and theme (dark / light). The auto-clicker pauses while the screen is frozen and resumes afterwards; templates are reloaded automatically after each capture.
- Capture logic moved to `src/main/capture.ts`, shared between the tray menu and the standalone `npm run capture-templates` script (which is now a thin wrapper).
- When packaged, templates captured via the tray are stored in the user data folder (survive app updates without write access to the install directory); the detector scans both the bundled and the user data template folders.

## [1.1.8] - 2026-09-29

### Fixed
- Templates captured by the capture tool were saved to the wrong folder (`dist/scripts/assets/templates`) and the app reported "no templates found": `app.getAppPath()` points to `dist/scripts` when Electron runs the capture script directly, but to the project root for the main app. Both the capture tool and the detector now derive the project root from the compiled script location (`__dirname`), so both always agree.
- Added `scripts/test-detector.js` diagnostic: one detection pass that logs template loading, Cursor window discovery and any on-screen button (no clicks performed).

## [1.1.7] - 2026-09-29

### Fixed
- Overlay's ✕ button (and live stats) did nothing: the sandboxed preload script failed to load because it imported `../shared/types` at runtime, which sandbox restrictions forbid — so `window.autoRunner` never existed. The preload is now self-contained (types via `import type`, IPC channel names as local constants); the bridge is verified loading and the window closes via ✕, ESC and the tray toggle.

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

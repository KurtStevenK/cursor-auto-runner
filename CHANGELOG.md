# Changelog

All notable changes to **Cursor Auto Runner** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and each shipped task gets its own version number.

## Unreleased

## [1.2.101] - 2026-10-18

### Changed
- **Packaging:** the cookie-encryption fuse is left off. The app stores no cookies, and enabling it caused keychain or keyring prompts on some systems.

## [1.2.100] - 2026-10-18

### Fixed
- **CI:** a `.gitattributes` file forces LF line endings on checkout so the Biome format check passes on Windows runners, which default to CRLF.

## [1.2.99] - 2026-10-18

### Fixed
- **Logging:** a late error from a rotated log stream no longer discards the active stream.

## [1.2.98] - 2026-10-18

### Fixed
- **Detection:** the unchanged-screen skip re-checks every window at least every 5 s and hashes every pixel of a quarter-scale downsample, so a button appearing in place of a similar element can no longer be skipped indefinitely. Stale entries are pruned.

## [1.2.97] - 2026-10-18

### Fixed
- **Clicks:** the typing guard no longer treats the app's own click as user activity, so the built-in repeat click works again with "Pause while typing" on. Detection and click failures are counted separately, so a clicker that keeps failing now backs off and raises the health warning.

## [1.2.96] - 2026-10-18

### Changed
- The overlay's "Capture Run template" button captures the current theme (dark or light) and says which in its label.
- The keyboard shortcut choice Ctrl/Cmd+Shift+R (which collides with hard-reload and VS Code Refactor) is replaced by Ctrl/Cmd+Alt+Shift+A. Anyone who had picked the old one now has the shortcut off.

### Fixed
- When the global shortcut cannot be registered, the setting is reset to Off so the menu does not stay checked and the notice does not repeat on every launch.
- `brew uninstall --zap` also removes the updater caches.

## [1.2.95] - 2026-10-18

### Fixed
- A Stop, screen lock or suspend that arrives while the macOS permission check is still pending is no longer overridden when the check finishes.

## [1.2.94] - 2026-10-18

### Fixed
- The first-run welcome dialog only enables "Start at login" when you confirm with "Got it" and the box is checked; dismissing or quitting while it is open changes nothing and no longer registers a login item.
- The welcome is recorded as shown only after the dialog resolved normally.
- Users upgrading from versions before the welcome dialog existed no longer see it.
- "Start at login" is hidden on Linux (login items are not supported there), and the login-item reconcile is skipped.

## [1.2.93] - 2026-10-18

### Fixed
- Template capture now always restores the previous mode: the pause is released when the capture window closes for any reason (ESC, Cmd+W / Alt+F4, replaced by a second capture, or a setup failure), exactly once.

## [1.2.92] - 2026-10-18

### Changed
- **Docs:** `IMPROVEMENT-PLAN.md` records the review findings, the roadmap, and which version shipped each item.

## [1.2.91] - 2026-10-18

### Added
- **Privacy:** README and both landing pages state what the app does with screen captures, statistics, logs and network access (local only, no telemetry; the update check is optional).

## [1.2.90] - 2026-10-18

### Changed
- **Tooling:** Biome lints and formats `src/`, `tests/` and `scripts/` (`npm run lint`, `npm run format`), enforced in CI; `engines.node >= 22`, `.nvmrc` and `.editorconfig` added. Sources are formatted once; no behaviour change.

## [1.2.89] - 2026-10-18

### Added
- In-app updates on Windows and macOS (non-Homebrew installs) through electron-updater: "Download update", live "Downloading NN%" in the tray menu, then "Restart now / Later". Release builds now publish `latest.yml` and `latest-mac.yml`. Homebrew installs keep the cask upgrade; Linux keeps the release-page notification.
- Settings checkbox "Check for updates automatically" (on by default) to switch off the check after launch.

### Changed
- The GitHub API fallback sends `If-None-Match` and treats a 304 as "no change".

## [1.2.88] - 2026-10-18

### Changed
- **Internal:** the detection orchestrator is split into `src/main/detection/` (template loader, window finder, screen capture) with injectable providers, and a fixture-driven end-to-end test runs the real matcher worker under plain Node. No behaviour change.

## [1.2.87] - 2026-10-18

### Added

- **Wayland notice (Linux)** — when a Wayland session is detected the app logs a warning and shows a one-time notification that synthetic clicks and screen capture may be restricted and that an X11/XWayland session is recommended. The README's platform notes document the same guidance and how to check `XDG_SESSION_TYPE`.

## [1.2.86] - 2026-10-18

### Added

- **First-run welcome** — a one-time dialog explains what the app does, the macOS permissions it needs and how to start, with a *Start at login* checkbox. Reopen it from *Settings → Show welcome…*.

### Changed

- The macOS permission dialog now states in plain language what is missing and the one thing to do; the Electron/system status lines moved to a final "Technical details" line.

### Fixed

- Pausing for the lock screen or sleep no longer overwrites the saved last mode, and quitting no longer resets it, so *Restore last mode on launch* keeps working.
- Waking from sleep while the screen is still locked no longer resumes auto-run early; it resumes on unlock.

## [1.2.85] - 2026-10-18

### Changed

- **Stats overlay window** — it is now resizable (minimum 360×520), remembers its size and position between sessions (and re-centres if its display was disconnected), and uses a regular always-on-top level instead of the screen-saver level. *Settings → Keep stats window on top* turns always-on-top off.
- The overlay follows the system light/dark appearance.

## [1.2.84] - 2026-10-18

### Added

- **Detection health in the overlay and tray** — the stats overlay now shows the last click time and the number of loaded templates, warns when the matcher is failing ("retrying with backoff"), and after 10 minutes without a match while Cursor is visible suggests capturing new templates with a one-click *Capture Run template…* button. The tray tooltip adds "matcher retrying" and a notification appears once when the matcher fails three times in a row.

## [1.2.83] - 2026-10-18

### Changed
- **Security:** SECURITY.md documents the `npm audit` advisory reported through `@nut-tree-fork/nut-js` (a `file-type` parser loop), why the app does not reach that code path, and why no dependency override is applied.

## [1.2.82] - 2026-10-18

### Added
- **Research:** a macOS Accessibility-API detection spike (`scripts/spike-ax-buttons.js`, `docs/ax-detection-spike.md`) that walks Cursor's accessibility tree for Run / Always Run / Allow buttons. Documentation only; runtime behaviour is unchanged.

## [1.2.81] - 2026-10-18

### Changed
- **Landing page:** the three.js hero loads lazily (desktop, motion allowed) over a static gradient and framer-motion is replaced by CSS reveals, cutting the initial JavaScript from 1.28 MB to about 245 KB.

## [1.2.80] - 2026-10-18

### Added
- **Contributing:** `CONTRIBUTING.md`, GitHub bug-report and feature-request issue forms (blank issues disabled, private security advisory link), and a pull request checklist.

## [1.2.79] - 2026-10-18

### Added
- **Adaptive polling:** the refresh interval you choose stays the baseline, but the app now polls at most every 2 s while no Cursor window is visible, every 5 s after 5 minutes of system inactivity, and at 500 ms for the three checks after a click. The stats overlay shows the interval in use when it differs from your setting.
- **Lock-screen and sleep pause:** auto-run pauses while the screen is locked or the computer is suspended and resumes in the previous mode on unlock or wake.

### Fixed
- Stats are flushed to disk when the system shuts down.

## [1.2.78] - 2026-10-18

### Added
- **Typing guard:** *Settings → Pause while I am typing* (on by default) skips a click while you are actively using the mouse or keyboard and retries on the next check, so the app no longer interrupts what you are typing.
- **Focus control:** *Settings → Focus Cursor before clicking* (on by default, the previous behavior) can be turned off to stop the app from bringing the Cursor window to the front before each click.

## [1.2.77] - 2026-10-18

### Added
- **Global shortcut:** *Settings → Keyboard shortcut* in the tray menu can register `Ctrl/Cmd+Alt+R`, `Ctrl/Cmd+Shift+R` or `Ctrl/Cmd+Alt+Shift+R` (off by default) to toggle between *Stop* and the last mode you used. If the shortcut is already taken by another app, a notification tells you.

## [1.2.76] - 2026-10-18

### Added
- **Settings submenu:** the tray menu has a new *Settings* submenu with *Start at login*, *Restore last mode on launch*, *Confidence* (0.80 / 0.84 / 0.88 / 0.92 / 0.95) and *Click cooldown* (0.5 s / 1 s / 2 s / 5 s). Changes are saved and apply immediately without restarting.
- **Start at login:** the app can now launch automatically when you sign in (off by default).

## [1.2.75] - 2026-10-18

### Changed
- **Tests:** `npm run test:coverage` reports unit-test coverage of the testable modules and fails below 80 % lines / 70 % branches; CI runs it on the macOS and Linux test jobs. Timing assertions scale with `TEST_TIMING_SCALE` so instrumented runs stay green.

## [1.2.74] - 2026-10-18

### Changed
- **CI:** the packaged-worker smoke test runs on the Linux and macOS builds as well as Windows.

## [1.2.73] - 2026-10-18

### Changed
- **Security:** the template-capture window runs with context isolation, a sandboxed preload and a Content Security Policy; the renderer no longer has Node access, region payloads are validated, and no files are left in the OS temp folder.

## [1.2.72] - 2026-10-18

### Fixed
- **Settings:** values read from `settings.json` are validated and clamped (refresh interval 150–60000 ms, confidence 0.5–0.99, cooldown 0–60 s, known modes), and the file is written atomically. Corrupt files fall back to defaults.

### Changed
- **Tests:** settings and stats stores run under plain Node and have unit tests.

## [1.2.71] - 2026-10-18

### Changed
- **Tests:** the mode controller is now unit-tested (click, cooldown, repeat-click, stop, error backoff); its detector, clicker and stats dependencies are injectable.

## [1.2.70] - 2026-10-18

### Fixed
- **Stability:** repeated detection errors (for example while the matcher worker restarts) back off exponentially up to 30 s instead of retrying at full speed. The controller exposes a health summary for the UI.

## [1.2.69] - 2026-10-18

### Changed
- **CPU usage:** when a watched window's pixels have not changed since the last miss, the matcher pass is skipped. Idle polling at short intervals now costs almost nothing.

## [1.2.68] - 2026-10-18

### Added
- **Diagnostics:** the app writes a rotating log file (`cursor-auto-runner.log` in the OS log folder, for example `~/Library/Logs/Cursor Auto Runner` on macOS). The tray menu gains **Open log folder**, and uncaught errors are logged.

## [1.2.67] - 2026-10-18

### Added
- **Security:** packaged builds flip Electron fuses: the binary can no longer run as plain Node, ignores `NODE_OPTIONS` and `--inspect`, loads the app only from the integrity-checked `app.asar`, and leaves cookie encryption off (the app stores no cookies).

## [1.2.66] - 2026-10-18

### Added
- **Homebrew:** `brew uninstall --zap cursor-auto-runner` now removes the app's settings, stats and logs under `~/Library`.

## [1.2.65] - 2026-10-18

### Changed
- **Dependencies:** Dependabot updates arrive grouped (production, development, GitHub Actions). Dependency-only merges no longer need their own release; they ride along with the next user-facing one (see AGENTS.md).

## [1.2.64] - 2026-10-18

### Changed
- **CI:** unit tests now also run on macOS and Ubuntu runners, so macOS-only code paths are exercised in CI; the matcher benchmark summary is uploaded as a workflow artifact.

## [1.2.63] - 2026-10-18

### Fixed
- **Docs:** README badges and prerequisites now state the shipped Electron 44 and Node 22 instead of Electron 33 / Node 18.

## [1.2.62] - 2026-10-18

### Fixed
- **IPC hardening:** the overlay's set-mode message is validated against the known modes before it is applied.
- **Template capture:** resuming the previous mode after a capture session goes through the same macOS permission check as starting it from the tray.

## [1.2.61] - 2026-10-18

### Changed
- **Installer size:** button templates are decoded with Electron's built-in image support instead of the `jimp` library, which is no longer shipped in the app (about 30 MB less inside `app.asar`). Detection behaviour is unchanged.

## [1.2.60] - 2026-10-18

### Changed
- **Installer size:** compiled tests and helper scripts (`dist/tests`, `dist/scripts`) are no longer packaged into the app; only `dist/src` ships.

## [1.2.59] - 2026-10-13

### Fixed
- **Clicks (Windows & macOS):** Run is clicked again when the approval row is on screen. The current arrow-style Run button did not match the two older bundled templates. A newer capture that does match was ignored because the catalog kept only three images and filled those slots in filename order (`run-2` before `run-3`). Bundled templates now include that button, and the two newest local captures are kept as well.
- **Auto Always Run:** colored text in the agent chat no longer cancels the search. If accent verification misses, the composer band is searched for Run or Allow, and Always Run is clicked when it sits on that same row. Auto Run already had this fallback; Always Run stopped after the first colored region.

## [1.2.58] - 2026-10-11

### Fixed
- **Detection:** when accent-color UI is present but accent verification misses the Run button (busy agent chat), fall back to template matching in the composer band instead of skipping the crop entirely.

## [1.2.57] - 2026-10-11

### Fixed
- **Homebrew:** the cask no longer deletes the app bundle during an upgrade. That delete ran before Homebrew could move the bundle, so `brew upgrade` removed `/Applications/Cursor Auto Runner.app` and then stopped with "App source is not there."

### Added
- **Tray menu:** **Check for updates…** compares the installed version with the latest GitHub Release. On macOS, **Install updates with Homebrew** (on by default for a cask install) runs `brew upgrade --cask cursor-auto-runner` in the background. Homebrew updates its taps first, then replaces the app and quits this copy.

## [1.2.56] - 2026-10-11

### Fixed
- **Detection (macOS):** Cursor is recognized by the app that owns the window, not by the document title. A FeatherShot window (`CHANGELOG.md — FeatherShot`) is watched the same way as any other project, including `cursor-auto-runner`.

### Added
- **Tray menu:** **Test buttons…** opens a window with the Run, Always Run, and Allow images. Start Auto Run or Auto Always Run and the click count should rise, without waiting for Cursor to show a prompt.

## [1.2.55] - 2026-10-11

### Fixed
- **Detection (Windows & macOS):** a local Cursor window is watched again when RustDesk is not open. Workspace titles that contain `cursor-auto-runner` (macOS `file — cursor-auto-runner`, Windows `file - cursor-auto-runner - Cursor`) were treated as this app’s own window and skipped.

## [1.2.54] - 2026-10-11

### Changed
- **Firebase landing:** `three` 0.170 → 0.186, `@vitejs/plugin-react` 5 → 6.

## [1.2.53] - 2026-10-11

### Changed
- **Firebase landing:** `framer-motion` 13 → 14.

## [1.2.52] - 2026-10-11

### Changed
- **Build:** `@types/node` 26.6.3 → 26.6.4.

## [1.2.51] - 2026-10-11

### Changed
- **Build:** Electron 44.4.5 → 44.5.1.

## [1.2.50] - 2026-10-11

### Fixed
- **Homebrew:** cask quits the app and deletes the bundle on uninstall so upgrades are less brittle; [packaging/homebrew/README.md](packaging/homebrew/README.md) documents `brew reinstall --cask cursor-auto-runner --force` when `/Applications/Cursor Auto Runner.app` was removed manually.

## [1.2.49] - 2026-10-11

### Added
- **Tray menu:** disabled header shows the installed version (`app.getVersion()`).

## [1.2.48] - 2026-10-11

### Fixed
- **Detection (Windows & macOS):** screen crops export tight BGRA from `NativeImage.toBitmap()` (row stride / size mismatches after Electron 44 broke template matching and stopped all clicks). PNG fallback and unit tests for row repacking.

## [1.2.47] - 2026-10-11

### Changed
- **Repo hygiene:** ignore local `.vscode/` and `.cursor/plans/`; drop tracked Cursor plan files from the public repository (keep `.cursor/rules/` for shared guidance).

## [1.2.46] - 2026-10-11

### Added
- **GitHub Pages landing:** copy-to-clipboard buttons for Chocolatey, APT, and Homebrew install commands.

### Changed
- **Docs:** independent personal OSS disclaimer in README and GitHub Pages landing; [AGENTS.md](AGENTS.md) distribution scope; Homebrew README clarifies one repo (`homebrew-tap`) vs `KurtStevenK/tap` brew id; removed legacy org tap migration notes.
- **Firebase landing:** shorter Homebrew tap hints in install commands.

## [1.2.45] - 2026-10-03

### Added
- **Protected `master`:** PR-only merges; [AGENTS.md](AGENTS.md) and **CI** workflow for branch protection; Cursor rule for shipping/releases.
- **Firebase landing release data:** `scripts/sync-firebase-release-data.js` refreshes checksum manifest from GitHub Releases; CI runs it before Hosting deploy; release job mirrors all platforms via `mirror-release-firebase.sh`.
- **README:** security & trust section with VirusTotal, Electron hardening, and verify-download steps.

### Changed
- **Firebase landing:** React 19, Vite 8, TypeScript 7, framer-motion 13, @react-three/fiber 9 / drei 10.
- **CI:** bump pinned GitHub Actions (checkout, setup-node, artifacts, CodeQL, Pages, dependency-review, action-gh-release); add `firebase-landing` build job.
- **Build:** `electron-builder` 25 → 26; TypeScript 5 → 7; Electron 33 → 44; `jimp` 0 → 1; `better-sqlite3` 12 → 13; `@types/node` 22 → 26.
- **Detector:** use `NativeImage.toBitmap()` (Electron 44 deprecates `getBitmap()`).
- **CI:** override `node-gyp` to 13.0.2 (VS 2026 / Python 3.14); run Windows jobs on `windows-2022` for reliable native module builds.
- **Firebase landing:** mirror version and SHA-256s come from `release-<version>.json` tied to root `package.json` (not a hardcoded Linux-only version).
- **Linux downloads:** GitHub Pages and release notes link AppImage, `.deb`, and `.pacman` on Firebase Storage (`linux/<version>/`). The release job uploads those packages there before publishing the GitHub Release, and no longer attaches them to the Release. GitHub's 100 MB git limit does not apply to Storage.

## [1.2.44] - 2026-10-02

### Added
- **RustDesk:** a local install clicks Run, Always Run, and Allow inside a fullscreen RustDesk session. The app is not installed on the remote computer.

### Fixed
- **APT:** `.deb` files are stored with Git LFS so a package over GitHub's 100 MB limit can still be published. The 1.2.43 package is added from its GitHub Release.

## [1.2.43] - 2026-10-02

### Fixed
- **macOS CI:** trim the Apple ID password, check it with `notarytool history` before signing, and notarize once per architecture so Gatekeeper can accept the DMG.
- **Firebase Hosting:** a version bump no longer fails the deploy when that GitHub Release is not published yet.

## [1.2.42] - 2026-10-02

### Fixed
- **macOS releases:** CI now has `APPLE_ID` and `APPLE_APP_SPECIFIC_PASSWORD` so Developer ID builds are **notarized** (Gatekeeper / Homebrew installs).

## [1.2.41] - 2026-10-01

### Added
- **Firebase full mirror:** CI uploads every release’s installers to `releases/<version>/` on Storage (not only `linux/`); landing mirror version follows root `package.json`.

### Fixed
- **CI Linux mirror:** `gcloud storage cp` now signs in with `GOOGLE_APPLICATION_CREDENTIALS` before upload. v1.2.40 built the installers, then the release job stopped here and never updated Homebrew or APT.

## [1.2.40] - 2026-10-01

### Fixed
- **CI macOS:** override `node-gyp` to 10.3.1 so `better-sqlite3` rebuilds on the macOS 26 runner (Python 3.14 has no `distutils`). The setuptools `pip install` step failed there as an externally managed environment.
- **CI APT:** if the `gh-pages` push loses a ref race, rebase onto `origin/gh-pages` and push once more.

## [1.2.39] - 2026-10-01

### Added
- **VirusTotal:** `scripts/virustotal-scan.js`, `npm run scan:virustotal` (reads `.env.local`), CI scan on tagged releases when `VIRUSTOTAL_API_KEY` is set; report table on GitHub Release notes.
- **[SECURITY.md](SECURITY.md)** — public-repo secret inventory and never-commit list; [`.env.example`](.env.example) for local VT key.
- **GitHub security:** CodeQL analysis, Dependabot (npm + Actions), dependency review on pull requests; README CI/CodeQL badges.

### Changed
- **`.gitignore`:** `.env.local`, Apple/APT signing artifacts, service-account JSON patterns.
- **`scripts/refresh-csc-github-secrets.sh`:** no longer prints generated `CSC_KEY_PASSWORD` to the terminal.

### Fixed
- **CI macOS:** tried installing Python `setuptools` before `dist:mac`. The macOS 26 runner rejected that `pip install` (externally managed environment), so the DMG job still failed.
- **CI Firebase landing:** prefer `FIREBASE_TOKEN` for Hosting deploy; document Hosting Admin on the Linux SA.

## [1.2.38] - 2026-10-01

### Fixed
- **CI macOS:** sign from the imported keychain only (omit `CSC_LINK` during `dist:mac` so electron-builder does not spawn a second temp keychain).

### Added
- **`.github/workflows/firebase-landing.yml`** — deploy Firebase Hosting when `firebase-landing/` changes on `master`.

### Changed
- **Firebase landing:** download URLs use `LINUX_MIRROR_VERSION` for DMG/EXE filenames.

## [1.2.37] - 2026-10-01

### Fixed
- **Firebase landing:** Downloads intro no longer wraps “Releases” alone (wider section subtext, keep “GitHub Releases” on one line).

## [1.2.36] - 2026-10-01

### Changed
- **Firebase landing:** optional/alternate install commands span full width; clarify `brew tap KurtStevenK/tap` ↔ `homebrew-tap` repo; separate one-liner cask copy block.

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

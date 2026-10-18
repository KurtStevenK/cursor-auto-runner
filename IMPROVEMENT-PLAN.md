# Cursor Auto Runner — Review and Improvement Plan

Reviewed on 2026-10-18 against `master` at v1.2.59 (commit e9d2c72).
All 42 unit tests pass locally. Findings below are ordered by impact within each area,
and the roadmap at the end groups them into shippable phases.

## What is already strong

- **Architecture.** Grayscale NCC matching runs in a cancellable worker thread with
  transferable buffers; the main process stays responsive (p95 heartbeat ~12 ms).
  Coarse-to-fine pyramid, accent-color seeding and row anchoring are well thought out.
- **Performance discipline.** `bench:matcher` enforces budgets in CI, `soak:matcher`
  exists, and PERFORMANCE.md records a real baseline.
- **Release automation.** One tag push produces signed and notarized macOS DMGs,
  Windows NSIS, Linux AppImage/deb/pacman, Homebrew cask, APT repo, Chocolatey,
  Firebase mirror and VirusTotal scan.
- **Security posture.** Context isolation, no node integration in the overlay, CSP,
  CodeQL, Dependabot, dependency review, a clear SECURITY.md.

## Findings and recommendations

### A. Detection reliability (highest leverage)

The last twelve releases are almost all detection repairs. Pixel templates break
whenever Cursor restyles a button, and users must recapture templates by hand.

| # | Finding | Recommendation |
|---|---------|----------------|
| A1 | Templates are the only detection path. | **Spike: accessibility-tree detection.** Cursor is Chromium-based and exposes buttons named "Run", "Always Run", "Allow" through macOS AX and Windows UI Automation. Finding and pressing them via the AX API needs no Screen Recording, no templates, no DPI or theme handling, and no mouse movement. Time-box a 3–5 day prototype; if viable it becomes primary with templates as fallback. |
| A2 | Only `dark` templates ship (`assets/templates/dark`). README advertises multi-theme support. | Capture and bundle light-theme templates, add light fixtures to `tests/`, and extend `check-packaged-worker.js` accordingly. |
| A3 | Miss streaks are only logged to console; a packaged app has no stdout. | Surface "no match for N minutes, templates may be stale" in the overlay and tray with a one-click "Capture templates…" shortcut. |
| A4 | Windows captures a display thumbnail capped at 1920×1080, so a 4K display is downscaled 2× before matching small buttons. | Capture the window region at native resolution (nut-js `screen.grabRegion` or per-window `desktopCapturer` as macOS already does). Better fidelity and less pixel work. |
| A5 | `Detector` (779 lines) is untestable end to end because capture and window enumeration are Electron calls inside the class. | Split into `template-loader.ts`, `window-finder.ts`, `screen-capture.ts` and an orchestrator with injected providers, then add a fixture-driven end-to-end test. |

### B. Performance and resource usage

| # | Finding | Recommendation |
|---|---------|----------------|
| B1 | Every poll re-matches even when the screen has not changed. At 150–500 ms intervals this is the dominant CPU cost. | Hash each crop (or a 1/8 downsample) and skip matching when unchanged since the last pass. |
| B2 | Polling is constant regardless of context. | Adaptive polling: slow down when no Cursor window is found, when the system is idle (`powerMonitor.getSystemIdleTime`) or on battery; pause on `lock-screen`/`suspend`; speed up briefly after a click. |
| B3 | `jimp` is a runtime dependency used only to decode PNG templates. It adds ~30 MB (1,925 files) to `app.asar`. | Decode with `nativeImage.createFromPath(file).toBitmap()` and move `jimp` to devDependencies (tests and scripts still use it). |
| B4 | `build.files` includes `dist/**`, so compiled `dist/tests/*` and `dist/scripts/*` ship inside the installer (confirmed in the 1.2.43 asar). | Narrow to `dist/src/**`. |
| B5 | Screen capture is 360–420 ms of a ~900 ms pass (PERFORMANCE.md). | A4 plus B1 address most of it; measure again afterwards. |

### C. User experience

| # | Finding | Recommendation |
|---|---------|----------------|
| C1 | `confidence`, `cooldownMs` and `restoreLastMode` exist in settings but have no UI. No "start at login". | Add a Settings section (overlay tab or tray submenu) and `app.setLoginItemSettings`. |
| C2 | Every click calls `focus()` on the Cursor window and moves the pointer, interrupting whatever the user is typing elsewhere. | Make focus-stealing opt-in; add "do not click while I am typing" (skip when idle time < ~1 s). Investigate click-without-focus per platform. |
| C3 | Status text says "Watching…" forever even when detection is failing. | Show last match time, miss streak and worker-restart state (see A3, D6). |
| C4 | Overlay is fixed 400×560, non-resizable, always-on-top at `screen-saver` level, dark only. | Normal utility window level, remember position, honour `prefers-color-scheme`. |
| C5 | macOS permission dialog exposes internals ("Electron: granted, system: denied"). | Plain-language primary text; keep diagnostics behind a "Details" button. First-run walkthrough for permissions and mode choice. |
| C6 | Worker crash backoff (`match-worker-client.ts`) is invisible to the user. | Notification plus tray status when the matcher is in backoff. |
| C7 | No global shortcut to start/stop. | Optional `globalShortcut` toggle, configurable. |

### D. Code quality and maintainability

| # | Finding | Recommendation |
|---|---------|----------------|
| D1 | No linter, formatter, `engines`, `.editorconfig` or `.nvmrc`. | Add a linter and formatter (Biome; typescript-eslint cannot load the TypeScript 7 compiler), `npm run lint`, run in CI; declare `engines.node`. |
| D2 | IPC names and `POLL_LADDER_MS` are copy-pasted into `preload.ts` and `overlay.ts` because there is no bundler. | Bundle preload and overlay with esbuild (one step in `compile`). Single source of truth and enables `sandbox: true`. |
| D3 | `ModeController` has no tests although it is pure given a fake detector and clicker. | Test cooldown, the near-match retry loop, Stop responsiveness and error handling. |
| D4 | `StatsStore` and `SettingsStore` import `electron.app` at module level, so they only run under Electron (`test:stats` needs the Electron binary). `SettingsStore` trusts whatever JSON is on disk. | Inject the data directory; validate and clamp loaded settings. |
| D5 | `controller.loop` catches errors and immediately continues, so a persistent `detect()` failure spins at the poll interval. | Exponential backoff on consecutive errors, surfaced in the UI. |
| D6 | 28 `console.*` calls and no log file. Support requests cannot be diagnosed. | Rotating log in `userData` (electron-log or a small writer), "Open log folder" tray item, include log path in bug template. |
| D7 | `capture.ts` opens a `BrowserWindow` with `nodeIntegration: true, contextIsolation: false` and writes HTML plus a PNG to the OS temp dir. | Use a preload + `contextBridge`, serve the screenshot via a custom `protocol.handle` scheme, delete temp files afterwards. |
| D8 | `IPC.SET_MODE` accepts any string from the renderer. | Validate against the `Mode` union before `applyMode`. |
| D9 | Resuming after template capture calls `controller.set(prevMode)` directly, bypassing `ensureMacPermissions`. | Route through `applyMode`. |

### E. Testing and CI

| # | Finding | Recommendation |
|---|---------|----------------|
| E1 | The `quality` job runs only on `windows-2022`. macOS-only code (`owned-windows.ts`, `mac-permission-*.ts`, darwin window crops, Retina geometry) never executes in CI. | Matrix `npm test` across windows, macos and ubuntu; keep native-module steps on Windows. |
| E2 | `check-packaged-worker.js` hardcodes `release/win-unpacked`. | Parametrise for the macOS `.app` and Linux `linux-unpacked`. |
| E3 | No coverage signal. | `node --test --experimental-test-coverage` with a threshold on `src/worker` and `src/shared`. |
| E4 | Branch protection does not yet require the `quality` check (AGENTS.md lists it as optional). | Turn it on. |
| E5 | Bench budgets are absolute and runner-dependent. | Keep hard upper bounds, also upload the JSON summary as an artifact to watch trends. |

### F. Release engineering and distribution

| # | Finding | Recommendation |
|---|---------|----------------|
| F1 | 14 releases on 2026-10-11; four of them (1.2.51–1.2.54) are single dependency bumps. Each release costs four OS builds, notarization, a 30–60 min VirusTotal pass and Chocolatey moderation. | Group Dependabot updates (`groups:` in dependabot.yml), do not release for dev-dependency bumps, release when user-facing changes accumulate. Adjust the CHANGELOG policy text. |
| F2 | Auto-update exists only through Homebrew on macOS; Windows and Linux users get a notification. | Adopt `electron-updater` with the GitHub provider for NSIS and AppImage (blockmaps are already built); macOS is signed and notarized so it works there too. Keep the brew path as an option. |
| F3 | Windows installer is unsigned: SmartScreen warnings and Chocolatey moderation friction. | SignPath (free for OSS) or Azure Trusted Signing. |
| F4 | No Electron fuses. | `@electron/fuses` in `afterPack`: disable `RunAsNode` and `NodeCliInspectArguments`, enable `OnlyLoadAppFromAsar` and asar integrity. |
| F5 | README badges say Electron 33 and Node ≥ 18; the app ships Electron 44 and CI uses Node 22. | Remove version badges or generate them from `package.json`. |
| F6 | Linux Wayland: synthetic clicks and `desktopCapturer` behave differently (portal prompts). README has one sentence. | Detect `XDG_SESSION_TYPE=wayland`, show a one-time notice with what works, document in Platform notes. |
| F7 | Homebrew cask has no `zap` stanza. | Add `zap trash:` for `~/Library/Application Support/Cursor Auto Runner`. |

### G. Security and privacy

| # | Finding | Recommendation |
|---|---------|----------------|
| G1 | `npm audit --omit=dev` reports 7 moderate issues, all through `@nut-tree-fork/*` → old `jimp`. | Track upstream; add an `overrides` entry if a patched `jimp` is compatible. |
| G2 | The app requests Screen Recording but nowhere states that captures never leave the device. | Add a short privacy statement to README and the landing page. |
| G3 | Update check calls `api.github.com` 8 s after every launch with no opt-out. | Add "Check for updates automatically" toggle; send `If-None-Match`. |
| G4 | Items D7, D8, F4 above. | — |

### H. Documentation and website

| # | Finding | Recommendation |
|---|---------|----------------|
| H1 | Two landing pages (`landing/` on GitHub Pages and `firebase-landing/` on Firebase). | Pick one canonical URL and redirect the other. |
| H2 | Firebase landing ships a 1.28 MB JS bundle (three.js, drei, framer-motion) for a static download page. | Lazy-load or replace the 3D hero; code-split; target a mobile Lighthouse score ≥ 90. |
| H3 | No CONTRIBUTING.md or issue templates. | Add both; the bug template asks for OS, display scale, Cursor version and the log file (D6). |
| H4 | Zero-byte `capture-debug-display1.png` and `debug-detector-crop.png` sit in the repo root (ignored, but clutter). | Delete. |

## Roadmap

**Phase 0 — hygiene and quick wins (1–2 days, one PR each)**
B3 drop jimp from runtime · B4 narrow `build.files` · D8 validate `SET_MODE` · D9 route resume through `applyMode` · F5 fix badges · H4 delete stray files · D1 ESLint/Prettier/engines · E1 CI matrix for `npm test` · F1 Dependabot groups · F4 Electron fuses · F7 cask zap.

**Phase 1 — robustness and observability (about 1 week)**
D6 log file + Open log · B1 skip-if-unchanged · D5 controller backoff · A3/C3/C6 stale-template and worker status in overlay · D3 controller tests · D4 store injection and settings validation · D7 capture window hardening · E2 packaged smoke on macOS.

**Phase 2 — user experience (1–2 weeks)**
C1 settings UI + start at login · C2 focus and typing guards · B2 adaptive polling and lock-screen pause · A2 light templates · C5 permission dialog and first-run · C4 overlay window behaviour · C7 global shortcut.

**Phase 3 — distribution (2–3 weeks, partly waiting on external services)**
F2 electron-updater everywhere · F3 Windows signing · F6 Wayland notice · H1/H2 landing consolidation and bundle diet · G2/G3 privacy statement and update toggle · F1 release cadence policy in AGENTS.md.

**Phase 4 — detection architecture (spike, then decide)**
A1 accessibility-API prototype on macOS and Windows · A4 native-resolution window capture · A5 detector split and end-to-end fixture test.

## Metrics to watch

- Detection: fixture match rate, false positives per soak hour, time from prompt appearing to click.
- Resources: CPU % at the 1000 ms interval, per-pass ms (already in `[perf]` logs), installer size.
- Support: share of issues that end in "recapture your templates".
- Release: builds per week, median time from tag to all channels published.

## Status (2026-10-18, branch `improvements/plan-2026-10`)

All items that can be done from this machine were implemented, each as its own release commit (version bump + changelog section), 1.2.60 through 1.2.109, on this branch; the five items listed under "Not done" below are the exceptions. An Opus review of the branch produced 13 findings; all 13 are addressed: #1–#9 and #11–#13 by code changes in 1.2.93–1.2.102, and #10 (the `quitAndInstall` path) by extracting the quit handler into a tested guard in 1.2.107. The updater download and install flow itself still needs one real tag build; everything else about it is validated locally (see below).

| Item | Version | Notes |
|------|---------|-------|
| B4 narrow packaged files | 1.2.60 | |
| B3 drop jimp from runtime | 1.2.61 | Native loader verified pixel-identical to the jimp loader on all bundled templates; `app.asar` 23 MB → 13.6 MB |
| D8 + D9 IPC validation, permission-checked resume | 1.2.62 | |
| F5 README version badges | 1.2.63 | |
| E1 + E5 CI matrix, bench artifact | 1.2.64 | |
| F1 Dependabot groups, cadence policy | 1.2.65 | |
| F7 Homebrew zap | 1.2.66 | |
| F4 Electron fuses | 1.2.67 | Packaged app launches, worker loads from `app.asar.unpacked`, fuse wire verified |
| D6 log file + Open log folder | 1.2.68 | |
| B1 skip unchanged crops | 1.2.69 | |
| D5 controller backoff | 1.2.70 | |
| D3 controller tests | 1.2.71 | |
| D4 store injection, settings validation | 1.2.72 | |
| D7 sandboxed capture window | 1.2.73 | Smoke-tested in Electron: no Node access, screenshot loads, ESC cancels |
| E2 packaged smoke on all OSes | 1.2.74 | |
| E3 coverage gate | 1.2.75 | 89 % lines on the unit-testable modules only; main, tray, updates, capture and the Electron providers are excluded |
| C1 Settings submenu, start at login | 1.2.76 | Tray UI not exercised in a live session |
| C7 global shortcut | 1.2.77 | |
| C2 focus and typing guards | 1.2.78 | |
| B2 adaptive polling, lock-screen pause | 1.2.79 | |
| H3 CONTRIBUTING, issue forms | 1.2.80 | |
| H2 landing bundle diet | 1.2.81 | Initial JS 1.28 MB → 245 KB; rendered in a browser check |
| A1 accessibility spike | 1.2.82 | Script and doc only; Cursor was not running and the terminal lacks Accessibility permission, so no measurements yet |
| G1 audit advisory documented | 1.2.83 | No safe override exists; code path unreachable |
| A3 + C3 + C6 detection health in overlay | 1.2.84 | Overlay rendered in dark and light with fake data |
| C4 overlay window behaviour | 1.2.85 | |
| C5 permission dialog, first-run welcome | 1.2.86 | Also fixes `lastMode` being persisted as idle on quit and lock |
| F6 Wayland notice | 1.2.87 | |
| A5 detector split, end-to-end test | 1.2.88 | |
| F2 + G3 electron-updater, update toggle | 1.2.89 | Download/install flow untested: no release feed exists for this branch |
| D1 Biome lint and format | 1.2.90 | |
| G2 privacy statement | 1.2.91 | |
| Status update (this section) | 1.2.92 | |
| Review fix: capture always restores the mode | 1.2.93 | Opus review #5 |
| Review fix: welcome dialog and start-at-login | 1.2.94 | Opus review #7, #8 and an observed login-item bug |
| Review fix: applyMode race | 1.2.95 | Opus review #11 |
| Review fix: shortcut choice, overlay capture theme, zap caches | 1.2.96 | Opus review #13 |
| Review fix: typing guard vs own click, click-error counting | 1.2.97 | Opus review #3, #6 |
| Review fix: unchanged-skip TTL and full-coverage hash | 1.2.98 | Opus review #4 |
| Review fix: log stream identity | 1.2.99 | Opus review #12 |
| Review fix: LF line endings for the Windows format check | 1.2.100 | Opus review #2 |
| Review fix: cookie-encryption fuse off | 1.2.101 | Opus review #9 |
| Review fix: update feeds point at published file names | 1.2.102 | Opus review #1. Validated locally with a signed `dist:mac` build: every `url`/`path` in `latest-mac.yml` names a file that exists in `release/`, and electron-builder's safe-name rule (spaces → dashes) was confirmed in its source. A real tag build is still the only end-to-end proof |
| D2 bundle preloads and overlay | 1.2.103 | IPC constants now have a single source |
| Review fix: coverage job timing budget | 1.2.105 | CI only |
| Login Items icon | 1.2.106 | Apple-built icns; verified in System Settings with the signed build |
| Review #10: quit guard extracted and tested | 1.2.107 | `before-quit` re-entry from `quitAndInstall` covered by unit tests, with a 5 s cleanup timeout |
| Matcher timing test stabilised | 1.2.108 | Budgets doubled; the 2 s regression gate stays in `bench:matcher` |
| Status update | 1.2.109 | |
| A4 experimental per-window capture (Windows) | 1.2.110 | opt-in |
| F3 Windows signing wired, gated on secrets | 1.2.111 | |
| H1 canonical landing page | 1.2.112 | released as `v1.2.112` |
| Release-state docs | 1.2.113 | |
| Release verification record and Firebase manifest | 1.2.114 | |

Not done, and why:

- **A2 light templates** need real screenshots of Cursor's light theme; nothing on this machine can produce them. The loader, catalog and tests already handle a `light` folder.
- **A4 native-resolution window capture on Windows** shipped as an opt-in experimental toggle (1.2.110) because it cannot be tested from macOS; it needs a report from a 4K Windows user before becoming the default.
- **F3 Windows code signing** is wired into the release workflow (1.2.111) and activates when the Azure Trusted Signing secrets exist; the account itself is the maintainer's to create (`packaging/windows/README.md`).
- **H1 landing consolidation**: the Firebase page is declared canonical and the GitHub Pages landing links to it (1.2.112); removing the Pages site remains a product decision.
- **E4 required status checks** was already enforced on `master` (the `quality` check, strict); AGENTS.md now says so instead of calling it optional.

## Release 1.2.112 (2026-10-18)

- PR #47 merged into `master` (merge commit `435b5a8`) after all seven CI checks passed; tag `v1.2.112` pushed.
- Release workflow run 39145521558: `quality`, `linux` and `windows` succeeded; `macos` failed before building, at `xcrun notarytool history` with HTTP 401 ("Invalid credentials"). The step is unchanged since `v1.2.59` passed on 2026-10-12, so the stored `APPLE_APP_SPECIFIC_PASSWORD` has been revoked or expired. Fix: generate a new app-specific password at appleid.apple.com, update the secret (`scripts/refresh-csc-github-secrets.sh` / `scripts/push-apple-signing-to-github.sh`), then re-run the failed jobs of that run; the `release` and `chocolatey` jobs follow automatically.
- Windows update feed validated from the CI artifact: `latest.yml` lists `Cursor.Auto.Runner.Setup.1.2.112.exe` with sha512 and size, which is the name GitHub serves for the uploaded installer. Together with the local signed `dist:mac` check this covers both feed rewrites end to end up to the upload step.
- After the Apple app-specific password was regenerated and the secret updated, the failed jobs were re-run and every job succeeded (`macos`, `release`, `chocolatey`). The GitHub Release `v1.2.112` is published with the Windows installer, four macOS DMG/ZIP files, blockmaps, `latest.yml` and `latest-mac.yml`; the Homebrew cask is at 1.2.112; Chocolatey accepted the push (moderation pending as usual); Linux packages are on Firebase Storage.
- Update feed verified against the published release: every `url`/`path` in both feed files answers HTTP 200, and electron-updater (dev-mode harness pointed at the GitHub provider, current version forced to 1.2.59) read the feed, selected `Cursor.Auto.Runner-1.2.112-arm64-mac.zip` and downloaded it with checksum verification (143,618,738 bytes). The only unexercised step is `quitAndInstall()` itself, whose re-entry logic is unit-tested (1.2.107); the first real in-app update will be 1.2.112 → the next release.
- Firebase release manifest for 1.2.112 added for the landing page (`npm run sync:firebase-release-data 1.2.112`).

## Needs the maintainer (cannot be done from this session)

- **A2 light-theme templates:** open Cursor in its light theme, trigger an agent prompt, then use tray → Capture templates… → run / always-run / allow (light). The catalog, loader and tests already support the `light` folder; bundle the captures under `assets/templates/light/`.
- **F3 Windows signing:** create an Azure Trusted Signing account (or a SignPath Foundation project) and add the six `AZURE_*` secrets; the workflow is wired and verifies the signature (`packaging/windows/README.md`). Then set `build.win.publisherName` to the certificate CN so electron-updater verifies updates.
- **Live `quitAndInstall` check:** on this Mac the app is a Homebrew cask install, so it takes the `brew upgrade` channel by design; electron-updater's install step can only be exercised on Windows or on a macOS machine without the Caskroom. Download and checksum verification against the real feed is already proven (see Release 1.2.112).
- **Dependabot alerts:** `sprintf-js` has no fix and is build-tooling only; dismiss the alert in GitHub → Security with reason "vulnerable code is not actually used" if desired. `file-type` is documented in SECURITY.md.

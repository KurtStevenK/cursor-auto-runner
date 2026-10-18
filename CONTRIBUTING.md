# Contributing to Cursor Auto Runner

Thanks for helping out. This is a small Electron tray app, so most changes are
easiest to review when they are small and focused.

## Development setup

You need **Node.js 22** (the same version CI uses) and a Mac, Windows or Linux
desktop.

```bash
npm ci                   # install exact dependencies from package-lock.json
npm start                # compile and launch the app in dev mode
npm test                 # unit and regression suites (node:test)
npm run test:coverage    # same suites with coverage gates (80 % lines, 70 % branches)
npm run bench:matcher    # worker latency and main-thread heartbeat benchmark
```

- **Development:** run `npm run lint` (Biome) and `npm run format` before opening a PR; CI runs `npm run lint` and `npm run format:check`.

`npm run compile` type-checks and builds everything into `dist/`. Run it before
`npm test` if you touch TypeScript outside the test loop.

## Project layout

- `src/main/`: Electron main process (tray, controller, capture window, settings, stats, logging).
- `src/worker/`: matcher worker thread. Runs NCC template matching off the main thread.
- `src/shared/`: types and the message protocol shared by main, worker and overlay.
- `src/overlay/`: the stats window. It and the two preloads (`src/main/preload.ts`, `capture-preload.ts`) are bundled by esbuild (`scripts/bundle-renderer.js`) after `tsc`, so they import from `src/shared/` like everything else.
- `tests/`: `node:test` suites. Fixtures live in `tests/fixtures/`.
- `scripts/`: diagnostics, benchmarks, template capture and packaging helpers.
- `packaging/`: Homebrew cask, APT repository, Chocolatey package and Linux/macOS packaging notes.

## How changes ship

Read [AGENTS.md](AGENTS.md) for the full flow. In short:

1. Branch from `master`. `master` is protected, so changes land through a pull request.
2. Add a **CHANGELOG.md** entry under **Unreleased** for anything user-facing.
3. Open the PR. The **CI** workflow (`quality` job) must be green before merging.
4. Each shipped task gets its own version number. Version bumps and release tags are
   handled by the maintainer; see AGENTS.md for the release steps.

## Capturing templates

The matcher looks for button images you capture from your own Cursor window.
Templates are stored per theme, in dark and light folders.

- Tray icon → **Capture templates…** → pick the button (Run, Always Run, Allow / Approve) and the theme.
- Or from a terminal: `npm run capture-templates -- run dark`.

Drag the selection **tightly around the stable button label only**. Leave out
changing command names, counters and surrounding panel content. Overly wide or
duplicate captures are rejected on purpose, because they cause false matches.

## Diagnostics

- **Log file:** tray → **Open log folder**. Attach the relevant excerpt when reporting a bug.
- **Detector diagnostics:** start the app with `CURSOR_AUTO_RUNNER_DEBUG_DETECT=1` to log match details.
- **Performance logging:** start the app with `CURSOR_AUTO_RUNNER_PERF=1`. See [PERFORMANCE.md](PERFORMANCE.md).

## Code of conduct

Be kind. Assume good faith, keep feedback about the code, and keep discussions
respectful.

## Security

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md)
and use GitHub's private
[security advisory form](https://github.com/KurtStevenK/cursor-auto-runner/security/advisories/new).

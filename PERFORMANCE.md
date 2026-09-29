# Performance baseline

Measured on the Windows development machine on 2026-09-29. Screen-dependent
numbers are diagnostic, not cross-machine release guarantees.

## Before hardening

- One no-match detector diagnostic loaded 88 scaled variants and took 45.0 s
  wall-clock. This reproduced the long unresponsive periods reported for tray
  clicks because NCC ran on Electron's main process.
- The bundled set contained 21 tracked dark templates plus an active local
  capture. Several `always-run` images included changing command text.
- The detector rebuilt downscaled haystacks and integral images for every
  variant and captured all screen sources once per display.

## After hardening

Real three-display, one-Cursor-window, no-match pass:

- Total detector work: 1,015.5 ms
- Template load and worker initialization: 129.4 ms (first pass only)
- Window enumeration: 2.1 ms
- Screen capture and crop transfer: 423.6 ms
- Worker matching: 457.6 ms
- Worker heap: 3.9 MiB
- Active variants: 21 during this run
- Main-event-loop heartbeat: 12.1 ms p95; one 344.4 ms screen-capture spike

Synthetic 1280×720 no-match benchmark with 28 variants (final phase-tolerant matcher):

- Worker match: 183.4 ms
- Wall time: 183.9 ms
- Main-thread heartbeat p95/max: 13.0 ms
- Worker heap: 7.1 MiB

Stability checks:

- 30-minute lifecycle soak: 449 passes, 12.5 ms heartbeat p99, 77.7 ms
  heartbeat max, and worker heap changed from 6.9 MiB to 5.5 MiB.
- Final phase-tolerant matcher follow-up (2 minutes): 29 passes, 197.1 ms
  match p95, 12.5 ms heartbeat p99, 15.5 ms max, and worker heap changed
  from 7.0 MiB to 5.5 MiB.

## 1.2.11 detection repair

Capture-aware scaling and a stride-two, multi-candidate coarse pass restored
button accuracy without moving matching back to Electron's main process.

Real three-display, one-Cursor-window, no-button warm pass:

- Total detector work: 886.3 ms
- Screen capture and crop transfer: 359.6 ms
- Worker matching: 525.1 ms
- Loaded catalog: 5 templates / 35 mode-eligible variants
- Main heartbeat: 23.2 ms p95; the 280.2 ms maximum occurred during Electron
  screen capture, not worker matching

Synthetic 1280×720 no-match benchmark with 28 variants:

- Worker match: 100.8 ms
- Wall time: 101.4 ms
- Main-thread heartbeat p95/max: 14.3 / 14.3 ms
- Worker heap: 6.4 MiB

Two-minute lifecycle follow-up:

- 30 passes, 116.0 ms match p95
- 12.3 ms heartbeat p99, 66.2 ms maximum
- Worker heap grew by 0.6 MiB (6.4 MiB to 6.9 MiB)

Packaged smoke coverage loads the real templates from `app.asar`, executes the
unpacked worker, and verifies Run, Always Run, and Allow fixtures at the capped
capture scale.

## 1.2.12 adaptive matcher repair

The half-resolution, four-phase tiny-template path restores the reproduced
buttons while exact accent/action-row verification prevents prose matches.

Real three-display, one-Cursor-window, no-button warm pass (including two
unpackaged local captures):

- Total detector work: 439.5 ms
- Screen capture and crop transfer: 392.1 ms
- Worker matching: 44.6 ms (down from 12,711.9 ms before the color-safe exit)
- Loaded development catalog: 7 templates / 49 scaled variants
- No false match for the pixel-identical “Always Run” prose on screen

Reproduced full-window screenshots:

- Run: 26.2 ms, exact accent path
- Always Run: 78.8 ms, exact Run-anchored row path
- Allow in either mode: 10.8–15.3 ms, exact accent path

Synthetic 1280×720 benchmark:

- Larger no-button templates: 457.2 ms
- Tiny no-button templates: 447.8 ms
- Tiny successful match: 79.3 ms on the half pyramid
- Main-thread heartbeat p95/max: 6.2 / 11.3 ms
- Worker heap: 6.8 MiB

Two-minute lifecycle soak:

- 27 passes, 714.2 ms match p95
- 12.6 ms heartbeat p99, 47.6 ms maximum
- Worker heap grew by 1.3 MiB (8.3 MiB to 9.5 MiB)

The legacy diagnostic remained alive for roughly 45 seconds while native
handles shut down; the current diagnostic explicitly disposes the worker and
exits promptly. Detector phase metrics are measured around `Detector.detect()`.

Run the repeatable checks with:

```bash
npm test
npm run bench:matcher
npm run soak:matcher
npx electron scripts/test-detector.js
```

For live event-loop and phase logging:

```powershell
$env:CURSOR_AUTO_RUNNER_PERF = "1"
npm start
```

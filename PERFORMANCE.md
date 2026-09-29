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

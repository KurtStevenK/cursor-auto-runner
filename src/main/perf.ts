import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

export interface DetectionMetrics {
  totalMs: number;
  templatesMs: number;
  windowsMs: number;
  captureMs: number;
  matchMs: number;
  templateCount: number;
  variantCount: number;
  displayCount: number;
  cropCount: number;
  sourceMissCount: number;
  workerHeapBytes: number;
  cancelled: boolean;
}

const enabled = process.env.CURSOR_AUTO_RUNNER_PERF === '1';
const eventLoop = enabled ? monitorEventLoopDelay({ resolution: 20 }) : null;
let reportTimer: NodeJS.Timeout | null = null;

export function perfNow(): number {
  return performance.now();
}

export function startPerformanceMonitor(): void {
  if (!eventLoop || reportTimer) return;
  eventLoop.enable();
  reportTimer = setInterval(() => {
    const toMs = (nanoseconds: number) => Number((nanoseconds / 1_000_000).toFixed(1));
    console.log(
      '[perf] event-loop',
      JSON.stringify({
        p50Ms: toMs(eventLoop.percentile(50)),
        p95Ms: toMs(eventLoop.percentile(95)),
        p99Ms: toMs(eventLoop.percentile(99)),
        maxMs: toMs(eventLoop.max),
      })
    );
    eventLoop.reset();
  }, 30_000);
  reportTimer.unref();
}

export function stopPerformanceMonitor(): void {
  if (reportTimer) clearInterval(reportTimer);
  reportTimer = null;
  eventLoop?.disable();
}

export function reportDetectionMetrics(metrics: DetectionMetrics): void {
  if (!enabled) return;
  console.log('[perf] detection', JSON.stringify(metrics));
}

export function reportStatsDuration(durationMs: number): void {
  if (!enabled || durationMs < 1) return;
  console.log('[perf] stats-snapshot', JSON.stringify({ durationMs: Number(durationMs.toFixed(1)) }));
}

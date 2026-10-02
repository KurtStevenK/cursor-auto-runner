/** Overlay renderer: live stats display.
 *  Compiled by tsconfig.overlay.json as a standalone ES module and loaded by
 *  index.html via <script type="module"> — it must NOT import runtime modules.
 *  The shared types are therefore duplicated here (keep in sync with
 *  src/shared/types.ts), mirroring the preload's self-contained IPC constants. */
export type Mode = 'idle' | 'run' | 'always-run';

export interface StatsSnapshot {
  session: number;
  day: number;
  week: number;
  month: number;
  total: number;
  byDay: { date: string; count: number }[];
  mode: Mode;
  since: string;
  windowFound: boolean;
  watchedKind: 'cursor' | 'rustdesk' | null;
  pollIntervalMs: number;
}

// Duplicated from shared/types.ts (page must stay self-contained).
const POLL_LADDER_MS = [150, 300, 500, 700, 1000, 1500, 2500, 4000, 6000];

function stepPoll(current: number, dir: -1 | 1): number | null {
  const idx = POLL_LADDER_MS.indexOf(current);
  if (idx !== -1) return POLL_LADDER_MS[idx + dir] ?? null;
  const candidates = POLL_LADDER_MS.filter((v) => (dir === -1 ? v < current : v > current));
  return candidates.length ? (dir === -1 ? candidates[candidates.length - 1] : candidates[0]) : null;
}

declare global {
  interface Window {
    autoRunner: {
      getStats: () => Promise<StatsSnapshot>;
      setMode: (mode: Mode) => void;
      close: () => void;
      setPollInterval: (ms: number) => void;
      onStats: (cb: (snap: StatsSnapshot) => void) => void;
      onModeChanged: (cb: (mode: Mode) => void) => void;
      onDetectionState: (cb: (state: { windowFound: boolean; watchedKind: 'cursor' | 'rustdesk' | null }) => void) => void;
    };
  }
}

const $ = (id: string) => document.getElementById(id) as HTMLElement;

function setText(id: string, value: number): void {
  $(id).textContent = String(value);
}

function renderBadge(mode: Mode): void {
  const badge = $('modeBadge');
  badge.className = `badge ${mode}`;
  badge.textContent =
    mode === 'run' ? 'Auto Run active' : mode === 'always-run' ? 'Auto Always Run active' : 'Idle';
}

function renderSpark(byDay: { date: string; count: number }[]): void {
  const svg = $('sparkSvg');
  const labels = $('sparkLabels');
  const W = 340, H = 90, pad = 6;
  const max = Math.max(1, ...byDay.map((d) => d.count));
  const n = byDay.length || 1;
  const step = (W - pad * 2) / (n - 1 || 1);
  const barW = Math.min(26, step * 0.55);

  svg.innerHTML = byDay
    .map((d, i) => {
      const h = (d.count / max) * (H - 14);
      const x = pad + i * step - barW / 2;
      const y = H - 4 - h;
      const mid = (x + barW / 2).toFixed(1);
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(
        d.count > 0 ? 3 : 0,
        h
      ).toFixed(1)}" rx="3" fill="${d.count > 0 ? 'var(--green)' : 'rgba(255,255,255,0.08)'}"><title>${
        d.date
      }: ${d.count} clicks</title></rect>
      <text x="${mid}" y="${(y - 3).toFixed(1)}" fill="#7c8ba1" font-size="9" text-anchor="middle">${
        d.count || ''
      }</text>`;
    })
    .join('');

  labels.innerHTML = byDay
    .map((d) => {
      const day = d.date.slice(8); // day-of-month
      return `<span>${day}</span>`;
    })
    .join('');
}

function renderInterval(ms: number): void {
  const faster = stepPoll(ms, -1);
  const slower = stepPoll(ms, +1);
  $('intervalValue').textContent = `${ms} ms`;
  const f = $('fasterBtn') as HTMLButtonElement;
  const s = $('slowerBtn') as HTMLButtonElement;
  f.disabled = faster === null;
  s.disabled = slower === null;
  f.textContent = faster !== null ? `Faster → ${faster} ms` : 'Faster';
  s.textContent = slower !== null ? `Slower → ${slower} ms` : 'Slower';
  f.dataset.ms = faster !== null ? String(faster) : '';
  s.dataset.ms = slower !== null ? String(slower) : '';
}

function renderStatus(snap: StatsSnapshot): void {
  const status = $('status');
  if (!snap.windowFound && snap.mode !== 'idle') {
    status.textContent =
      'Cursor or RustDesk window not found — make sure Cursor, or a fullscreen RustDesk session, is visible on screen.';
    status.className = 'status warn';
  } else if (snap.mode !== 'idle' && snap.watchedKind === 'rustdesk') {
    status.textContent = `Watching the RustDesk session… (since ${new Date(snap.since).toLocaleTimeString()})`;
    status.className = 'status';
  } else if (snap.mode !== 'idle') {
    status.textContent = `Watching the Cursor window… (since ${new Date(snap.since).toLocaleTimeString()})`;
    status.className = 'status';
  } else {
    status.textContent = 'Start Auto Run from the tray menu to begin.';
    status.className = 'status';
  }
}

let latestSnapshot: StatsSnapshot | null = null;

function render(snap: StatsSnapshot): void {
  latestSnapshot = snap;
  setText('session', snap.session);
  setText('day', snap.day);
  setText('week', snap.week);
  setText('month', snap.month);
  setText('total', snap.total);
  renderBadge(snap.mode);
  renderSpark(snap.byDay);
  renderInterval(snap.pollIntervalMs);
  renderStatus(snap);
}

$('close').addEventListener('click', () => window.autoRunner.close());
$('fasterBtn').addEventListener('click', () => {
  const ms = Number(($('fasterBtn') as HTMLButtonElement).dataset.ms);
  if (ms) window.autoRunner.setPollInterval(ms);
});
$('slowerBtn').addEventListener('click', () => {
  const ms = Number(($('slowerBtn') as HTMLButtonElement).dataset.ms);
  if (ms) window.autoRunner.setPollInterval(ms);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.autoRunner.close();
});
window.autoRunner.onStats(render);
window.autoRunner.onModeChanged((mode) => {
  renderBadge(mode);
  if (latestSnapshot) {
    latestSnapshot.mode = mode;
    renderStatus(latestSnapshot);
  }
});
window.autoRunner.onDetectionState((state) => {
  if (
    !latestSnapshot ||
    (latestSnapshot.windowFound === state.windowFound && latestSnapshot.watchedKind === state.watchedKind)
  ) {
    return;
  }
  latestSnapshot.windowFound = state.windowFound;
  latestSnapshot.watchedKind = state.watchedKind;
  renderStatus(latestSnapshot);
});
window.autoRunner.getStats().then(render).catch(() => {});

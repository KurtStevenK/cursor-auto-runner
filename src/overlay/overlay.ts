/** Overlay renderer: live stats display. */
import type { StatsSnapshot, Mode } from '../shared/types';

declare global {
  interface Window {
    autoRunner: {
      getStats: () => Promise<StatsSnapshot>;
      setMode: (mode: Mode) => void;
      close: () => void;
      onStats: (cb: (snap: StatsSnapshot) => void) => void;
      onModeChanged: (cb: (mode: Mode) => void) => void;
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

function render(snap: StatsSnapshot): void {
  setText('session', snap.session);
  setText('day', snap.day);
  setText('week', snap.week);
  setText('month', snap.month);
  setText('total', snap.total);
  renderBadge(snap.mode);
  renderSpark(snap.byDay);
  const status = $('status');
  if (!snap.windowFound && snap.mode !== 'idle') {
    status.textContent = 'Cursor window not found — make sure Cursor is visible on screen (not minimized).';
    status.className = 'status warn';
  } else if (snap.mode !== 'idle') {
    status.textContent = `Watching the Cursor window… (since ${new Date(snap.since).toLocaleTimeString()})`;
    status.className = 'status';
  } else {
    status.textContent = 'Start Auto Run from the tray menu to begin.';
    status.className = 'status';
  }
}

$('close').addEventListener('click', () => window.autoRunner.close());
window.autoRunner.onStats(render);
window.autoRunner.onModeChanged((mode) => renderBadge(mode));
window.autoRunner.getStats().then(render).catch(() => {});

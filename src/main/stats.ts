/**
 * Stats store: records every automated click and provides
 * session / day / week / month / total aggregations.
 *
 * Primary backend is SQLite (better-sqlite3). If the native module
 * cannot be loaded, a JSON-lines fallback in userData is used so the
 * app keeps working everywhere.
 */
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DayCount, ClickMode, Mode, StatsSnapshot } from '../shared/types';
import { perfNow, reportStatsDuration } from './perf';

export type { Mode };

interface ClickEvent {
  ts: number;
  mode: ClickMode;
}

interface Statement {
  run: (...args: unknown[]) => void;
  get: (...args: unknown[]) => Record<string, unknown> | undefined;
  all: (...args: unknown[]) => Record<string, unknown>[];
}

export class StatsStore {
  private db: {
    prepare: (sql: string) => Statement;
    close: () => void;
  } | null = null;
  private insertStatement: Statement | null = null;
  private summaryStatement: Statement | null = null;
  private byDayStatement: Statement | null = null;
  private jsonPath: string;
  private events: ClickEvent[] = []; // only used by the JSON fallback
  private sessionStart = Date.now();
  private dirty = false;
  private snapshotCache: { at: number; snapshot: StatsSnapshot } | null = null;

  constructor(private readonly userDataDir = app.getPath('userData')) {
    this.jsonPath = path.join(userDataDir, 'clicks-fallback.json');
    this.init();
  }

  private init(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Database = require('better-sqlite3');
      const db = new Database(path.join(this.userDataDir, 'stats.db'));
      db.exec('CREATE TABLE IF NOT EXISTS clicks (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, mode TEXT NOT NULL)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_clicks_ts ON clicks (ts)');
      this.db = db;
      this.insertStatement = db.prepare('INSERT INTO clicks (ts, mode) VALUES (?, ?)');
      this.summaryStatement = db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM clicks) AS total,
          (SELECT COUNT(*) FROM clicks WHERE ts >= ?) AS session,
          (SELECT COUNT(*) FROM clicks WHERE ts >= ?) AS day,
          (SELECT COUNT(*) FROM clicks WHERE ts >= ?) AS week,
          (SELECT COUNT(*) FROM clicks WHERE ts >= ?) AS month
      `);
      this.byDayStatement = db.prepare(`
        SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch', 'localtime') AS day, COUNT(*) AS count
        FROM clicks
        WHERE ts >= ?
        GROUP BY day
      `);
      console.log('[stats] using SQLite backend');
    } catch (err) {
      console.warn('[stats] better-sqlite3 unavailable, falling back to JSON store:', err);
      try {
        if (fs.existsSync(this.jsonPath)) {
          this.events = JSON.parse(fs.readFileSync(this.jsonPath, 'utf8'));
        }
      } catch (readErr) {
        console.error('[stats] could not read fallback file:', readErr);
        this.events = [];
      }
    }
  }

  record(mode: ClickMode): void {
    const ts = Date.now();
    this.snapshotCache = null;
    if (this.insertStatement) {
      this.insertStatement.run(ts, mode);
    } else {
      this.events.push({ ts, mode });
      this.dirty = true;
      this.flushJsonSoon();
    }
  }

  private flushTimer: NodeJS.Timeout | null = null;
  private flushJsonSoon(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (!this.dirty) return;
      this.dirty = false;
      try {
        fs.writeFileSync(this.jsonPath, JSON.stringify(this.events));
      } catch (err) {
        console.error('[stats] failed to persist fallback store:', err);
      }
    }, 500);
  }

  dispose(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (this.dirty) {
      try {
        fs.writeFileSync(this.jsonPath, JSON.stringify(this.events));
      } catch (error) {
        console.error('[stats] failed to persist fallback store during shutdown:', error);
      }
      this.dirty = false;
    }
    this.db?.close();
    this.db = null;
  }

  // ---- period helpers (local time) ----
  private startOfDay(d = new Date()): number {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  /** ISO week starts on Monday. */
  private startOfWeek(d = new Date()): number {
    const day = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
    return this.startOfDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - day));
  }

  private startOfMonth(d = new Date()): number {
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }

  private dayKey(ts: number): string {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  snapshot(mode: Mode): StatsSnapshot {
    const cached = this.snapshotCache;
    if (cached && Date.now() - cached.at < 1000) {
      return { ...cached.snapshot, mode, byDay: cached.snapshot.byDay.map((day) => ({ ...day })) };
    }
    const startedAt = perfNow();
    const now = Date.now();
    const dayStart = this.startOfDay();
    const weekStart = this.startOfWeek();
    const monthStart = this.startOfMonth();
    const dayStarts: number[] = [];
    const byDay: DayCount[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      dayStarts.push(day.getTime());
      byDay.push({ date: this.dayKey(day.getTime()), count: 0 });
    }

    let session = 0;
    let day = 0;
    let week = 0;
    let month = 0;
    let total = 0;
    if (this.summaryStatement && this.byDayStatement) {
      const summary = this.summaryStatement.get(this.sessionStart, dayStart, weekStart, monthStart);
      session = Number(summary?.session ?? 0);
      day = Number(summary?.day ?? 0);
      week = Number(summary?.week ?? 0);
      month = Number(summary?.month ?? 0);
      total = Number(summary?.total ?? 0);
      const counts = new Map(
        this.byDayStatement
          .all(dayStarts[0])
          .map((row) => [String(row.day), Number(row.count ?? 0)] as const)
      );
      for (const bucket of byDay) bucket.count = counts.get(bucket.date) ?? 0;
    } else {
      for (const event of this.events) {
        total++;
        if (event.ts >= this.sessionStart) session++;
        if (event.ts >= dayStart) day++;
        if (event.ts >= weekStart) week++;
        if (event.ts >= monthStart) month++;
        const bucket = byDay.find((entry) => entry.date === this.dayKey(event.ts));
        if (bucket) bucket.count++;
      }
    }

    const snapshot: StatsSnapshot = {
      session,
      day,
      week,
      month,
      total,
      byDay,
      mode,
      since: new Date(this.sessionStart).toISOString(),
      windowFound: false, // filled in by main from detector state
      watchedKind: null,
      pollIntervalMs: 4000, // filled in by main from the controller
    };
    this.snapshotCache = { at: now, snapshot };
    reportStatsDuration(perfNow() - startedAt);
    return { ...snapshot, byDay: snapshot.byDay.map((bucket) => ({ ...bucket })) };
  }
}

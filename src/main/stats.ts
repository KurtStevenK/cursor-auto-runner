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

export type { Mode };

interface ClickEvent {
  ts: number;
  mode: ClickMode;
}

export class StatsStore {
  private db: {
    prepare: (sql: string) => { run: (...args: unknown[]) => void; get: (...args: unknown[]) => Record<string, unknown> | undefined };
  } | null = null;
  private jsonPath: string;
  private events: ClickEvent[] = []; // only used by the JSON fallback
  private sessionStart = Date.now();
  private dirty = false;

  constructor() {
    this.jsonPath = path.join(app.getPath('userData'), 'clicks-fallback.json');
    this.init();
  }

  private init(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Database = require('better-sqlite3');
      const db = new Database(path.join(app.getPath('userData'), 'stats.db'));
      db.exec('CREATE TABLE IF NOT EXISTS clicks (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, mode TEXT NOT NULL)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_clicks_ts ON clicks (ts)');
      this.db = db;
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
    if (this.db) {
      this.db.prepare('INSERT INTO clicks (ts, mode) VALUES (?, ?)').run(ts, mode);
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

  private countSince(since: number): number {
    if (this.db) {
      const row = this.db.prepare('SELECT COUNT(*) AS c FROM clicks WHERE ts >= ?').get(since);
      return Number(row?.c ?? 0);
    }
    return this.events.filter((e) => e.ts >= since).length;
  }

  snapshot(mode: Mode): StatsSnapshot {
    const now = Date.now();
    const total = this.countSince(0);
    const byDay: DayCount[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = this.startOfDay(new Date(now - i * 86400000));
      const dayEnd = dayStart + 86400000;
      let count: number;
      if (this.db) {
        const row = this.db.prepare('SELECT COUNT(*) AS c FROM clicks WHERE ts >= ? AND ts < ?').get(dayStart, dayEnd);
        count = Number(row?.c ?? 0);
      } else {
        count = this.events.filter((e) => e.ts >= dayStart && e.ts < dayEnd).length;
      }
      byDay.push({ date: this.dayKey(dayStart), count });
    }
    return {
      session: this.countSince(this.sessionStart),
      day: this.countSince(this.startOfDay()),
      week: this.countSince(this.startOfWeek()),
      month: this.countSince(this.startOfMonth()),
      total,
      byDay,
      mode,
      since: new Date(this.sessionStart).toISOString(),
      windowFound: false, // filled in by main from detector state
      pollIntervalMs: 4000, // filled in by main from the controller
    };
  }
}

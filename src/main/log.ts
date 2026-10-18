import * as fs from 'fs';
import * as path from 'path';
import { format } from 'util';

const MAX_BYTES = 2 * 1024 * 1024;
const FILE_NAME = 'cursor-auto-runner.log';
const LEVELS = ['log', 'info', 'warn', 'error', 'debug'] as const;
type Level = (typeof LEVELS)[number];

let logDir = '';
let stream: fs.WriteStream | null = null;
let size = 0;
let originals: Partial<Record<Level, (...args: unknown[]) => void>> | null = null;
let onException: ((err: Error) => void) | null = null;
let onRejection: ((reason: unknown) => void) | null = null;

export function logDirectory(): string {
  return logDir;
}

export function logFilePath(): string {
  return path.join(logDir, FILE_NAME);
}

function closeStream(): void {
  try {
    stream?.end();
  } catch {
    /* ignore */
  }
  stream = null;
}

function rotate(): void {
  closeStream();
  try {
    fs.renameSync(logFilePath(), path.join(logDir, FILE_NAME.replace(/\.log$/, '.1.log')));
  } catch {
    /* ignore */
  }
  size = 0;
}

function openStream(): fs.WriteStream | null {
  if (stream) return stream;
  try {
    fs.mkdirSync(logDir, { recursive: true });
    try {
      size = fs.statSync(logFilePath()).size;
    } catch {
      size = 0;
    }
    if (size > MAX_BYTES) rotate();
    stream = fs.createWriteStream(logFilePath(), { flags: 'a' });
    stream.on('error', () => {
      stream = null;
    });
    return stream;
  } catch {
    stream = null;
    return null;
  }
}

function append(level: Level, args: unknown[]): void {
  try {
    const line = `${new Date().toISOString()} ${level === 'log' ? 'INFO' : level.toUpperCase()} ${format(...args)}\n`;
    const s = openStream();
    if (!s) return;
    s.write(line);
    size += Buffer.byteLength(line);
    if (size > MAX_BYTES) rotate();
  } catch {
    /* never throw from console */
  }
}

export function installFileLogger(dir: string): void {
  if (originals) uninstallFileLogger();
  logDir = dir;
  originals = {};
  for (const level of LEVELS) {
    const orig = console[level].bind(console) as (...args: unknown[]) => void;
    originals[level] = console[level] as (...args: unknown[]) => void;
    console[level] = (...args: unknown[]) => {
      try {
        orig(...args);
      } catch {
        /* ignore */
      }
      append(level, args);
    };
  }
  onException = (err) => {
    console.error('uncaughtException:', err?.stack ? err.stack : err);
  };
  onRejection = (reason) => {
    console.error(
      'unhandledRejection:',
      reason instanceof Error && reason.stack ? reason.stack : reason
    );
  };
  process.on('uncaughtException', onException);
  process.on('unhandledRejection', onRejection);
}

export function uninstallFileLogger(): void {
  if (originals) {
    for (const level of LEVELS) {
      const o = originals[level];
      if (o) console[level] = o;
    }
    originals = null;
  }
  if (onException) process.off('uncaughtException', onException);
  if (onRejection) process.off('unhandledRejection', onRejection);
  onException = null;
  onRejection = null;
  closeStream();
}

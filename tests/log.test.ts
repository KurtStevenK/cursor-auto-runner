import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { installFileLogger, uninstallFileLogger, logFilePath, logDirectory } from '../src/main/log';

test('file logger appends timestamped level lines', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'car-log-'));
  const origWarn = console.warn;
  const origLog = console.log;
  console.log = () => {};
  console.warn = () => {};
  installFileLogger(dir);
  try {
    console.warn('disk %s almost full', 'C:');
    assert.equal(logDirectory(), dir);
    await new Promise((r) => setTimeout(r, 100));
    const text = fs.readFileSync(logFilePath(), 'utf8');
    assert.match(text, /^\d{4}-\d\d-\d\dT[\d:.]+Z WARN disk C: almost full$/m);
  } finally {
    uninstallFileLogger();
    console.warn = origWarn;
    console.log = origLog;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

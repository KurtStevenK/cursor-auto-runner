import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SettingsStore, sanitizeSettings } from '../src/main/settings';
import { DEFAULT_SETTINGS } from '../src/shared/types';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'car-settings-'));

test('defaults when no file exists', () => {
  assert.deepEqual(new SettingsStore(tmp()).get(), DEFAULT_SETTINGS);
});

test('corrupt JSON falls back to defaults', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'settings.json'), '{not json');
  assert.deepEqual(new SettingsStore(dir).get(), DEFAULT_SETTINGS);
});

test('out-of-range and invalid values are clamped or defaulted', () => {
  const s = sanitizeSettings({
    pollIntervalMs: 5,
    confidence: 5,
    cooldownMs: -10,
    restoreLastMode: 'yes',
    installUpdatesWithHomebrew: 0,
    lastMode: 'bogus',
    extra: 1,
  });
  assert.equal(s.pollIntervalMs, 150);
  assert.equal(s.confidence, 0.99);
  assert.equal(s.cooldownMs, 0);
  assert.equal(s.restoreLastMode, DEFAULT_SETTINGS.restoreLastMode);
  assert.equal(s.installUpdatesWithHomebrew, DEFAULT_SETTINGS.installUpdatesWithHomebrew);
  assert.equal(s.lastMode, 'idle');
  assert.equal('extra' in s, false);
  assert.equal(sanitizeSettings({ pollIntervalMs: 1e9 }).pollIntervalMs, 60000);
  assert.equal(sanitizeSettings({ pollIntervalMs: NaN }).pollIntervalMs, DEFAULT_SETTINGS.pollIntervalMs);
  assert.equal(sanitizeSettings({ confidence: 0.1 }).confidence, 0.5);
  assert.deepEqual(sanitizeSettings(null), DEFAULT_SETTINGS);
});

test('set() persists sanitized values and a new store re-reads them', () => {
  const dir = tmp();
  const store = new SettingsStore(dir);
  store.set({ pollIntervalMs: 1000, lastMode: 'run', confidence: 2 });
  assert.equal(store.get().confidence, 0.99);
  const again = new SettingsStore(dir).get();
  assert.equal(again.pollIntervalMs, 1000);
  assert.equal(again.lastMode, 'run');
  assert.equal(fs.existsSync(path.join(dir, 'settings.json.tmp')), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SettingsStore, sanitizeSettings, sanitizeOverlayBounds, boundsIntersectDisplays } from '../src/main/settings';
import { DEFAULT_SETTINGS, nextToggleMode } from '../src/shared/types';

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

test('launchAtLogin defaults to false and only accepts booleans', () => {
  assert.equal(DEFAULT_SETTINGS.launchAtLogin, false);
  assert.equal(sanitizeSettings({ launchAtLogin: true }).launchAtLogin, true);
  assert.equal(sanitizeSettings({ launchAtLogin: 'yes' }).launchAtLogin, false);
});

test('toggleShortcut only accepts the offered accelerators', () => {
  assert.equal(DEFAULT_SETTINGS.toggleShortcut, '');
  assert.equal(sanitizeSettings({ toggleShortcut: 'CommandOrControl+Alt+R' }).toggleShortcut, 'CommandOrControl+Alt+R');
  assert.equal(sanitizeSettings({ toggleShortcut: 'Ctrl+Q' }).toggleShortcut, '');
  assert.equal(sanitizeSettings({ toggleShortcut: 5 }).toggleShortcut, '');
});

test('nextToggleMode toggles between idle and the last active mode', () => {
  assert.equal(nextToggleMode('run', 'run'), 'idle');
  assert.equal(nextToggleMode('always-run', 'always-run'), 'idle');
  assert.equal(nextToggleMode('idle', 'always-run'), 'always-run');
  assert.equal(nextToggleMode('idle', 'idle'), 'run');
});

test('overlayAlwaysOnTop defaults to true and only accepts booleans', () => {
  assert.equal(DEFAULT_SETTINGS.overlayAlwaysOnTop, true);
  assert.equal(sanitizeSettings({ overlayAlwaysOnTop: false }).overlayAlwaysOnTop, false);
  assert.equal(sanitizeSettings({ overlayAlwaysOnTop: 0 }).overlayAlwaysOnTop, true);
});

test('overlayBounds are sanitized to finite integers at or above the minimum size', () => {
  assert.deepEqual(sanitizeOverlayBounds({ x: 10.4, y: -20, width: 400.6, height: 560 }), {
    x: 10,
    y: -20,
    width: 401,
    height: 560,
  });
  assert.equal(sanitizeOverlayBounds({ x: 0, y: 0, width: 300, height: 560 }), undefined);
  assert.equal(sanitizeOverlayBounds({ x: 0, y: 0, width: 400, height: 100 }), undefined);
  assert.equal(sanitizeOverlayBounds({ x: NaN, y: 0, width: 400, height: 560 }), undefined);
  assert.equal(sanitizeOverlayBounds({ x: '1', y: 0, width: 400, height: 560 }), undefined);
  assert.equal(sanitizeOverlayBounds(null), undefined);
  assert.equal(sanitizeSettings({ overlayBounds: { x: 1, y: 2, width: 10, height: 10 } }).overlayBounds, undefined);
  assert.deepEqual(sanitizeSettings({ overlayBounds: { x: 1, y: 2, width: 400, height: 560 } }).overlayBounds, {
    x: 1,
    y: 2,
    width: 400,
    height: 560,
  });
});

test('boundsIntersectDisplays rejects windows left on a disconnected display', () => {
  const displays = [{ x: 0, y: 0, width: 1920, height: 1080 }];
  assert.equal(boundsIntersectDisplays({ x: 100, y: 100, width: 400, height: 560 }, displays), true);
  assert.equal(boundsIntersectDisplays({ x: 2500, y: 100, width: 400, height: 560 }, displays), false);
  assert.equal(boundsIntersectDisplays({ x: 1900, y: 100, width: 400, height: 560 }, displays), false);
});

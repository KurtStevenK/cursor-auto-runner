import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatMacPermissionDialogDetail,
  type MacPermissionSnapshot,
} from '../src/main/mac-permission-detail';

describe('formatMacPermissionDialogDetail', () => {
  it('lists missing screen and accessibility with API hints', () => {
    const snapshot: MacPermissionSnapshot = {
      screenOk: false,
      accessOk: false,
      electronScreenStatus: 'denied',
      macPermScreen: 'authorized',
      macPermAccessibility: 'not determined',
      electronAccessibility: false,
    };
    const detail = formatMacPermissionDialogDetail(snapshot);
    assert.match(detail, /Screen Recording/);
    assert.match(detail, /Accessibility/);
    assert.match(detail, /Remove it from both permission lists/);
    assert.match(detail, /What to do: click the matching "Open" button/);
    // Diagnostics come last, behind a single labelled line.
    const tech = detail.indexOf('Technical details:');
    assert.ok(tech > detail.indexOf('Remove it from both permission lists'));
    assert.match(detail.slice(tech), /Electron: denied, system: authorized/);
    assert.doesNotMatch(detail.slice(0, tech), /Electron:/);
  });

  it('omits missing list when both checks pass', () => {
    const snapshot: MacPermissionSnapshot = {
      screenOk: true,
      accessOk: true,
      electronScreenStatus: 'granted',
      macPermScreen: 'authorized',
      macPermAccessibility: 'authorized',
      electronAccessibility: true,
    };
    const detail = formatMacPermissionDialogDetail(snapshot);
    assert.doesNotMatch(detail, /Missing:/);
  });
});

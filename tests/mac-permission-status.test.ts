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
    assert.doesNotMatch(detail, /Still missing/);
  });
});

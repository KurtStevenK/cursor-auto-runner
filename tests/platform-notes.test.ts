import test from 'node:test';
import assert from 'node:assert/strict';
import { isWaylandSession } from '../src/main/platform-notes';

test('isWaylandSession detects XDG_SESSION_TYPE=wayland', () => {
  assert.equal(isWaylandSession({ XDG_SESSION_TYPE: 'wayland' }), true);
  assert.equal(isWaylandSession({ XDG_SESSION_TYPE: 'Wayland', DISPLAY: ':0' }), true);
  assert.equal(isWaylandSession({ XDG_SESSION_TYPE: 'x11' }), false);
});

test('isWaylandSession falls back to WAYLAND_DISPLAY without DISPLAY', () => {
  assert.equal(isWaylandSession({ WAYLAND_DISPLAY: 'wayland-0' }), true);
  assert.equal(isWaylandSession({ WAYLAND_DISPLAY: 'wayland-0', DISPLAY: ':0' }), false);
  assert.equal(isWaylandSession({}), false);
});

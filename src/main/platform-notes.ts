/** Platform checks that are testable without Electron. */

/** True for a Wayland session (XDG_SESSION_TYPE, or WAYLAND_DISPLAY set without DISPLAY). */
export function isWaylandSession(env: NodeJS.ProcessEnv = process.env): boolean {
  if ((env.XDG_SESSION_TYPE ?? '').toLowerCase() === 'wayland') return true;
  return Boolean(env.WAYLAND_DISPLAY) && !env.DISPLAY;
}

export const WAYLAND_NOTICE =
  'You are running a Wayland session. Synthetic clicks and screen capture may be restricted (the compositor can ask for permission or block them). An X11 or XWayland session is recommended for Cursor Auto Runner.';

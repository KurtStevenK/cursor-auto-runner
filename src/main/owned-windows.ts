/**
 * macOS window titles are the document ("CHANGELOG.md — FeatherShot"), not
 * "Cursor". System Events reports which app owns each window.
 */
import { execFile } from 'node:child_process';
import type { WindowRect } from './watch-windows';

export interface OwnedWindow extends WindowRect {
  owner: string;
}

const OWNER_TTL_MS = 2500;
const SCRIPT = `
tell application "System Events"
  set sep to ASCII character 31
  set nl to ASCII character 10
  set out to ""
  repeat with procName in {"Cursor", "RustDesk"}
    if exists process (procName as text) then
      tell process (procName as text)
        repeat with w in windows
          try
            set p to position of w
            set s to size of w
            set out to out & procName & sep & (name of w as text) & sep & (item 1 of p as text) & sep & (item 2 of p as text) & sep & (item 1 of s as text) & sep & (item 2 of s as text) & nl
          end try
        end repeat
      end tell
    end if
  end repeat
  return out
end tell
`;

let cache: { at: number; windows: OwnedWindow[] } | null = null;

/** Parse tab-separated owner rows. Unit-separator (ASCII 31) splits fields. */
export function parseOwnedWindowList(text: string): OwnedWindow[] {
  const windows: OwnedWindow[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [owner, title, left, top, width, height] = trimmed.split('\u001f');
    const rect = [left, top, width, height].map((value) => Number(value));
    if (!owner || !title || rect.some((value) => !Number.isFinite(value))) continue;
    windows.push({
      owner,
      title,
      left: rect[0],
      top: rect[1],
      width: rect[2],
      height: rect[3],
    });
  }
  return windows;
}

/** Match a nut-js window to the app that owns the same title and origin. */
export function ownerForWindow(window: WindowRect, owned: OwnedWindow[]): string | null {
  const sameTitle = owned.filter((item) => item.title === window.title);
  if (sameTitle.length === 0) return null;
  const near = sameTitle.filter(
    (item) => Math.abs(item.left - window.left) <= 12 && Math.abs(item.top - window.top) <= 12
  );
  const pool = near.length > 0 ? near : sameTitle.length === 1 ? sameTitle : [];
  return pool[0]?.owner ?? null;
}

export async function listOwnedWindows(force = false): Promise<OwnedWindow[]> {
  if (process.platform !== 'darwin') return [];
  const now = Date.now();
  if (!force && cache && now - cache.at < OWNER_TTL_MS) return cache.windows;
  // A miss in the same pass already refreshed the list. Don't launch osascript twice.
  if (force && cache && now - cache.at < 400) return cache.windows;
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', SCRIPT], {
      timeout: 4000,
      maxBuffer: 1024 * 1024,
    });
    const windows = parseOwnedWindowList(stdout);
    cache = { at: Date.now(), windows };
    return windows;
  } catch (error) {
    console.error('[detector] app-window lookup failed:', error);
    return cache?.windows ?? [];
  }
}

function execFileAsync(
  command: string,
  args: string[],
  options: { timeout: number; maxBuffer: number }
): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { ...options, encoding: 'utf8' }, (error, stdout) => {
      if (error) reject(error);
      else resolve({ stdout: String(stdout) });
    });
  });
}

/**
 * Clicker: moves the mouse to the detected button, clicks, and restores
 * the cursor position. Clicks happen at absolute virtual-desktop
 * coordinates so they work on whichever monitor Cursor currently is.
 */
import { mouse, Button, Point } from '@nut-tree-fork/nut-js';

mouse.config.autoDelayMs = 0;
mouse.config.mouseSpeed = 3000; // near-instant move
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function clickAt(x: number, y: number): Promise<void> {
  const previous = await mouse.getPosition();
  await mouse.setPosition(new Point(x, y));
  await sleep(40); // let the UI register hover state
  await mouse.click(Button.LEFT);
  await sleep(60);
  // Restore the cursor so the automation never disturbs the user's pointer.
  await mouse.setPosition(previous);
}

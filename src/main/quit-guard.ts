/**
 * Makes the first `before-quit` run async cleanup, then quits.
 *
 * The first call prevents the quit, runs `cleanup` and then calls `requestQuit`
 * (normally `() => app.quit()`). Later calls, including the re-entrant
 * `before-quit` that `app.quit()` emits, let the quit proceed untouched.
 * This keeps `autoUpdater.quitAndInstall()` working: it relies on the quit
 * completing, so a stuck cleanup must never block it. If `cleanup` has not
 * settled after `timeoutMs`, `requestQuit` is still called.
 */
export const QUIT_CLEANUP_TIMEOUT_MS = 5_000;

export function createQuitGuard(
  cleanup: () => Promise<void> | void,
  requestQuit: () => void,
  timeoutMs: number = QUIT_CLEANUP_TIMEOUT_MS
): (event: { preventDefault(): void }) => void {
  let started = false;
  return (event) => {
    if (started) return;
    started = true;
    event.preventDefault();

    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      if (timer !== undefined) clearTimeout(timer);
      requestQuit();
    };

    timer = setTimeout(() => {
      console.error(`[quit] cleanup did not finish within ${timeoutMs} ms; quitting anyway`);
      finish();
    }, timeoutMs);

    // Run cleanup synchronously up to its first await, as the handler always did.
    let pending: Promise<void>;
    try {
      pending = Promise.resolve(cleanup());
    } catch (err) {
      pending = Promise.reject(err);
    }
    void pending
      .then(
        () => undefined,
        (err: unknown) => {
          console.error('[quit] cleanup failed:', err);
        }
      )
      .then(finish);
  };
}

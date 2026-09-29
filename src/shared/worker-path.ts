import * as path from 'node:path';

export function resolveMatchWorkerPath(mainDirectory: string, packaged: boolean): string {
  const compiled = path.join(mainDirectory, '..', 'worker', 'match-worker.js');
  if (!packaged) return compiled;
  return compiled.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
}

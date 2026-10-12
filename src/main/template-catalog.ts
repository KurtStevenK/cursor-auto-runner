/** How many reference images to keep for one button and theme. */
export const MAX_BUNDLED_TEMPLATES_PER_GROUP = 3;
export const MAX_USER_TEMPLATES_PER_GROUP = 2;

export interface CatalogFile {
  file: string;
  source: 'bundled' | 'user';
  mtimeMs: number;
}

/**
 * Bundled references stay in filename order. Local captures are newest first
 * so a later button screenshot is not dropped behind an older `run-2.png`.
 */
export function orderCatalogFiles<T extends CatalogFile>(files: T[]): T[] {
  const bundled = files
    .filter((file) => file.source === 'bundled')
    .sort((left, right) => left.file.localeCompare(right.file, undefined, { numeric: true }));
  const user = files
    .filter((file) => file.source === 'user')
    .sort(
      (left, right) =>
        right.mtimeMs - left.mtimeMs ||
        left.file.localeCompare(right.file, undefined, { numeric: true })
    );
  return [...bundled, ...user];
}

export function selectCatalogGroup<T extends CatalogFile>(
  files: T[],
  accept: (file: T) => boolean
): { selected: T[]; skippedForCap: number } {
  const selected: T[] = [];
  let bundled = 0;
  let user = 0;
  let skippedForCap = 0;
  for (const file of orderCatalogFiles(files)) {
    const open =
      file.source === 'bundled'
        ? bundled < MAX_BUNDLED_TEMPLATES_PER_GROUP
        : user < MAX_USER_TEMPLATES_PER_GROUP;
    if (!open) {
      skippedForCap++;
      continue;
    }
    if (!accept(file)) continue;
    selected.push(file);
    if (file.source === 'bundled') bundled++;
    else user++;
  }
  return { selected, skippedForCap };
}

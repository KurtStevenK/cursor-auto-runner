/** Builds the deduplicated, capped template catalog (pure given dirs + an image loader). */
import * as path from 'node:path';
import * as fs from 'node:fs';
import type { TemplatePayload } from '../../shared/match-protocol';
import type { ClickMode } from '../../shared/types';
import {
  fingerprintDistance,
  type GrayImage,
  templateFingerprint,
  validateTemplateDimensions,
} from '../matcher';
import { selectCatalogGroup, type CatalogFile } from '../template-catalog';

export type LoadImage = (file: string) => Promise<GrayImage>;

export interface TemplateCatalog {
  payloads: TemplatePayload[];
  duplicates: number;
  rejected: number;
  limited: number;
}

interface LoadedFingerprint {
  mode: ClickMode;
  theme: 'dark' | 'light';
  fingerprint: Uint8Array;
}

interface LoadedCatalogFile extends CatalogFile {
  mode: 'always-run' | 'run' | 'allow';
  theme: 'dark' | 'light';
  image?: GrayImage;
}

/** `dirs[0]` is the bundled directory; the rest are user capture directories. */
export async function loadTemplateCatalog(
  dirs: string[],
  loadImage: LoadImage
): Promise<TemplateCatalog> {
  const payloads: TemplatePayload[] = [];
  const fingerprints: LoadedFingerprint[] = [];
  let duplicates = 0;
  let rejected = 0;
  let limited = 0;
  const bundledDir = dirs[0];

  const grouped = new Map<string, LoadedCatalogFile[]>();
  for (const dir of dirs) {
    const source: CatalogFile['source'] = dir === bundledDir ? 'bundled' : 'user';
    for (const theme of ['dark', 'light'] as const) {
      const themeDir = path.join(dir, theme);
      if (!fs.existsSync(themeDir)) continue;
      const names = fs.readdirSync(themeDir).filter((file) => file.toLowerCase().endsWith('.png'));
      for (const mode of ['always-run', 'run', 'allow'] as const) {
        const matching = names.filter(
          (file) => file === `${mode}.png` || file.startsWith(`${mode}-`)
        );
        const group = `${mode}:${theme}`;
        const bucket = grouped.get(group) ?? [];
        for (const fileName of matching) {
          const file = path.join(themeDir, fileName);
          let mtimeMs = 0;
          try {
            mtimeMs = fs.statSync(file).mtimeMs;
          } catch {
            // keep the default of 0 when the file cannot be stat'ed
          }
          bucket.push({ file, source, mtimeMs, mode, theme });
        }
        grouped.set(group, bucket);
      }
    }
  }

  for (const files of grouped.values()) {
    for (const candidate of files) {
      try {
        candidate.image = await loadImage(candidate.file);
      } catch (error) {
        rejected++;
        console.error(`[detector] failed to load template ${candidate.file}:`, error);
      }
    }
    const { selected, skippedForCap } = selectCatalogGroup(files, (candidate) => {
      const image = candidate.image;
      if (!image) return false;
      const validation = validateTemplateDimensions(image.width, image.height);
      if (!validation.valid) {
        rejected++;
        console.warn(`[detector] skipped ${candidate.file}: ${validation.reason}`);
        return false;
      }
      const fingerprint = templateFingerprint(image);
      const duplicate = fingerprints.some(
        (entry) =>
          entry.mode === candidate.mode &&
          entry.theme === candidate.theme &&
          fingerprintDistance(entry.fingerprint, fingerprint) <= 8
      );
      if (duplicate) {
        duplicates++;
        return false;
      }
      fingerprints.push({ mode: candidate.mode, theme: candidate.theme, fingerprint });
      return true;
    });
    limited += skippedForCap;
    for (const candidate of selected) {
      const image = candidate.image;
      if (!image) continue;
      const data = image.data.buffer.slice(
        image.data.byteOffset,
        image.data.byteOffset + image.data.byteLength
      ) as ArrayBuffer;
      payloads.push({
        file: candidate.file,
        mode: candidate.mode,
        theme: candidate.theme,
        width: image.width,
        height: image.height,
        data,
      });
    }
  }

  return { payloads, duplicates, rejected, limited };
}

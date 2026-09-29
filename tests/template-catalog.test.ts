import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  fingerprintDistance,
  GrayImage,
  loadTemplate,
  templateFingerprint,
  validateTemplateDimensions,
} from '../src/main/matcher';

function image(width: number, height: number): GrayImage {
  const data = new Float32Array(width * height);
  for (let i = 0; i < data.length; i++) data[i] = (i * 29 + 17) % 255;
  return { width, height, data };
}

test('template validation rejects dynamic command-width captures', () => {
  assert.equal(validateTemplateDimensions(77, 24).valid, true);
  assert.equal(validateTemplateDimensions(180, 24).valid, false);
  assert.match(validateTemplateDimensions(180, 24).reason ?? '', /wide|command/i);
});

test('template validation rejects unsafe dimensions', () => {
  assert.equal(validateTemplateDimensions(5, 5).valid, false);
  assert.equal(validateTemplateDimensions(600, 40).valid, false);
  assert.equal(validateTemplateDimensions(80, 24).valid, true);
});

test('fingerprints make exact duplicate detection deterministic', () => {
  const first = image(80, 24);
  const second: GrayImage = { ...first, data: new Float32Array(first.data) };
  const changed: GrayImage = { ...first, data: new Float32Array(first.data) };
  changed.data.fill(255, 0, Math.floor(changed.data.length / 2));

  assert.equal(fingerprintDistance(templateFingerprint(first), templateFingerprint(second)), 0);
  assert.ok(fingerprintDistance(templateFingerprint(first), templateFingerprint(changed)) > 8);
});

test('bundled catalog stays small, valid, and complementary', async () => {
  const templateDir = path.join(process.cwd(), 'assets', 'templates', 'dark');
  const files = fs.readdirSync(templateDir).filter((file) => file.endsWith('.png'));

  for (const mode of ['run', 'always-run', 'allow'] as const) {
    const matching = files
      .filter((file) => file === `${mode}.png` || file === `${mode}-2.png`)
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    assert.ok(matching.length >= 1, `${mode} needs a bundled fallback`);

    const images = await Promise.all(matching.map((file) => loadTemplate(path.join(templateDir, file))));
    for (const entry of images) {
      assert.equal(validateTemplateDimensions(entry.width, entry.height).valid, true);
    }

    const uniqueFingerprints: Uint8Array[] = [];
    for (const entry of images) {
      const fingerprint = templateFingerprint(entry);
      if (
        uniqueFingerprints.every(
          (accepted) => fingerprintDistance(accepted, fingerprint) > 8
        )
      ) {
        uniqueFingerprints.push(fingerprint);
      }
    }
    assert.equal(
      uniqueFingerprints.length,
      matching.length,
      `${mode} references must not be perceptual duplicates`
    );
    assert.ok(uniqueFingerprints.length <= 2, `${mode} catalog must remain bounded`);
  }
});

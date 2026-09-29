import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { loadTemplate } from '../src/main/matcher';
import {
  evaluatePreparedMatch,
  findBestPreparedMatch,
  GrayImage,
  orderTemplatesForMode,
  prepareHaystack,
  prepareTemplateVariants,
  TemplateInput,
} from '../src/worker/matcher-core';

function patterned(width: number, height: number, offset = 0): GrayImage {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = (x * 31 + y * 17 + x * y * 3 + offset) % 255;
    }
  }
  return { width, height, data };
}

function input(mode: TemplateInput['mode'], offset: number): TemplateInput {
  const image = patterned(8, 8, offset);
  return { file: `${mode}.png`, mode, theme: 'dark', ...image };
}

function noisyHaystack(width: number, height: number): GrayImage {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data[y * width + x] = 14 + ((x * 7 + y * 11) % 32);
  }
  return { width, height, data };
}

function paste(haystack: GrayImage, image: GrayImage, x: number, y: number): void {
  for (let row = 0; row < image.height; row++) {
    haystack.data.set(
      image.data.subarray(row * image.width, (row + 1) * image.width),
      (y + row) * haystack.width + x
    );
  }
}

test('run mode excludes always-run variants instead of ranking them first', () => {
  const variants = prepareTemplateVariants([
    input('always-run', 1),
    input('run', 2),
    input('allow', 3),
  ]);
  const ordered = orderTemplatesForMode(variants, 'run');

  assert.equal(ordered.some((template) => template.mode === 'always-run'), false);
  assert.equal(ordered[0].mode, 'run');
  assert.equal(ordered.filter((template) => template.mode === 'run').length, 7);
  assert.equal(ordered.filter((template) => template.mode === 'allow').length, 7);
});

test('always-run mode preserves always-run, run, allow priority', () => {
  const variants = prepareTemplateVariants([
    input('allow', 3),
    input('run', 2),
    input('always-run', 1),
  ]);
  const ordered = orderTemplatesForMode(variants, 'always-run');

  assert.equal(ordered[0].mode, 'always-run');
  assert.ok(ordered.findIndex((template) => template.mode === 'run') > 0);
  assert.ok(
    ordered.findIndex((template) => template.mode === 'allow') >
      ordered.findIndex((template) => template.mode === 'run')
  );
});

test('prepared matcher locates an exact synthetic template', () => {
  const templateImage = patterned(8, 8, 11);
  const haystack = patterned(48, 36, 91);
  const expected = { x: 17, y: 13 };
  for (let y = 0; y < templateImage.height; y++) {
    for (let x = 0; x < templateImage.width; x++) {
      haystack.data[(expected.y + y) * haystack.width + expected.x + x] =
        templateImage.data[y * templateImage.width + x];
    }
  }
  const template = prepareTemplateVariants([
    { file: 'run.png', mode: 'run', theme: 'dark', ...templateImage },
  ])[0];
  const match = findBestPreparedMatch(prepareHaystack(haystack), template, 0.99);

  assert.ok(match);
  assert.equal(match.x, expected.x);
  assert.equal(match.y, expected.y);
  assert.ok(match.score >= 0.99);
});

test('prepared matcher observes cancellation', () => {
  const template = prepareTemplateVariants([input('run', 2)])[0];
  const match = findBestPreparedMatch(prepareHaystack(patterned(64, 64, 10)), template, 0.88, () => true);
  assert.equal(match, null);
});

test('NCC remains invariant to a legitimate brightness shift', () => {
  const templateImage = patterned(10, 8, 3);
  for (let i = 0; i < templateImage.data.length; i++) templateImage.data[i] = 20 + (templateImage.data[i] % 100);
  const haystack: GrayImage = { width: 60, height: 40, data: new Float32Array(60 * 40).fill(12) };
  const expected = { x: 23, y: 17 };
  for (let y = 0; y < templateImage.height; y++) {
    for (let x = 0; x < templateImage.width; x++) {
      haystack.data[(expected.y + y) * haystack.width + expected.x + x] =
        templateImage.data[y * templateImage.width + x] + 80;
    }
  }
  const template = prepareTemplateVariants([
    { file: 'run.png', mode: 'run', theme: 'dark', ...templateImage },
  ])[0];
  const match = findBestPreparedMatch(prepareHaystack(haystack), template, 0.99);

  assert.ok(match);
  assert.equal(match.x, expected.x);
  assert.equal(match.y, expected.y);
});

test('coarse scan refines a template placed at an odd coordinate', () => {
  const templateImage = patterned(24, 16, 7);
  const haystack: GrayImage = {
    width: 820,
    height: 460,
    data: new Float32Array(820 * 460).fill(12),
  };
  const expected = { x: 125, y: 77 };
  for (let y = 0; y < templateImage.height; y++) {
    for (let x = 0; x < templateImage.width; x++) {
      haystack.data[(expected.y + y) * haystack.width + expected.x + x] =
        templateImage.data[y * templateImage.width + x];
    }
  }
  const template = prepareTemplateVariants([
    { file: 'run.png', mode: 'run', theme: 'dark', ...templateImage },
  ])[0];
  const evaluation = evaluatePreparedMatch(prepareHaystack(haystack), template, 0.95);
  const match = evaluation.match;

  assert.ok(match);
  assert.ok(Math.abs(match.x - expected.x) <= 1);
  assert.ok(Math.abs(match.y - expected.y) <= 1);
  assert.equal(evaluation.pyramid, 'half');
  assert.equal(evaluation.phaseCount, 4);
  assert.ok(evaluation.candidateCount > 0);
});

test('multiple coarse candidates recover a real match behind an aligned distractor', () => {
  const templateImage = patterned(24, 16, 7);
  const haystack: GrayImage = {
    width: 820,
    height: 460,
    data: new Float32Array(820 * 460).fill(12),
  };
  const expected = { x: 125, y: 77 };
  for (let y = 0; y < templateImage.height; y++) {
    for (let x = 0; x < templateImage.width; x++) {
      haystack.data[(expected.y + y) * haystack.width + expected.x + x] =
        templateImage.data[y * templateImage.width + x];
    }
  }

  // This aligned patch is identical at the 4x coarse sampling points but
  // intentionally wrong at full resolution. A single coarse winner stops here.
  const distractor = { x: 400, y: 240 };
  for (let y = 0; y < templateImage.height; y++) {
    for (let x = 0; x < templateImage.width; x++) {
      const sampled = [1, 2].includes(x % 4) && [1, 2].includes(y % 4);
      const value = templateImage.data[y * templateImage.width + x];
      haystack.data[(distractor.y + y) * haystack.width + distractor.x + x] =
        sampled ? value : 255 - value;
    }
  }

  const template = prepareTemplateVariants([
    { file: 'run.png', mode: 'run', theme: 'dark', ...templateImage },
  ])[0];
  const evaluation = evaluatePreparedMatch(prepareHaystack(haystack), template, 0.95);

  assert.ok(evaluation.match);
  assert.equal(evaluation.match.x, expected.x);
  assert.equal(evaluation.match.y, expected.y);
  assert.equal(evaluation.match.score, 1);
  assert.equal(evaluation.pyramid, 'half');
  assert.equal(evaluation.phaseCount, 4);
  assert.ok(evaluation.candidateCount > 1);
});

const realTemplateCases = [
  {
    mode: 'run' as const,
    template: 'run-2.png',
    cappedFixture: 'run-capped.png',
    expected: { x: 901, y: 361 },
  },
  {
    mode: 'always-run' as const,
    template: 'always-run-2.png',
    cappedFixture: 'always-run-capped.png',
    expected: { x: 824, y: 361 },
  },
  {
    mode: 'allow' as const,
    template: 'allow.png',
    cappedFixture: 'allow-capped.png',
    expected: { x: 862, y: 438 },
  },
];

for (const fixture of realTemplateCases) {
  test(`bundled ${fixture.mode} template matches native and capped golden pixels`, async () => {
    const templateImage = await loadTemplate(
      path.join(process.cwd(), 'assets', 'templates', 'dark', fixture.template)
    );
    const cappedImage = await loadTemplate(
      path.join(process.cwd(), 'tests', 'fixtures', fixture.cappedFixture)
    );

    const nativeHaystack = noisyHaystack(1024, 576);
    const nativeExpected = { x: 735, y: 285 };
    paste(nativeHaystack, templateImage, nativeExpected.x, nativeExpected.y);
    const nativeTemplate = prepareTemplateVariants([
      {
        file: fixture.template,
        mode: fixture.mode,
        theme: 'dark',
        ...templateImage,
      },
    ]).find((template) => template.scale === 1);
    assert.ok(nativeTemplate);
    const nativeMatch = findBestPreparedMatch(
      prepareHaystack(nativeHaystack),
      nativeTemplate,
      0.88
    );
    assert.ok(nativeMatch);
    assert.ok(Math.abs(nativeMatch.x - nativeExpected.x) <= 1);
    assert.ok(Math.abs(nativeMatch.y - nativeExpected.y) <= 1);

    const cappedHaystack = noisyHaystack(1024, 576);
    paste(cappedHaystack, cappedImage, fixture.expected.x, fixture.expected.y);
    const cappedTemplate = prepareTemplateVariants(
      [{
        file: fixture.template,
        mode: fixture.mode,
        theme: 'dark',
        ...templateImage,
      }],
      0.75,
      0.75
    ).find((template) => template.scale === 1);
    assert.ok(cappedTemplate);
    const cappedMatch = findBestPreparedMatch(
      prepareHaystack(cappedHaystack),
      cappedTemplate,
      0.88
    );
    assert.ok(cappedMatch);
    assert.ok(Math.abs(cappedMatch.x - fixture.expected.x) <= 1);
    assert.ok(Math.abs(cappedMatch.y - fixture.expected.y) <= 1);
  });
}

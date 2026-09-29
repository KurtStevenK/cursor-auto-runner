import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
  const match = findBestPreparedMatch(prepareHaystack(haystack), template, 0.95);

  assert.ok(match);
  assert.ok(Math.abs(match.x - expected.x) <= 1);
  assert.ok(Math.abs(match.y - expected.y) <= 1);
});

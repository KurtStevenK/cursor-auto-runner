import { parentPort } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import type {
  MatchDebugInfo,
  MatchWorkerRequest,
  MatchWorkerResponse,
  TemplatePayload,
  WorkerMatch,
} from '../shared/match-protocol';
import {
  ColorComponent,
  evaluatePreparedMatch,
  findAccentComponents,
  findBestExactMatchInBounds,
  grayFromBGRA,
  MatchCandidate,
  orderTemplatesForMode,
  prepareHaystack,
  prepareTemplateVariants,
  PreparedTemplate,
  TEMPLATE_SCALES,
  TemplateInput,
} from './matcher-core';

if (!parentPort) throw new Error('match-worker must run inside a worker thread');

const DEBUG_MATCH =
  process.env.CURSOR_AUTO_RUNNER_DEBUG_MATCH === '1' ||
  process.env.CURSOR_AUTO_RUNNER_DEBUG_DETECT === '1';
const MAX_VARIANT_CACHE_ENTRIES = 8;

let templateInputs: TemplateInput[] = [];
const variantCache = new Map<string, PreparedTemplate[]>();
let templateCount = 0;

interface VerifiedMatch {
  candidate: MatchCandidate;
  template: PreparedTemplate;
  path: 'accent' | 'anchored-row';
}

function post(response: MatchWorkerResponse): void {
  parentPort!.postMessage(response);
}

function prepareTemplates(payloads: TemplatePayload[]): void {
  templateInputs = payloads.map((payload) => ({
    file: payload.file,
    mode: payload.mode,
    theme: payload.theme,
    width: payload.width,
    height: payload.height,
    data: new Float32Array(payload.data),
  }));
  templateCount = templateInputs.length;
  variantCache.clear();
  variantCache.set('1.0000:1.0000', prepareTemplateVariants(templateInputs));
}

function normalizedScale(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined || value <= 0) return 1;
  return Math.round(Math.min(1.5, Math.max(0.1, value)) * 10_000) / 10_000;
}

function variantsForScale(scaleXValue: number, scaleYValue: number): PreparedTemplate[] {
  const scaleX = normalizedScale(scaleXValue);
  const scaleY = normalizedScale(scaleYValue);
  const key = `${scaleX.toFixed(4)}:${scaleY.toFixed(4)}`;
  const cached = variantCache.get(key);
  if (cached) {
    // Refresh insertion order so stable display scales survive LRU eviction.
    variantCache.delete(key);
    variantCache.set(key, cached);
    return cached;
  }
  const prepared = prepareTemplateVariants(templateInputs, scaleX, scaleY);
  variantCache.set(key, prepared);
  if (variantCache.size > MAX_VARIANT_CACHE_ENTRIES) {
    const oldest = variantCache.keys().next().value as string | undefined;
    if (oldest) variantCache.delete(oldest);
  }
  return prepared;
}

function debugRank(info: MatchDebugInfo): number {
  return info.refinedScore ?? (info.coarseScore === null ? -4 : info.coarseScore - 2);
}

function componentFitsTemplate(component: ColorComponent, template: PreparedTemplate): boolean {
  const widthRatio = component.width / template.image.width;
  const heightRatio = component.height / template.image.height;
  return widthRatio >= 0.45 && widthRatio <= 1.45 && heightRatio >= 0.45 && heightRatio <= 1.45;
}

function findAccentVerifiedMatch(
  haystack: ReturnType<typeof prepareHaystack>,
  components: ColorComponent[],
  templates: PreparedTemplate[],
  confidence: number,
  cancelled: () => boolean
): VerifiedMatch | null {
  for (const template of templates) {
    if (template.mode !== 'run' && template.mode !== 'allow') continue;
    for (const component of components) {
      if (cancelled()) return null;
      if (!componentFitsTemplate(component, template)) continue;
      const padX = Math.max(4, Math.ceil(template.image.width * 0.2));
      const padY = Math.max(3, Math.ceil(template.image.height * 0.25));
      const candidate = findBestExactMatchInBounds(
        haystack,
        template,
        {
          x0: component.x - padX,
          y0: component.y - padY,
          x1: component.x + component.width - template.image.width + padX,
          y1: component.y + component.height - template.image.height + padY,
        },
        confidence,
        cancelled
      );
      if (candidate) return { candidate, template, path: 'accent' };
    }
  }
  return null;
}

function findAlwaysRunNear(
  haystack: ReturnType<typeof prepareHaystack>,
  run: VerifiedMatch,
  templates: PreparedTemplate[],
  confidence: number,
  cancelled: () => boolean
): VerifiedMatch | null {
  const alwaysTemplates = templates
    .filter((template) => template.mode === 'always-run')
    .sort((left, right) => {
      const leftSameScale = left.scale === run.template.scale ? 0 : 1;
      const rightSameScale = right.scale === run.template.scale ? 0 : 1;
      return leftSameScale - rightSameScale;
    });
  for (const template of alwaysTemplates) {
    if (cancelled()) return null;
    const rowPad = Math.max(10, Math.ceil(Math.max(run.template.image.height, template.image.height) * 0.75));
    const leftDistance = Math.min(
      Math.floor(haystack.image.width * 0.75),
      Math.max(400, template.image.width * 18)
    );
    const candidate = findBestExactMatchInBounds(
      haystack,
      template,
      {
        x0: run.candidate.x - leftDistance,
        y0: run.candidate.y - rowPad,
        x1: run.candidate.x - template.image.width + 4,
        y1: run.candidate.y + run.template.image.height - template.image.height + rowPad,
      },
      confidence,
      cancelled,
      'rightmost'
    );
    if (candidate) return { candidate, template, path: 'anchored-row' };
  }
  return null;
}

function workerMatch(
  cropId: number,
  verified: VerifiedMatch,
  pyramid: WorkerMatch['pyramid'] = 'full'
): WorkerMatch {
  return {
    cropId,
    x: verified.candidate.x,
    y: verified.candidate.y,
    templateWidth: verified.template.image.width,
    templateHeight: verified.template.image.height,
    score: verified.candidate.score,
    mode: verified.template.mode,
    file: verified.template.file,
    path: verified.path,
    pyramid,
  };
}

function handleMatch(request: Extract<MatchWorkerRequest, { type: 'match' }>): void {
  const startedAt = performance.now();
  const cancelView = new Int32Array(request.cancelBuffer);
  const cancelled = (): boolean => Atomics.load(cancelView, 0) !== 0;
  let match: WorkerMatch | null = null;
  let bestMiss: MatchDebugInfo | undefined;
  let variantCount = 0;

  for (const crop of request.crops) {
    if (cancelled()) break;
    const variants = variantsForScale(
      crop.captureToNativeScaleX,
      crop.captureToNativeScaleY
    );
    const eligible = orderTemplatesForMode(variants, request.mode);
    variantCount = Math.max(variantCount, eligible.length);
    const bgra = new Uint8Array(crop.bgra);
    const components = findAccentComponents(bgra, crop.width, crop.height, cancelled);
    const gray = grayFromBGRA(bgra, crop.width, crop.height);
    const haystack = prepareHaystack(gray);
    const accent = findAccentVerifiedMatch(
      haystack,
      components,
      eligible,
      request.confidence,
      cancelled
    );
    if (accent) {
      const verified =
        request.mode === 'always-run' && accent.template.mode === 'run'
          ? findAlwaysRunNear(haystack, accent, eligible, request.confidence, cancelled) ?? accent
          : accent;
      match = workerMatch(crop.id, verified);
      break;
    }
    // Modern Cursor actions are colored. Once a real-color crop has yielded
    // components, bounded exact verification is both safer and dramatically
    // cheaper than sweeping every tiny template across dense editor text.
    // Keep the global path for monochrome/legacy captures and synthetic tests.
    if (components.length > 0) continue;
    for (const template of eligible) {
      if (cancelled()) break;
      // "Always Run" also appears in prose and history. It is only safe when
      // an exact match is tied to a button-sized accent component on its row.
      if (template.mode === 'always-run') continue;
      const evaluation = evaluatePreparedMatch(
        haystack,
        template,
        request.confidence,
        cancelled
      );
      if (evaluation.match) {
        match = {
          cropId: crop.id,
          x: evaluation.match.x,
          y: evaluation.match.y,
          templateWidth: template.image.width,
          templateHeight: template.image.height,
          score: evaluation.match.score,
          mode: template.mode,
          file: template.file,
          path: 'global',
          pyramid: evaluation.pyramid,
        };
        break;
      }
      if (DEBUG_MATCH) {
        const diagnostic: MatchDebugInfo = {
          cropId: crop.id,
          file: template.file,
          mode: template.mode,
          baseScale: template.scale,
          captureToNativeScaleX: template.captureToNativeScaleX,
          captureToNativeScaleY: template.captureToNativeScaleY,
          templateWidth: template.image.width,
          templateHeight: template.image.height,
          coarseScore: evaluation.bestCoarseScore,
          refinedScore: evaluation.bestCandidate?.score ?? null,
          pyramid: evaluation.pyramid,
          phaseCount: evaluation.phaseCount,
          candidateCount: evaluation.candidateCount,
        };
        if (!bestMiss || debugRank(diagnostic) > debugRank(bestMiss)) bestMiss = diagnostic;
      }
    }
    if (match) break;
  }

  post({
    type: 'result',
    requestId: request.requestId,
    match,
    ...(match || !bestMiss ? {} : { bestMiss }),
    variantCount,
    matchMs: performance.now() - startedAt,
    workerHeapBytes: process.memoryUsage().heapUsed,
    cancelled: cancelled(),
  });
}

parentPort.on('message', (request: MatchWorkerRequest) => {
  try {
    if (request.type === 'init') {
      prepareTemplates(request.templates);
      post({
        type: 'ready',
        requestId: request.requestId,
        templateCount,
        variantCount: templateCount * TEMPLATE_SCALES.length,
      });
      return;
    }
    handleMatch(request);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    post({ type: 'error', requestId: request.requestId, message: err.message, stack: err.stack });
  }
});

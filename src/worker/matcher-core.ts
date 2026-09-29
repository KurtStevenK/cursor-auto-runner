export type MatchMode = 'run' | 'always-run' | 'allow';
export type TemplateTheme = 'dark' | 'light';

export interface GrayImage {
  width: number;
  height: number;
  data: Float32Array;
}

export interface TemplateInput {
  file: string;
  mode: MatchMode;
  theme: TemplateTheme;
  width: number;
  height: number;
  data: Float32Array;
}

export interface PreparedTemplate {
  file: string;
  mode: MatchMode;
  theme: TemplateTheme;
  /** DPI/UI scale before the detector's capture downscale is applied. */
  scale: number;
  captureToNativeScaleX: number;
  captureToNativeScaleY: number;
  image: GrayImage;
  mid: GrayImage;
  coarse: GrayImage;
  fullSum: number;
  fullSumSq: number;
  midSum: number;
  midSumSq: number;
  coarseSum: number;
  coarseSumSq: number;
}

export interface MatchCandidate {
  x: number;
  y: number;
  score: number;
}

export interface MatchBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ColorComponent {
  x: number;
  y: number;
  width: number;
  height: number;
  pixels: number;
}

export interface MatchEvaluation {
  match: MatchCandidate | null;
  /** Highest exact NCC candidate, including scores below the click threshold. */
  bestCandidate: MatchCandidate | null;
  bestCoarseScore: number | null;
  pyramid: 'full' | 'half' | 'quarter';
  phaseCount: number;
  candidateCount: number;
}

export interface PreparedHaystack {
  image: GrayImage;
  mid: GrayImage | null;
  coarse: GrayImage;
  coarseFactor: 1 | 4;
  midIntegral: Integral | null;
  coarseIntegral: Integral;
  fullIntegral: Integral | null;
}

export const TEMPLATE_SCALES = [1, 0.8, 0.67, 0.5, 0.4, 1.25, 1.5] as const;

/** Convert an Electron nativeImage BGRA bitmap to grayscale. */
export function grayFromBGRA(data: Uint8Array, width: number, height: number): GrayImage {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const offset = i * 4;
    gray[i] = 0.299 * data[offset + 2] + 0.587 * data[offset + 1] + 0.114 * data[offset];
  }
  return { width, height, data: gray };
}

/** Resize a grayscale image using independent, positive scale factors. */
export function resizeGrayXY(src: GrayImage, scaleX: number, scaleY: number): GrayImage {
  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) {
    throw new Error(`invalid grayscale resize scale ${scaleX}x${scaleY}`);
  }
  if (scaleX === 1 && scaleY === 1) return src;
  const width = Math.max(2, Math.round(src.width * scaleX));
  const height = Math.max(2, Math.round(src.height * scaleY));
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const sourceY = Math.min(src.height - 1, (y + 0.5) / scaleY - 0.5);
    const y0 = Math.max(0, Math.floor(sourceY));
    const y1 = Math.min(src.height - 1, y0 + 1);
    const fractionY = sourceY - y0;
    for (let x = 0; x < width; x++) {
      const sourceX = Math.min(src.width - 1, (x + 0.5) / scaleX - 0.5);
      const x0 = Math.max(0, Math.floor(sourceX));
      const x1 = Math.min(src.width - 1, x0 + 1);
      const fractionX = sourceX - x0;
      const top = src.data[y0 * src.width + x0] * (1 - fractionX) + src.data[y0 * src.width + x1] * fractionX;
      const bottom = src.data[y1 * src.width + x0] * (1 - fractionX) + src.data[y1 * src.width + x1] * fractionX;
      data[y * width + x] = top * (1 - fractionY) + bottom * fractionY;
    }
  }
  return { width, height, data };
}

/** Resize a grayscale image uniformly using bilinear interpolation. */
export function resizeGray(src: GrayImage, scale: number): GrayImage {
  return resizeGrayXY(src, scale, scale);
}

function imageStats(image: GrayImage): { sum: number; sumSq: number } {
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < image.data.length; i++) {
    const value = image.data[i];
    sum += value;
    sumSq += value * value;
  }
  return { sum, sumSq };
}

export function prepareTemplateVariants(
  inputs: TemplateInput[],
  captureToNativeScaleX = 1,
  captureToNativeScaleY = captureToNativeScaleX
): PreparedTemplate[] {
  const variants: PreparedTemplate[] = [];
  for (const input of inputs) {
    const base: GrayImage = { width: input.width, height: input.height, data: input.data };
    for (const scale of TEMPLATE_SCALES) {
      const image = resizeGrayXY(
        base,
        scale * captureToNativeScaleX,
        scale * captureToNativeScaleY
      );
      const mid = resizeGray(image, 0.5);
      const coarse = resizeGray(image, 0.25);
      const fullStats = imageStats(image);
      const midStats = imageStats(mid);
      const coarseStats = imageStats(coarse);
      variants.push({
        file: input.file,
        mode: input.mode,
        theme: input.theme,
        scale,
        captureToNativeScaleX,
        captureToNativeScaleY,
        image,
        mid,
        coarse,
        fullSum: fullStats.sum,
        fullSumSq: fullStats.sumSq,
        midSum: midStats.sum,
        midSumSq: midStats.sumSq,
        coarseSum: coarseStats.sum,
        coarseSumSq: coarseStats.sumSq,
      });
    }
  }
  return variants;
}

export function orderTemplatesForMode(
  templates: PreparedTemplate[],
  mode: MatchMode
): PreparedTemplate[] {
  const preferred: MatchMode[] =
    mode === 'always-run'
      ? ['always-run', 'run', 'allow']
      : mode === 'run'
        ? ['run', 'allow']
        : ['allow'];
  return templates
    .filter((template) => preferred.includes(template.mode))
    .sort((left, right) => {
      const rank = (template: PreparedTemplate): number =>
        preferred.indexOf(template.mode) * 10 +
        (template.theme === 'dark' ? 0 : 5) +
        TEMPLATE_SCALES.indexOf(template.scale as (typeof TEMPLATE_SCALES)[number]);
      return rank(left) - rank(right);
    });
}

/** Integral images provide O(1) sums and squared sums for a sliding window. */
export class Integral {
  private readonly sum: Float64Array;
  private readonly sumSq: Float64Array;

  constructor(private readonly image: GrayImage) {
    const stride = image.width + 1;
    this.sum = new Float64Array(stride * (image.height + 1));
    this.sumSq = new Float64Array(stride * (image.height + 1));
    for (let y = 0; y < image.height; y++) {
      let rowSum = 0;
      let rowSumSq = 0;
      for (let x = 0; x < image.width; x++) {
        const value = image.data[y * image.width + x];
        rowSum += value;
        rowSumSq += value * value;
        const index = (y + 1) * stride + x + 1;
        this.sum[index] = this.sum[y * stride + x + 1] + rowSum;
        this.sumSq[index] = this.sumSq[y * stride + x + 1] + rowSumSq;
      }
    }
  }

  window(x: number, y: number, width: number, height: number): { sum: number; sumSq: number } {
    const stride = this.image.width + 1;
    const x1 = x + width;
    const y1 = y + height;
    const sum =
      this.sum[y1 * stride + x1] -
      this.sum[y * stride + x1] -
      this.sum[y1 * stride + x] +
      this.sum[y * stride + x];
    const sumSq =
      this.sumSq[y1 * stride + x1] -
      this.sumSq[y * stride + x1] -
      this.sumSq[y1 * stride + x] +
      this.sumSq[y * stride + x];
    return { sum, sumSq };
  }
}

export function prepareHaystack(image: GrayImage): PreparedHaystack {
  const coarseFactor: 1 | 4 = Math.min(image.width, image.height) > 400 ? 4 : 1;
  const coarse = coarseFactor === 4 ? resizeGray(image, 0.25) : image;
  const coarseIntegral = new Integral(coarse);
  return {
    image,
    mid: null,
    coarse,
    coarseFactor,
    midIntegral: null,
    coarseIntegral,
    fullIntegral: coarseFactor === 1 ? coarseIntegral : null,
  };
}

function dotProduct(haystack: GrayImage, template: GrayImage, x: number, y: number): number {
  let result = 0;
  for (let templateY = 0; templateY < template.height; templateY++) {
    const haystackOffset = (y + templateY) * haystack.width + x;
    const templateOffset = templateY * template.width;
    for (let templateX = 0; templateX < template.width; templateX++) {
      result += haystack.data[haystackOffset + templateX] * template.data[templateOffset + templateX];
    }
  }
  return result;
}

function nccAt(
  haystack: GrayImage,
  integral: Integral,
  template: GrayImage,
  templateSum: number,
  templateSumSq: number,
  x: number,
  y: number
): number {
  const count = template.width * template.height;
  const window = integral.window(x, y, template.width, template.height);
  const haystackVariance = Math.max(0, window.sumSq - (window.sum * window.sum) / count);
  const templateVariance = Math.max(0, templateSumSq - (templateSum * templateSum) / count);
  if (haystackVariance < 1e-6 || templateVariance < 1e-6) return -1;
  const covariance = dotProduct(haystack, template, x, y) - (window.sum * templateSum) / count;
  const denominator = Math.sqrt(haystackVariance * templateVariance);
  return denominator < 1e-6 ? -1 : covariance / denominator;
}

/** Find compact saturated-color regions that may be primary action buttons. */
export function findAccentComponents(
  bgra: Uint8Array,
  width: number,
  height: number,
  cancelled: () => boolean = () => false
): ColorComponent[] {
  const pixelCount = width * height;
  const mask = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index++) {
    if ((index & 0x7fff) === 0 && cancelled()) return [];
    const offset = index * 4;
    const blue = bgra[offset];
    const green = bgra[offset + 1];
    const red = bgra[offset + 2];
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    if (max >= 80 && max - min >= 35 && (max - min) / max >= 0.25) mask[index] = 1;
  }

  const seen = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  const components: ColorComponent[] = [];
  for (let start = 0; start < pixelCount; start++) {
    if (!mask[start] || seen[start]) continue;
    let queueStart = 0;
    let queueEnd = 0;
    queue[queueEnd++] = start;
    seen[start] = 1;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let pixels = 0;

    while (queueStart < queueEnd) {
      if ((pixels & 0x1fff) === 0 && cancelled()) return [];
      const index = queue[queueStart++];
      const x = index % width;
      const y = Math.floor(index / width);
      pixels++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      if (x > 0) {
        const next = index - 1;
        if (mask[next] && !seen[next]) {
          seen[next] = 1;
          queue[queueEnd++] = next;
        }
      }
      if (x + 1 < width) {
        const next = index + 1;
        if (mask[next] && !seen[next]) {
          seen[next] = 1;
          queue[queueEnd++] = next;
        }
      }
      if (y > 0) {
        const next = index - width;
        if (mask[next] && !seen[next]) {
          seen[next] = 1;
          queue[queueEnd++] = next;
        }
      }
      if (y + 1 < height) {
        const next = index + width;
        if (mask[next] && !seen[next]) {
          seen[next] = 1;
          queue[queueEnd++] = next;
        }
      }
    }

    const componentWidth = maxX - minX + 1;
    const componentHeight = maxY - minY + 1;
    const fill = pixels / (componentWidth * componentHeight);
    if (
      componentWidth >= 6 &&
      componentHeight >= 4 &&
      componentWidth <= 320 &&
      componentHeight <= 100 &&
      pixels >= 24 &&
      fill >= 0.18
    ) {
      components.push({
        x: minX,
        y: minY,
        width: componentWidth,
        height: componentHeight,
        pixels,
      });
    }
  }
  return components;
}

/** Exact NCC inside bounded top-left coordinates; used only after a safe seed. */
export function findBestExactMatchInBounds(
  haystack: PreparedHaystack,
  template: PreparedTemplate,
  bounds: MatchBounds,
  minConfidence: number,
  cancelled: () => boolean = () => false,
  preference: 'score' | 'rightmost' = 'score'
): MatchCandidate | null {
  if (template.image.width > haystack.image.width || template.image.height > haystack.image.height) {
    return null;
  }
  if (!haystack.fullIntegral) haystack.fullIntegral = new Integral(haystack.image);
  const x0 = Math.max(0, Math.floor(bounds.x0));
  const y0 = Math.max(0, Math.floor(bounds.y0));
  const x1 = Math.min(
    haystack.image.width - template.image.width,
    Math.ceil(bounds.x1)
  );
  const y1 = Math.min(
    haystack.image.height - template.image.height,
    Math.ceil(bounds.y1)
  );
  if (x1 < x0 || y1 < y0) return null;

  let best: MatchCandidate | null = null;
  for (let y = y0; y <= y1; y++) {
    if ((y & 7) === 0 && cancelled()) return null;
    for (let x = x0; x <= x1; x++) {
      const score = nccAt(
        haystack.image,
        haystack.fullIntegral,
        template.image,
        template.fullSum,
        template.fullSumSq,
        x,
        y
      );
      if (
        preference === 'rightmost'
          ? score >= minConfidence &&
            (!best || x > best.x || (x === best.x && score > best.score))
          : !best || score > best.score
      ) {
        best = { x, y, score };
      }
    }
  }
  return best && best.score >= minConfidence ? best : null;
}

const MAX_COARSE_CANDIDATES = 16;
const MAX_COMPOSER_CANDIDATES = 8;
const MIN_QUARTER_COARSE_PIXELS = 72;
const COMPOSER_BAND_START = 0.55;

function retainDistinctCandidate(
  candidates: MatchCandidate[],
  candidate: MatchCandidate,
  separationX: number,
  separationY: number,
  limit = MAX_COARSE_CANDIDATES
): void {
  const nearbyIndex = candidates.findIndex(
    (current) =>
      Math.abs(current.x - candidate.x) < separationX &&
      Math.abs(current.y - candidate.y) < separationY
  );
  if (nearbyIndex !== -1) {
    if (candidate.score > candidates[nearbyIndex].score) candidates[nearbyIndex] = candidate;
    return;
  }
  if (candidates.length < limit) {
    candidates.push(candidate);
    return;
  }
  let weakestIndex = 0;
  for (let index = 1; index < candidates.length; index++) {
    if (candidates[index].score < candidates[weakestIndex].score) weakestIndex = index;
  }
  if (candidate.score > candidates[weakestIndex].score) candidates[weakestIndex] = candidate;
}

function ensureMidHaystack(haystack: PreparedHaystack): {
  image: GrayImage;
  integral: Integral;
} {
  if (!haystack.mid) haystack.mid = resizeGray(haystack.image, 0.5);
  if (!haystack.midIntegral) haystack.midIntegral = new Integral(haystack.mid);
  return { image: haystack.mid, integral: haystack.midIntegral };
}

/**
 * Evaluate one preprocessed template. Multiple spatially distinct coarse
 * candidates are refined so a repeated icon or text fragment elsewhere in the
 * Cursor window cannot hide the real button.
 */
export function evaluatePreparedMatch(
  haystack: PreparedHaystack,
  template: PreparedTemplate,
  minConfidence: number,
  cancelled: () => boolean = () => false
): MatchEvaluation {
  let searchImage: GrayImage;
  let searchIntegral: Integral;
  let searchTemplate: GrayImage;
  let searchTemplateSum: number;
  let searchTemplateSumSq: number;
  let searchFactor: 1 | 2 | 4;
  let pyramid: MatchEvaluation['pyramid'];
  let phases: ReadonlyArray<readonly [number, number]>;

  if (haystack.coarseFactor === 1) {
    searchImage = haystack.image;
    searchIntegral = haystack.coarseIntegral;
    searchTemplate = template.image;
    searchTemplateSum = template.fullSum;
    searchTemplateSumSq = template.fullSumSq;
    searchFactor = 1;
    pyramid = 'full';
    phases = [[0, 0]];
  } else if (template.coarse.width * template.coarse.height < MIN_QUARTER_COARSE_PIXELS) {
    const midHaystack = ensureMidHaystack(haystack);
    searchImage = midHaystack.image;
    searchIntegral = midHaystack.integral;
    searchTemplate = template.mid;
    searchTemplateSum = template.midSum;
    searchTemplateSumSq = template.midSumSq;
    searchFactor = 2;
    pyramid = 'half';
    // Four interleaved stride-two passes cover every half-resolution phase.
    phases = [[0, 0], [1, 0], [0, 1], [1, 1]];
  } else {
    searchImage = haystack.coarse;
    searchIntegral = haystack.coarseIntegral;
    searchTemplate = template.coarse;
    searchTemplateSum = template.coarseSum;
    searchTemplateSumSq = template.coarseSumSq;
    searchFactor = 4;
    pyramid = 'quarter';
    phases = [[0, 0]];
  }

  const phaseCount = phases.length;
  if (searchTemplate.width > searchImage.width || searchTemplate.height > searchImage.height) {
    return {
      match: null,
      bestCandidate: null,
      bestCoarseScore: null,
      pyramid,
      phaseCount,
      candidateCount: 0,
    };
  }

  const candidates: MatchCandidate[] = [];
  const composerCandidates: MatchCandidate[] = [];
  const separationX = Math.max(2, Math.floor(searchTemplate.width / 2));
  const separationY = Math.max(2, Math.floor(searchTemplate.height / 2));
  const maxY = searchImage.height - searchTemplate.height;
  const maxX = searchImage.width - searchTemplate.width;
  const composerStart = Math.floor(searchImage.height * COMPOSER_BAND_START);
  const searchStep = searchFactor === 1 ? 1 : 2;
  let scannedRows = 0;

  for (const [phaseX, phaseY] of phases) {
    for (let y = phaseY; y <= maxY; y += searchStep) {
      if ((scannedRows++ & 7) === 0 && cancelled()) {
        return {
          match: null,
          bestCandidate: null,
          bestCoarseScore: null,
          pyramid,
          phaseCount,
          candidateCount: candidates.length,
        };
      }
      for (let x = phaseX; x <= maxX; x += searchStep) {
        const score = nccAt(
          searchImage,
          searchIntegral,
          searchTemplate,
          searchTemplateSum,
          searchTemplateSumSq,
          x,
          y
        );
        const candidate = { x, y, score };
        retainDistinctCandidate(candidates, candidate, separationX, separationY);
        if (pyramid === 'half' && y + searchTemplate.height / 2 >= composerStart) {
          retainDistinctCandidate(
            composerCandidates,
            candidate,
            separationX,
            separationY,
            MAX_COMPOSER_CANDIDATES
          );
        }
      }
    }
  }
  for (const candidate of composerCandidates) {
    if (!candidates.some((current) => current.x === candidate.x && current.y === candidate.y)) {
      candidates.push(candidate);
    }
  }
  candidates.sort((left, right) => right.score - left.score);
  const bestCoarseScore = candidates[0]?.score ?? null;
  const candidateCount = candidates.length;

  // With no downsampling, the coarse scores are already exact full-resolution
  // scores and another neighborhood pass would only duplicate work.
  if (searchFactor === 1) {
    const bestCandidate = candidates[0] ?? null;
    return {
      match: bestCandidate && bestCandidate.score >= minConfidence ? bestCandidate : null,
      bestCandidate,
      bestCoarseScore,
      pyramid,
      phaseCount,
      candidateCount,
    };
  }

  // Downsampling is phase-sensitive when a small button begins between 4 px
  // sample boundaries. Keep the gate permissive and let exact NCC decide.
  const coarseGate = Math.max(0.2, minConfidence - 0.7);
  const eligible = candidates.filter((candidate) => candidate.score >= coarseGate);
  if (eligible.length === 0 || cancelled()) {
    return {
      match: null,
      bestCandidate: null,
      bestCoarseScore,
      pyramid,
      phaseCount,
      candidateCount,
    };
  }

  if (!haystack.fullIntegral) haystack.fullIntegral = new Integral(haystack.image);
  const coarseScale = 1 / searchFactor;
  const phaseRadius = searchFactor * 3 + 2;
  const radiusX = Math.max(phaseRadius, Math.ceil(template.image.width * 0.12));
  const radiusY = Math.max(phaseRadius, Math.ceil(template.image.height * 0.12));
  let bestCandidate: MatchCandidate | null = null;

  for (const coarseCandidate of eligible) {
    let localBest: MatchCandidate | null = null;
    const centerX = Math.round((coarseCandidate.x + searchTemplate.width / 2) / coarseScale);
    const centerY = Math.round((coarseCandidate.y + searchTemplate.height / 2) / coarseScale);
    const x0 = Math.max(
      0,
      Math.floor(centerX - template.image.width / 2 - radiusX)
    );
    const y0 = Math.max(
      0,
      Math.floor(centerY - template.image.height / 2 - radiusY)
    );
    const x1 = Math.min(
      haystack.image.width - template.image.width,
      Math.ceil(centerX - template.image.width / 2 + radiusX)
    );
    const y1 = Math.min(
      haystack.image.height - template.image.height,
      Math.ceil(centerY - template.image.height / 2 + radiusY)
    );

    for (let y = y0; y <= y1; y++) {
      if ((y & 7) === 0 && cancelled()) {
        return {
          match: null,
          bestCandidate: null,
          bestCoarseScore,
          pyramid,
          phaseCount,
          candidateCount,
        };
      }
      for (let x = x0; x <= x1; x++) {
        const score = nccAt(
          haystack.image,
          haystack.fullIntegral,
          template.image,
          template.fullSum,
          template.fullSumSq,
          x,
          y
        );
        if (!localBest || score > localBest.score) localBest = { x, y, score };
      }
    }
    if (localBest && (!bestCandidate || localBest.score > bestCandidate.score)) {
      bestCandidate = localBest;
    }
    // A high-confidence exact hit is sufficient; avoid refining the remaining
    // coarse distractors on the common successful path.
    if (localBest && localBest.score >= minConfidence) {
      return {
        match: localBest,
        bestCandidate: localBest,
        bestCoarseScore,
        pyramid,
        phaseCount,
        candidateCount,
      };
    }
  }
  return {
    match:
      bestCandidate && bestCandidate.score >= minConfidence
        ? bestCandidate
        : null,
    bestCandidate,
    bestCoarseScore,
    pyramid,
    phaseCount,
    candidateCount,
  };
}

/**
 * Compatibility wrapper for callers that only need a thresholded match.
 */
export function findBestPreparedMatch(
  haystack: PreparedHaystack,
  template: PreparedTemplate,
  minConfidence: number,
  cancelled: () => boolean = () => false
): MatchCandidate | null {
  return evaluatePreparedMatch(
    haystack,
    template,
    minConfidence,
    cancelled
  ).match;
}

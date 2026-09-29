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
  scale: number;
  image: GrayImage;
  coarse: GrayImage;
  fullSum: number;
  fullSumSq: number;
  coarseSum: number;
  coarseSumSq: number;
}

export interface MatchCandidate {
  x: number;
  y: number;
  score: number;
}

export interface PreparedHaystack {
  image: GrayImage;
  coarse: GrayImage;
  coarseFactor: 1 | 4;
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

/** Resize a grayscale image by a scale factor using bilinear interpolation. */
export function resizeGray(src: GrayImage, scale: number): GrayImage {
  if (scale === 1) return src;
  const width = Math.max(2, Math.round(src.width * scale));
  const height = Math.max(2, Math.round(src.height * scale));
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const sourceY = Math.min(src.height - 1, (y + 0.5) / scale - 0.5);
    const y0 = Math.max(0, Math.floor(sourceY));
    const y1 = Math.min(src.height - 1, y0 + 1);
    const fractionY = sourceY - y0;
    for (let x = 0; x < width; x++) {
      const sourceX = Math.min(src.width - 1, (x + 0.5) / scale - 0.5);
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

export function prepareTemplateVariants(inputs: TemplateInput[]): PreparedTemplate[] {
  const variants: PreparedTemplate[] = [];
  for (const input of inputs) {
    const base: GrayImage = { width: input.width, height: input.height, data: input.data };
    for (const scale of TEMPLATE_SCALES) {
      const image = resizeGray(base, scale);
      const coarse = resizeGray(image, 0.25);
      const fullStats = imageStats(image);
      const coarseStats = imageStats(coarse);
      variants.push({
        file: input.file,
        mode: input.mode,
        theme: input.theme,
        scale,
        image,
        coarse,
        fullSum: fullStats.sum,
        fullSumSq: fullStats.sumSq,
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
    coarse,
    coarseFactor,
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

/**
 * Match one preprocessed template. The haystack resize and integral images are
 * shared by every template in a crop, avoiding the previous per-variant churn.
 */
export function findBestPreparedMatch(
  haystack: PreparedHaystack,
  template: PreparedTemplate,
  minConfidence: number,
  cancelled: () => boolean = () => false
): MatchCandidate | null {
  const coarseTemplate = haystack.coarseFactor === 4 ? template.coarse : template.image;
  const coarseTemplateSum = haystack.coarseFactor === 4 ? template.coarseSum : template.fullSum;
  const coarseTemplateSumSq = haystack.coarseFactor === 4 ? template.coarseSumSq : template.fullSumSq;
  if (coarseTemplate.width > haystack.coarse.width || coarseTemplate.height > haystack.coarse.height) return null;

  let best: MatchCandidate | null = null;
  const maxY = haystack.coarse.height - coarseTemplate.height;
  const maxX = haystack.coarse.width - coarseTemplate.width;
  for (let y = 0; y <= maxY; y++) {
    if ((y & 7) === 0 && cancelled()) return null;
    for (let x = 0; x <= maxX; x++) {
      const score = nccAt(
        haystack.coarse,
        haystack.coarseIntegral,
        coarseTemplate,
        coarseTemplateSum,
        coarseTemplateSumSq,
        x,
        y
      );
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  // Downsampling is phase-sensitive when a small button begins between 4 px
  // sample boundaries. Keep the coarse gate permissive and let exact NCC make
  // the final decision in the small refinement area.
  if (!best || best.score < Math.max(0.2, minConfidence - 0.7) || cancelled()) return null;

  if (!haystack.fullIntegral) haystack.fullIntegral = new Integral(haystack.image);
  const coarseScale = 1 / haystack.coarseFactor;
  const centerX = Math.round((best.x + coarseTemplate.width / 2) / coarseScale);
  const centerY = Math.round((best.y + coarseTemplate.height / 2) / coarseScale);
  const radius = Math.round(template.image.width * 0.6);
  const x0 = Math.max(0, Math.floor(centerX - template.image.width / 2 - radius));
  const y0 = Math.max(0, Math.floor(centerY - template.image.height / 2 - radius));
  const x1 = Math.min(
    haystack.image.width - template.image.width,
    Math.ceil(centerX - template.image.width / 2 + radius)
  );
  const y1 = Math.min(
    haystack.image.height - template.image.height,
    Math.ceil(centerY - template.image.height / 2 + radius)
  );

  let refined: MatchCandidate | null = null;
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
      if (!refined || score > refined.score) refined = { x, y, score };
    }
  }
  return refined && refined.score >= minConfidence ? refined : null;
}

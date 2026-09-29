/**
 * Pure-JS template matcher for multi-monitor support.
 *
 * nut.js screen.find can only search the main display, so detection for
 * every display is done here: grayscale NCC (normalized cross-correlation)
 * with a coarse-to-fine strategy over raw screen captures.
 */
import Jimp from 'jimp';

export interface GrayImage {
  width: number;
  height: number;
  data: Float32Array; // grayscale, row-major
}

export interface MatchCandidate {
  x: number; // top-left within the haystack
  y: number;
  score: number;
}

/** Convert a nativeImage BGRA bitmap to grayscale. */
export function grayFromBGRA(buffer: Buffer, width: number, height: number): GrayImage {
  const data = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    data[i] = 0.299 * buffer[o + 2] + 0.587 * buffer[o + 1] + 0.114 * buffer[o]; // B,G,R order
  }
  return { width, height, data };
}

/** Load a template image from disk as grayscale (RGBA via jimp). */
export async function loadTemplate(file: string): Promise<GrayImage> {
  const img = await Jimp.read(file);
  const { width, height } = img.bitmap;
  const data = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    data[i] = 0.299 * img.bitmap.data[o] + 0.587 * img.bitmap.data[o + 1] + 0.114 * img.bitmap.data[o + 2];
  }
  return { width, height, data };
}

/** Resize a grayscale image by a scale factor (bilinear). */
export function resizeGray(src: GrayImage, scale: number): GrayImage {
  const w = Math.max(2, Math.round(src.width * scale));
  const h = Math.max(2, Math.round(src.height * scale));
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(src.height - 1, ((y + 0.5) / scale) - 0.5);
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(src.height - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.width - 1, ((x + 0.5) / scale) - 0.5);
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(src.width - 1, x0 + 1);
      const fx = sx - x0;
      const a = src.data[y0 * src.width + x0] * (1 - fx) + src.data[y0 * src.width + x1] * fx;
      const b = src.data[y1 * src.width + x0] * (1 - fx) + src.data[y1 * src.width + x1] * fx;
      data[y * w + x] = a * (1 - fy) + b * fy;
    }
  }
  return { width: w, height: h, data };
}

/** Integral images for O(1) window sums (sum and sum of squares). */
class Integral {
  private sum: Float64Array;
  private sumSq: Float64Array;
  constructor(private img: GrayImage) {
    const { width: w, height: h, data } = img;
    this.sum = new Float64Array((w + 1) * (h + 1));
    this.sumSq = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let rowSum = 0, rowSumSq = 0;
      for (let x = 0; x < w; x++) {
        const v = data[y * w + x];
        rowSum += v;
        rowSumSq += v * v;
        this.sum[(y + 1) * (w + 1) + (x + 1)] = this.sum[y * (w + 1) + (x + 1)] + rowSum;
        this.sumSq[(y + 1) * (w + 1) + (x + 1)] = this.sumSq[y * (w + 1) + (x + 1)] + rowSumSq;
      }
    }
  }
  win(x: number, y: number, w: number, h: number): { s: number; s2: number } {
    const W = this.img.width + 1;
    const x1 = x + w, y1 = y + h;
    const s = this.sum[y1 * W + x1] - this.sum[y * W + x1] - this.sum[y1 * W + x] + this.sum[y * W + x];
    const s2 = this.sumSq[y1 * W + x1] - this.sumSq[y * W + x1] - this.sumSq[y1 * W + x] + this.sumSq[y * W + x];
    return { s, s2 };
  }
}

/** NCC numerator: sliding dot product of template with haystack at (x, y). */
function dotProduct(hay: GrayImage, tpl: GrayImage, x: number, y: number): number {
  let acc = 0;
  for (let ty = 0; ty < tpl.height; ty++) {
    const ho = (y + ty) * hay.width + x;
    const to = ty * tpl.width;
    for (let tx = 0; tx < tpl.width; tx++) {
      acc += hay.data[ho + tx] * tpl.data[to + tx];
    }
  }
  return acc;
}

/**
 * Exact NCC score of the template at a haystack position.
 * Returns -1 if the score cannot be computed (flat patches).
 */
function nccAt(hay: GrayImage, integral: Integral, tpl: GrayImage, tplSum: number, tplSumSq: number, x: number, y: number): number {
  const n = tpl.width * tpl.height;
  const { s, s2 } = integral.win(x, y, tpl.width, tpl.height);
  const sxy = dotProduct(hay, tpl, x, y);
  const cov = sxy - (s * tplSum) / n;
  const varHay = Math.max(0, s2 - (s * s) / n);
  const varTpl = Math.max(0, tplSumSq - (tplSum * tplSum) / n);
  const denom = Math.sqrt(varHay * varTpl);
  if (denom < 1e-6) return -1;
  return cov / denom;
}

/**
 * Find the best template match in the haystack.
 * Coarse pass on a 4x-downscaled copy, exact refinement around the winner.
 * Returns null when nothing scores >= minConfidence.
 */
export function findBestMatch(hay: GrayImage, tpl: GrayImage, minConfidence: number): MatchCandidate | null {
  if (tpl.width > hay.width || tpl.height > hay.height) return null;

  // ---- template stats ----
  let tplSum = 0, tplSumSq = 0;
  for (let i = 0; i < tpl.data.length; i++) {
    tplSum += tpl.data[i];
    tplSumSq += tpl.data[i] * tpl.data[i];
  }

  // ---- coarse pass ----
  const FACTOR = 4;
  const scale = Math.min(1, Math.min(hay.width, hay.height) > 400 ? 1 / FACTOR : 1);
  const cHay = scale < 1 ? resizeGray(hay, scale) : hay;
  const cTpl = scale < 1 ? resizeGray(tpl, scale) : tpl;
  if (cTpl.width > cHay.width || cTpl.height > cHay.height) return null;

  let cTplSum = 0, cTplSumSq = 0;
  for (let i = 0; i < cTpl.data.length; i++) {
    cTplSum += cTpl.data[i];
    cTplSumSq += cTpl.data[i] * cTpl.data[i];
  }
  const cIntegral = new Integral(cHay);

  let best: MatchCandidate | null = null;
  for (let y = 0; y <= cHay.height - cTpl.height; y++) {
    for (let x = 0; x <= cHay.width - cTpl.width; x++) {
      const score = nccAt(cHay, cIntegral, cTpl, cTplSum, cTplSumSq, x, y);
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  if (!best || best.score < Math.max(0.6, minConfidence - 0.3)) return null;

  // ---- refinement around the coarse winner (full resolution) ----
  const integral = new Integral(hay);
  const cx = Math.round((best.x + cTpl.width / 2) / scale);
  const cy = Math.round((best.y + cTpl.height / 2) / scale);
  const radius = Math.round(tpl.width * 0.6);
  const x0 = Math.max(0, cx - tpl.width / 2 - radius);
  const y0 = Math.max(0, cy - tpl.height / 2 - radius);
  const x1 = Math.min(hay.width - tpl.width, cx - tpl.width / 2 + radius);
  const y1 = Math.min(hay.height - tpl.height, cy - tpl.height / 2 + radius);

  let refined: MatchCandidate | null = null;
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const score = nccAt(hay, integral, tpl, tplSum, tplSumSq, x, y);
      if (!refined || score > refined.score) refined = { x, y, score };
    }
  }
  if (!refined || refined.score < minConfidence) return null;
  return refined;
}

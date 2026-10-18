/** Template loading and validation. Runtime NCC matching lives in the worker. */
export interface GrayImage {
  width: number;
  height: number;
  data: Float32Array;
}

export interface TemplateValidation {
  valid: boolean;
  reason?: string;
}

/** Grayscale from tightly packed RGBA pixels (0.299 R + 0.587 G + 0.114 B). */
export function grayFromRgba(rgba: ArrayLike<number>, width: number, height: number): GrayImage {
  const data = new Float32Array(width * height);
  for (let i = 0; i < data.length; i++) {
    const o = i * 4;
    data[i] = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
  }
  return { width, height, data };
}

/** Grayscale from tightly packed BGRA pixels (Electron NativeImage byte order). */
export function grayFromBgra(bgra: ArrayLike<number>, width: number, height: number): GrayImage {
  const data = new Float32Array(width * height);
  for (let i = 0; i < data.length; i++) {
    const o = i * 4;
    data[i] = 0.299 * bgra[o + 2] + 0.587 * bgra[o + 1] + 0.114 * bgra[o];
  }
  return { width, height, data };
}

export function validateTemplateDimensions(width: number, height: number): TemplateValidation {
  if (width < 8 || height < 8) return { valid: false, reason: 'selection is too small' };
  if (width > 512 || height > 256 || width * height > 131_072) {
    return { valid: false, reason: 'selection is too large; capture only the button label' };
  }
  if (width / height > 5) {
    return { valid: false, reason: 'selection is too wide; exclude changing command text' };
  }
  return { valid: true };
}

/** Scale-independent 16×16 average hash used to discard near-duplicates. */
export function templateFingerprint(image: GrayImage): Uint8Array {
  const size = 16;
  const samples = new Float32Array(size * size);
  let sum = 0;
  for (let y = 0; y < size; y++) {
    const sourceY = Math.min(image.height - 1, Math.floor(((y + 0.5) * image.height) / size));
    for (let x = 0; x < size; x++) {
      const sourceX = Math.min(image.width - 1, Math.floor(((x + 0.5) * image.width) / size));
      const value = image.data[sourceY * image.width + sourceX];
      samples[y * size + x] = value;
      sum += value;
    }
  }
  const average = sum / samples.length;
  const fingerprint = new Uint8Array(samples.length / 8);
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] >= average) fingerprint[i >> 3] |= 1 << (i & 7);
  }
  return fingerprint;
}

export function fingerprintDistance(left: Uint8Array, right: Uint8Array): number {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let i = 0; i < left.length; i++) {
    let value = left[i] ^ right[i];
    while (value) {
      value &= value - 1;
      distance++;
    }
  }
  return distance;
}

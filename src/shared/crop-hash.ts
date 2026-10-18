/**
 * Fast sampled FNV-1a hash of a BGRA crop. Samples roughly 1 in 64 pixels
 * (stride is a prime number of pixels so columns of UI do not alias), and
 * mixes in the dimensions. Deterministic and dependency-free.
 */
const PIXEL_STRIDE = 61;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function hashBgra(bgra: Uint8Array, width: number, height: number): number {
  let hash = FNV_OFFSET;
  hash = Math.imul(hash ^ (width & 0xffff), FNV_PRIME);
  hash = Math.imul(hash ^ (height & 0xffff), FNV_PRIME);
  hash = Math.imul(hash ^ ((width >>> 16) + (height >>> 16)), FNV_PRIME);
  const pixels = Math.min(Math.floor(bgra.length / 4), width * height);
  for (let pixel = 0; pixel < pixels; pixel += PIXEL_STRIDE) {
    const i = pixel * 4;
    hash = Math.imul(hash ^ bgra[i], FNV_PRIME);
    hash = Math.imul(hash ^ bgra[i + 1], FNV_PRIME);
    hash = Math.imul(hash ^ bgra[i + 2], FNV_PRIME);
  }
  return hash >>> 0;
}

/** Pixel indexes (not byte offsets) that hashBgra samples; exported for tests. */
export const CROP_HASH_PIXEL_STRIDE = PIXEL_STRIDE;

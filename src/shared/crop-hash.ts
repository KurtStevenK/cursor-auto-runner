/**
 * Full-coverage FNV-1a hash of a BGRA crop. The crop is downsampled 4x in
 * each axis (B+G+R summed per 4x4 block, edge blocks may be smaller) and every
 * block value is hashed, so any change covering at least one 4x4 block (for
 * example a small Run button) alters the hash. The dimensions are mixed in.
 * Deterministic and dependency-free.
 */
const BLOCK = 4;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function hashBgra(bgra: Uint8Array, width: number, height: number): number {
  let hash = FNV_OFFSET;
  hash = Math.imul(hash ^ (width & 0xffff), FNV_PRIME);
  hash = Math.imul(hash ^ (height & 0xffff), FNV_PRIME);
  hash = Math.imul(hash ^ ((width >>> 16) + (height >>> 16)), FNV_PRIME);
  const rows = Math.min(height, Math.floor(bgra.length / 4 / Math.max(width, 1)));
  const rowBytes = width * 4;
  for (let by = 0; by < rows; by += BLOCK) {
    const yEnd = Math.min(by + BLOCK, rows);
    for (let bx = 0; bx < width; bx += BLOCK) {
      const xEnd = Math.min(bx + BLOCK, width) * 4;
      let sum = 0;
      for (let y = by; y < yEnd; y++) {
        const base = y * rowBytes;
        for (let i = base + bx * 4; i < base + xEnd; i += 4) {
          sum += bgra[i] + bgra[i + 1] + bgra[i + 2];
        }
      }
      hash = Math.imul(hash ^ sum, FNV_PRIME);
    }
  }
  return hash >>> 0;
}

/**
 * Export NativeImage pixels as tight BGRA (width * height * 4 bytes).
 * Electron 44+ toBitmap() can use row stride or sRGB normalization that does
 * not match our worker's packed BGRA layout.
 */
import type { NativeImage } from 'electron';

export function expectedBgraByteLength(width: number, height: number): number {
  return width * height * 4;
}

/** Copy row-major BGRA when the source buffer uses a larger stride (bytes per row). */
export function repackBgraRows(
  source: Uint8Array,
  width: number,
  height: number,
  stride: number
): Uint8Array {
  const rowBytes = width * 4;
  const out = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const srcStart = y * stride;
    const dstStart = y * rowBytes;
    out.set(source.subarray(srcStart, srcStart + rowBytes), dstStart);
  }
  return out;
}

function copyToOwnedArrayBuffer(data: Uint8Array): ArrayBuffer {
  const owned = new Uint8Array(data.byteLength);
  owned.set(data);
  return owned.buffer;
}

function toBitmapBuffer(image: NativeImage): Buffer {
  return image.toBitmap();
}

export async function nativeImageToTightBgra(image: NativeImage): Promise<ArrayBuffer> {
  const { width, height } = image.getSize();
  const expected = expectedBgraByteLength(width, height);
  if (width < 1 || height < 1) {
    return new ArrayBuffer(0);
  }

  const bitmap = toBitmapBuffer(image);
  const bytes = new Uint8Array(bitmap.buffer, bitmap.byteOffset, bitmap.byteLength);

  if (bytes.byteLength === expected) {
    return copyToOwnedArrayBuffer(bytes);
  }

  if (height > 0 && bytes.byteLength % height === 0) {
    const stride = bytes.byteLength / height;
    if (stride >= width * 4) {
      return copyToOwnedArrayBuffer(repackBgraRows(bytes, width, height, stride));
    }
  }

  throw new Error(
    `Unexpected bitmap length ${bytes.byteLength} for ${width}x${height} image (expected ${expected})`
  );
}

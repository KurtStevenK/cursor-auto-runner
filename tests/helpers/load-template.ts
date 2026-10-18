import { Jimp } from 'jimp';
import { grayFromRgba, type GrayImage } from '../../src/main/matcher';

/** jimp-based template loader for tests and scripts (not shipped in the app). */
export async function loadTemplate(file: string): Promise<GrayImage> {
  const image = await Jimp.read(file);
  const { width, height } = image.bitmap;
  return grayFromRgba(image.bitmap.data, width, height);
}

/** Decode a PNG into tightly packed BGRA (the capture format the matcher expects). */
export async function loadBgraFixture(file: string): Promise<{
  width: number;
  height: number;
  bgra: Uint8Array;
}> {
  const image = await Jimp.read(file);
  const rgba = image.bitmap.data;
  const bgra = new Uint8Array(rgba.length);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    bgra[offset] = rgba[offset + 2];
    bgra[offset + 1] = rgba[offset + 1];
    bgra[offset + 2] = rgba[offset];
    bgra[offset + 3] = rgba[offset + 3];
  }
  return { width: image.bitmap.width, height: image.bitmap.height, bgra };
}

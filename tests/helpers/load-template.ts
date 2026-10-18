import { Jimp } from 'jimp';
import { grayFromRgba, type GrayImage } from '../../src/main/matcher';

/** jimp-based template loader for tests and scripts (not shipped in the app). */
export async function loadTemplate(file: string): Promise<GrayImage> {
  const image = await Jimp.read(file);
  const { width, height } = image.bitmap;
  return grayFromRgba(image.bitmap.data, width, height);
}

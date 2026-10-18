/** Electron-only template loader (main process). Tests use tests/helpers/load-template.ts. */
import { nativeImage } from 'electron';
import { grayFromBgra, type GrayImage } from './matcher';
import { nativeImageToTightBgra } from './native-image-bgra';

/** Load a PNG template as grayscale via Electron's decoder. */
export async function loadTemplateNative(file: string): Promise<GrayImage> {
  const image = nativeImage.createFromPath(file);
  const { width, height } = image.getSize();
  if (image.isEmpty() || width < 1 || height < 1) {
    throw new Error(`Could not decode template image: ${file}`);
  }
  const bgra = new Uint8Array(await nativeImageToTightBgra(image));
  return grayFromBgra(bgra, width, height);
}

/** Electron desktopCapturer-backed capture. Only loaded when the real app runs. */
import { desktopCapturer, screen as electronScreen } from 'electron';
import { captureRequestSize, captureToNativeScales } from '../capture-geometry';
import { ensureMacScreenCapture } from '../permissions';
import { nativeImageToTightBgra } from '../native-image-bgra';
import {
  windowKey,
  type CaptureResult,
  type CropContext,
  type DisplayInfo,
  type WindowInfo,
} from './types';

export interface CaptureProvider {
  captureCrops(
    windows: WindowInfo[],
    displays: DisplayInfo[],
    cancelled: () => boolean
  ): Promise<CaptureResult>;
  /** Per-window thumbnails at native size (macOS; experimental opt-in on Windows). Preferred over display crops. */
  captureWindowCrops?(
    windows: WindowInfo[],
    startId: number,
    cancelled: () => boolean
  ): Promise<CropContext[]>;
}

const MAX_CAPTURE_WIDTH = 1920;
const MAX_CAPTURE_HEIGHT = 1080;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function intersects(window: WindowInfo, display: DisplayInfo): boolean {
  const bounds = display.bounds;
  return (
    window.left < bounds.x + bounds.width &&
    window.left + window.width > bounds.x &&
    window.top < bounds.y + bounds.height &&
    window.top + window.height > bounds.y
  );
}

export class ElectronCaptureProvider implements CaptureProvider {
  private sourceForDisplay(
    sources: Electron.DesktopCapturerSource[],
    display: DisplayInfo
  ): Electron.DesktopCapturerSource | undefined {
    const exact = sources.find((candidate) => candidate.display_id === String(display.id));
    if (exact) return exact;
    if (sources.length === 1) return sources[0];

    // Some platforms omit display_id. An aspect-ratio fallback is safe only
    // when it identifies exactly one source; never guess between equal screens.
    const targetAspect = display.size.width / display.size.height;
    const aspectMatches = sources.filter((candidate) => {
      const size = candidate.thumbnail.getSize();
      return size.height > 0 && Math.abs(size.width / size.height - targetAspect) < 0.01;
    });
    if (aspectMatches.length === 1) {
      console.warn(`[detector] display ${display.id} matched by unique aspect ratio`);
      return aspectMatches[0];
    }
    return undefined;
  }

  private async screenSourcesForDisplay(
    display: DisplayInfo,
    requestSize: ReturnType<typeof captureRequestSize>
  ): Promise<Electron.DesktopCapturerSource[]> {
    await ensureMacScreenCapture();
    const thumbnailSize = { width: requestSize.width, height: requestSize.height };
    for (let attempt = 0; attempt < 3; attempt++) {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize,
      });
      const source = this.sourceForDisplay(sources, display);
      const size = source?.thumbnail.getSize();
      if (source && size && size.width >= 10 && size.height >= 10) return sources;
      if (attempt < 2) await sleep(150 * (attempt + 1));
    }
    console.warn(
      `[detector] screen thumbnail unavailable for display ${display.id}; check Screen Recording permission`
    );
    return await desktopCapturer.getSources({ types: ['screen'], thumbnailSize });
  }

  private windowSourceForTitle(
    sources: Electron.DesktopCapturerSource[],
    title: string
  ): Electron.DesktopCapturerSource | undefined {
    const exact = sources.find((source) => source.name === title);
    if (exact) return exact;
    const lower = title.toLowerCase();
    const partial = sources.filter((source) => {
      const name = source.name.toLowerCase();
      if (name === lower) return true;
      if (lower.length < 8 || name.length < 8) return false;
      return name.includes(lower) || lower.includes(name);
    });
    return partial.length === 1 ? partial[0] : undefined;
  }

  async captureWindowCrops(
    windows: WindowInfo[],
    startId: number,
    cancelled: () => boolean
  ): Promise<CropContext[]> {
    // macOS by default; opt-in and experimental on Windows (the detector gates it).
    if ((process.platform !== 'darwin' && process.platform !== 'win32') || windows.length === 0)
      return [];
    await ensureMacScreenCapture();
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: MAX_CAPTURE_WIDTH, height: MAX_CAPTURE_HEIGHT },
    });
    const crops: CropContext[] = [];
    for (const window of windows) {
      if (cancelled()) break;
      const source = this.windowSourceForTitle(sources, window.title);
      if (!source) continue;
      const thumbnail = source.thumbnail;
      const size = thumbnail.getSize();
      if (size.width < 10 || size.height < 10) continue;
      const display = electronScreen.getDisplayNearestPoint({
        x: window.left + window.width / 2,
        y: window.top + window.height / 2,
      });
      const captureScaleX = size.width / window.width;
      const captureScaleY = size.height / window.height;
      const nativeW = Math.max(1, Math.round(window.width * display.scaleFactor));
      const nativeH = Math.max(1, Math.round(window.height * display.scaleFactor));
      const templateScale = captureToNativeScales(size, { width: nativeW, height: nativeH });
      const id = startId + crops.length;
      crops.push({
        id,
        payload: {
          id,
          width: size.width,
          height: size.height,
          captureToNativeScaleX: templateScale.x,
          captureToNativeScaleY: templateScale.y,
          bgra: await nativeImageToTightBgra(thumbnail),
        },
        display,
        captureScaleX,
        captureScaleY,
        cropX: 0,
        cropY: 0,
        windowLogical: {
          left: window.left,
          top: window.top,
          width: window.width,
          height: window.height,
        },
        windowKey: windowKey(window),
        focus: window.focus,
      });
    }
    return crops;
  }

  async captureCrops(
    windows: WindowInfo[],
    displays: DisplayInfo[],
    cancelled: () => boolean
  ): Promise<CaptureResult> {
    const relevant = displays
      .map((display) => ({
        display,
        windows: windows.filter((window) => intersects(window, display)),
      }))
      .filter((entry) => entry.windows.length > 0);
    if (relevant.length === 0) return { crops: [], sourceMissCount: 0 };

    const crops: CropContext[] = [];
    const sourcesBySize = new Map<string, Electron.DesktopCapturerSource[]>();
    let sourceMissCount = 0;

    for (const entry of relevant) {
      if (cancelled()) break;
      const requestSize = captureRequestSize(entry.display, MAX_CAPTURE_WIDTH, MAX_CAPTURE_HEIGHT);
      const requestKey = `${requestSize.width}x${requestSize.height}`;
      let sources = sourcesBySize.get(requestKey);
      if (!sources) {
        sources = await this.screenSourcesForDisplay(entry.display, requestSize);
        sourcesBySize.set(requestKey, sources);
      }
      if (cancelled()) break;
      const source = this.sourceForDisplay(sources, entry.display);
      if (!source) {
        sourceMissCount++;
        console.warn(
          `[detector] no unambiguous screen source for display ${entry.display.id}; available IDs: ${sources
            .map((candidate) => candidate.display_id || '(empty)')
            .join(', ')}`
        );
        continue;
      }
      const thumbnail = source.thumbnail;
      const size = thumbnail.getSize();
      if (size.width < 10 || size.height < 10) {
        console.warn(
          `[detector] empty screen thumbnail on display ${entry.display.id} (${size.width}x${size.height})`
        );
        continue;
      }
      const scaleX = size.width / entry.display.bounds.width;
      const scaleY = size.height / entry.display.bounds.height;
      const templateScale = captureToNativeScales(size, {
        width: requestSize.nativeWidth,
        height: requestSize.nativeHeight,
      });

      for (const window of entry.windows) {
        if (cancelled()) break;
        const left = Math.max(window.left, entry.display.bounds.x);
        const top = Math.max(window.top, entry.display.bounds.y);
        const right = Math.min(
          window.left + window.width,
          entry.display.bounds.x + entry.display.bounds.width
        );
        const bottom = Math.min(
          window.top + window.height,
          entry.display.bounds.y + entry.display.bounds.height
        );
        const cropX = Math.max(0, Math.floor((left - entry.display.bounds.x) * scaleX));
        const cropY = Math.max(0, Math.floor((top - entry.display.bounds.y) * scaleY));
        const cropRight = Math.min(
          size.width,
          Math.ceil((right - entry.display.bounds.x) * scaleX)
        );
        const cropBottom = Math.min(
          size.height,
          Math.ceil((bottom - entry.display.bounds.y) * scaleY)
        );
        const width = cropRight - cropX;
        const height = cropBottom - cropY;
        if (width < 10 || height < 10) continue;

        const cropped = thumbnail.crop({ x: cropX, y: cropY, width, height });
        const croppedSize = cropped.getSize();
        const id = crops.length;
        crops.push({
          id,
          payload: {
            id,
            width: croppedSize.width,
            height: croppedSize.height,
            captureToNativeScaleX: templateScale.x,
            captureToNativeScaleY: templateScale.y,
            bgra: await nativeImageToTightBgra(cropped),
          },
          display: entry.display,
          captureScaleX: scaleX,
          captureScaleY: scaleY,
          cropX,
          cropY,
          windowKey: windowKey(window),
          focus: window.focus,
        });
      }
    }
    return { crops, sourceMissCount };
  }
}

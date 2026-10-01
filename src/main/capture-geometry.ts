export interface DisplayCaptureGeometry {
  bounds: { x: number; y: number; width: number; height: number };
  size: { width: number; height: number };
  scaleFactor: number;
}

export interface WindowRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CaptureRequestSize {
  width: number;
  height: number;
  nativeWidth: number;
  nativeHeight: number;
  downscale: number;
}

/** Fit a native display capture into one pixel budget without changing aspect. */
export function captureRequestSize(
  display: Pick<DisplayCaptureGeometry, 'size' | 'scaleFactor'>,
  maxWidth: number,
  maxHeight: number
): CaptureRequestSize {
  const nativeWidth = Math.max(1, Math.round(display.size.width * display.scaleFactor));
  const nativeHeight = Math.max(1, Math.round(display.size.height * display.scaleFactor));
  const downscale = Math.min(1, maxWidth / nativeWidth, maxHeight / nativeHeight);
  return {
    width: Math.max(1, Math.round(nativeWidth * downscale)),
    height: Math.max(1, Math.round(nativeHeight * downscale)),
    nativeWidth,
    nativeHeight,
    downscale,
  };
}

export function captureToNativeScales(
  capture: { width: number; height: number },
  native: { width: number; height: number }
): { x: number; y: number } {
  return {
    x: capture.width / native.width,
    y: capture.height / native.height,
  };
}

/**
 * On macOS Retina, nut.js may report window bounds in physical pixels while
 * Electron display bounds stay logical. Detect physical-sized regions and scale
 * them down to logical space for screen-crop math.
 */
export function normalizeWindowRegionForDisplay(
  region: WindowRegion,
  display: Pick<DisplayCaptureGeometry, 'bounds' | 'size' | 'scaleFactor'>
): WindowRegion {
  const scale = display.scaleFactor;
  if (scale <= 1) return region;
  const logicalW = display.bounds.width;
  const logicalH = display.bounds.height;
  if (region.width <= logicalW + 8 && region.height <= logicalH + 8) return region;
  if (region.width > logicalW * 1.2 || region.height > logicalH * 1.2) {
    return {
      left: Math.round(region.left / scale),
      top: Math.round(region.top / scale),
      width: Math.round(region.width / scale),
      height: Math.round(region.height / scale),
    };
  }
  return region;
}

/** Map a match inside a per-window capture back to nut.js physical coordinates. */
export function windowCapturePointToPhysical(
  windowLogical: WindowRegion,
  display: Pick<DisplayCaptureGeometry, 'scaleFactor'>,
  captureScale: { x: number; y: number },
  point: { x: number; y: number }
): { x: number; y: number } {
  const logicalX = windowLogical.left + point.x / captureScale.x;
  const logicalY = windowLogical.top + point.y / captureScale.y;
  return {
    x: Math.round(logicalX * display.scaleFactor),
    y: Math.round(logicalY * display.scaleFactor),
  };
}

/** Map a point in a display thumbnail back to nut.js physical coordinates. */
export function capturePointToPhysical(
  display: Pick<DisplayCaptureGeometry, 'bounds' | 'scaleFactor'>,
  captureScale: { x: number; y: number },
  point: { x: number; y: number }
): { x: number; y: number } {
  const logicalX = display.bounds.x + point.x / captureScale.x;
  const logicalY = display.bounds.y + point.y / captureScale.y;
  return {
    x: Math.round(logicalX * display.scaleFactor),
    y: Math.round(logicalY * display.scaleFactor),
  };
}

export interface DisplayCaptureGeometry {
  bounds: { x: number; y: number; width: number; height: number };
  size: { width: number; height: number };
  scaleFactor: number;
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

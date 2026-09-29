/**
 * Icon generator for Cursor Auto Runner (pure Node, no Electron needed).
 * Run with: npm run generate:icons
 *
 * Software-rasterizes the logo at every needed size (4x supersampled AA),
 * writes PNGs, packs the Windows .ico and macOS tray template images.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'assets', 'icons');
const TRAY_OUT = path.join(OUT, 'tray');

// ---------- geometry helpers ----------
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const outX = Math.max(qx, 0), outY = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(outX, outY) - r;
}

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------- logo definition (256x256 viewBox) ----------
const TRIANGLE = [[96, 76], [176, 128], [96, 180]];
const BOLT = [[212, 34], [174, 98], [200, 98], [164, 168], [212, 94], [184, 94]];

/**
 * Returns [r,g,b,a] for a point in the 256x256 viewBox.
 * accent/bg may be null (-> transparent) e.g. for monochrome template icons.
 */
function sampleLogo(x, y, { accent = [34, 197, 94], bg = [15, 23, 42], fg = [248, 250, 252], monochrome = false } = {}) {
  const withAlpha = (c) => [c[0], c[1], c[2], 255];
  const borderSd = sdRoundRect(x, y, 128, 128, 120, 120, 56);
  if (borderSd > 0) return [0, 0, 0, 0]; // outside
  const innerSd = sdRoundRect(x, y, 128, 128, 113, 113, 50);
  if (innerSd > 0) return monochrome ? [0, 0, 0, 255] : withAlpha(accent); // border ring
  if (monochrome) {
    const shape = pointInPolygon(x, y, TRIANGLE) || pointInPolygon(x, y, BOLT);
    return shape ? [0, 0, 0, 255] : [0, 0, 0, 0];
  }
  if (pointInPolygon(x, y, BOLT)) return withAlpha(accent);
  if (pointInPolygon(x, y, TRIANGLE)) return withAlpha(fg);
  return withAlpha(bg);
}

// ---------- PNG encoding ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function rasterize(size, opts) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 4; // supersampling
  const scale = 256 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) * scale;
          const py = (y + (sy + 0.5) / SS) * scale;
          const [pr, pg, pb, pa] = sampleLogo(px, py, opts);
          // "over" composite for the subsample
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      if (a > 0) {
        buf[o] = Math.round(r / a);
        buf[o + 1] = Math.round(g / a);
        buf[o + 2] = Math.round(b / a);
      }
      buf[o + 3] = Math.round(a / n);
    }
  }
  return encodePng(size, size, buf);
}

// ---------- ICO packing (PNG-compressed) ----------
function packIco(entries) {
  const count = entries.length;
  const headerSize = 6 + 16 * count;
  let offset = headerSize;
  const chunks = [];
  for (const { size, data } of entries) {
    const head = Buffer.alloc(16);
    head.writeUInt8(size >= 256 ? 0 : size, 0);
    head.writeUInt8(size >= 256 ? 0 : size, 1);
    head.writeUInt16LE(1, 4);
    head.writeUInt16LE(32, 6);
    head.writeUInt32LE(data.length, 8);
    head.writeUInt32LE(offset, 12);
    offset += data.length;
    chunks.push(head, data);
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(count, 2);
  return Buffer.concat([header, ...chunks]);
}

// ---------- main ----------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function main() {
  fs.mkdirSync(TRAY_OUT, { recursive: true });

  const appOpts = { accent: hex('#22c55e'), bg: hex('#0f172a'), fg: hex('#f8fafc') };

  // App icon set
  const png256 = rasterize(256, appOpts);
  for (const size of [16, 24, 32, 48, 64, 128, 256]) {
    fs.writeFileSync(path.join(OUT, `icon-${size}.png`), size === 256 ? png256 : rasterize(size, appOpts));
    console.log(`icon-${size}.png written`);
  }
  fs.writeFileSync(
    path.join(OUT, 'icon.ico'),
    packIco([16, 32, 48, 64, 256].map((size) => ({
      size,
      data: size === 256 ? png256 : fs.readFileSync(path.join(OUT, `icon-${size}.png`)),
    })))
  );
  fs.writeFileSync(path.join(OUT, 'icon.png'), png256);
  console.log('icon.ico + icon.png written');

  // Tray icons (one per app state) + macOS monochrome template variants
  const states = {
    'tray-idle': { ...appOpts, accent: hex('#94a3b8') },
    'tray-run': { ...appOpts, accent: hex('#22c55e') },
    'tray-always': { ...appOpts, accent: hex('#3b82f6') },
  };
  for (const [name, opts] of Object.entries(states)) {
    for (const size of [16, 32]) {
      fs.writeFileSync(path.join(TRAY_OUT, `${size === 32 ? '@2x' : ''}${name}.png`), rasterize(size, opts));
    }
    console.log(`${name} written`);
  }
  for (const size of [16, 32]) {
    fs.writeFileSync(
      path.join(TRAY_OUT, `${size === 32 ? '@2x' : ''}tray-template.png`),
      rasterize(size, { monochrome: true })
    );
  }
  console.log('tray-template (macOS) written');
}

main();

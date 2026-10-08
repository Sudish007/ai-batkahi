// Bakes the paper-grain tile public/grain.png as a raster PNG (grayscale+alpha,
// sparse speckle). Pure Node (zlib deflate + crc32, Node >= 22.2), deterministic
// seed, no canvas, no SVG filters. One mid-grey tile serves both themes.
// Usage: node scripts/make-grain.mjs [out.png] [size] [density] [maxAlpha]
import { writeFileSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";
import { fileURLToPath } from "node:url";

// mulberry32: tiny seeded PRNG so the tile is reproducible across builds.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

// density: fraction of pixels that are specks; maxAlpha: 0..255 speck opacity cap.
export function makeGrain({ size = 256, density = 0.12, maxAlpha = 12, seed = 20261008 } = {}) {
  const rand = rng(seed);
  // Colour type 4 = grayscale + alpha, 8-bit: 2 bytes per pixel + 1 filter byte per row.
  const raw = Buffer.alloc(size * (1 + size * 2));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 2);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 2;
      raw[i] = 128; // mid grey: darkens paper, lightens night
      raw[i + 1] = rand() < density ? 4 + Math.floor(rand() * (maxAlpha - 3)) : 0;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 4; // colour type: grayscale + alpha
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// CLI only when executed directly (not when imported by tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = process.argv[2] || "grain.png";
  const opts = {};
  if (process.argv[3]) opts.size = Number(process.argv[3]);
  if (process.argv[4]) opts.density = Number(process.argv[4]);
  if (process.argv[5]) opts.maxAlpha = Number(process.argv[5]);
  const png = makeGrain(opts);
  writeFileSync(out, png);
  console.log(`${out}: ${opts.size || 256}x${opts.size || 256}, ${png.length} bytes`);
}

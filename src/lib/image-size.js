// Image dimensions from file headers (PNG, JPEG, WebP) so the build can emit
// <img width height> and avoid layout shift. No decoding, header bytes only.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(b) {
  return b.length >= 24 && PNG_SIGNATURE.every((byte, i) => b[i] === byte);
}

function pngSize(b) {
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function isJpeg(b) {
  return b.length >= 4 && b[0] === 0xff && b[1] === 0xd8;
}

// Walk the segment chain to the first SOF marker (C0–CF except C4, C8, CC).
function jpegSize(b) {
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) throw new Error("unsupported image");
    // Padding: any number of FF bytes may precede a marker.
    while (i < b.length && b[i] === 0xff) i += 1;
    if (i >= b.length) break;
    const marker = b[i];
    i += 1;
    // Stand-alone markers without a length (EOI, escaped FF, restart markers).
    if (marker === 0xd9 || marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (i + 2 > b.length) break;
    const length = b.readUInt16BE(i);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (i + 7 > b.length) break;
      return { height: b.readUInt16BE(i + 3), width: b.readUInt16BE(i + 5) };
    }
    i += length;
  }
  throw new Error("unsupported image");
}

function isWebp(b) {
  return b.length >= 25 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP";
}

function webpSize(b) {
  const chunk = b.toString("latin1", 12, 16);
  if (chunk === "VP8 " && b.length >= 30) {
    return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
  }
  if (chunk === "VP8L") {
    return {
      width: 1 + (b[21] | ((b[22] & 0x3f) << 8)),
      height: 1 + ((b[22] >> 6) | (b[23] << 2) | ((b[24] & 0x0f) << 10)),
    };
  }
  if (chunk === "VP8X") {
    return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  }
  throw new Error("unsupported image");
}

export function imageSize(buffer) {
  const b = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (isPng(b)) return pngSize(b);
  if (isJpeg(b)) return jpegSize(b);
  if (isWebp(b)) return webpSize(b);
  throw new Error("unsupported image");
}

// Dotfiles (content/images/.gitkeep) are not images and are skipped silently.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// { "/images/<posix relative path>": { width, height } } for every readable
// image under dir (content/images). Unreadable files are skipped with a warning
// so a stray non-image never breaks the build; a missing dir yields {}.
export function imageManifest(dir) {
  const manifest = {};
  if (!existsSync(dir)) return manifest;
  for (const file of walk(dir)) {
    const rel = relative(dir, file).split("\\").join("/");
    try {
      manifest[`/images/${rel}`] = imageSize(readFileSync(file));
    } catch {
      console.log(`warn: unreadable image: ${rel}`);
    }
  }
  return manifest;
}

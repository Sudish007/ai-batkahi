import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { imageSize, imageManifest } from "../src/lib/image-size.js";

// --- minimal header fixtures ------------------------------------------------

function u32be(n) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}
function u16be(n) {
  return [(n >>> 8) & 0xff, n & 0xff];
}
function u16le(n) {
  return [n & 0xff, (n >>> 8) & 0xff];
}
function u24le(n) {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff];
}
function ascii(s) {
  return [...s].map((c) => c.charCodeAt(0));
}

function png(width, height) {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // signature
    ...u32be(13), ...ascii("IHDR"), // IHDR length + type
    ...u32be(width), ...u32be(height),
    8, 6, 0, 0, 0, // bit depth, colour type, compression, filter, interlace
    0, 0, 0, 0, // CRC (not checked)
  ]);
}

// SOI, APP0 (JFIF) segment, then a SOF segment with the given marker.
function jpeg(width, height, sofMarker) {
  const app0 = [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const sof = [8, ...u16be(height), ...u16be(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, ...u16be(app0.length + 2), ...app0,
    0xff, 0xff, // padding FF before the next marker
    0xff, sofMarker, ...u16be(sof.length + 2), ...sof,
    0xff, 0xd9,
  ]);
}

function riff(chunkType, payload) {
  const body = [...ascii("WEBP"), ...ascii(chunkType), ...u32be(payload.length).reverse(), ...payload];
  return Buffer.from([...ascii("RIFF"), ...u32be(body.length).reverse(), ...body]);
}

function webpVp8(width, height) {
  // 3-byte frame tag, 3-byte start code 9d 01 2a, then 14-bit width/height (LE).
  return riff("VP8 ", [0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, ...u16le(width), ...u16le(height), 0, 0, 0, 0]);
}

function webpVp8l(width, height) {
  const w = width - 1;
  const h = height - 1;
  const bits = w | (h << 14); // 14 bits each, then alpha + version bits (zero)
  return riff("VP8L", [0x2f, bits & 0xff, (bits >>> 8) & 0xff, (bits >>> 16) & 0xff, (bits >>> 24) & 0xff, 0, 0, 0]);
}

function webpVp8x(width, height) {
  return riff("VP8X", [0x10, 0, 0, 0, ...u24le(width - 1), ...u24le(height - 1), 0, 0, 0, 0]);
}

// --- imageSize ----------------------------------------------------------------

test("PNG IHDR", () => {
  assert.deepEqual(imageSize(png(640, 480)), { width: 640, height: 480 });
});

test("baseline JPEG (SOF0 after APP0 and padding)", () => {
  assert.deepEqual(imageSize(jpeg(320, 200, 0xc0)), { width: 320, height: 200 });
});

test("progressive JPEG (SOF2)", () => {
  assert.deepEqual(imageSize(jpeg(1024, 768, 0xc2)), { width: 1024, height: 768 });
});

test("JPEG without a SOF marker throws", () => {
  assert.throws(() => imageSize(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xd9])), /unsupported image/);
});

test("WebP VP8 (lossy)", () => {
  assert.deepEqual(imageSize(webpVp8(1600, 1200)), { width: 1600, height: 1200 });
});

test("WebP VP8L (lossless)", () => {
  assert.deepEqual(imageSize(webpVp8l(100, 50)), { width: 100, height: 50 });
});

test("WebP VP8X (extended)", () => {
  assert.deepEqual(imageSize(webpVp8x(2560, 1440)), { width: 2560, height: 1440 });
});

test("text buffer throws 'unsupported image'", () => {
  assert.throws(() => imageSize(Buffer.from("hello, not an image at all, really")), /unsupported image/);
  assert.throws(() => imageSize(Buffer.alloc(0)), /unsupported image/);
});

test("accepts a Uint8Array as well as a Buffer", () => {
  assert.deepEqual(imageSize(new Uint8Array(png(3, 4))), { width: 3, height: 4 });
});

// --- imageManifest ------------------------------------------------------------

const dir = mkdtempSync(join(tmpdir(), "batkahi-images-"));
after(() => rmSync(dir, { recursive: true, force: true }));

test("imageManifest keys by /images/<posix relative path>", () => {
  mkdirSync(join(dir, "post-a"));
  writeFileSync(join(dir, "post-a", "hero.png"), png(640, 480));
  writeFileSync(join(dir, ".gitkeep"), "");
  const manifest = imageManifest(dir);
  assert.deepEqual(manifest, { "/images/post-a/hero.png": { width: 640, height: 480 } });
});

test("imageManifest skips unreadable files with a warning", () => {
  writeFileSync(join(dir, "notes.txt"), "not an image");
  const lines = [];
  const original = console.log;
  console.log = (...a) => lines.push(a.join(" "));
  let manifest;
  try {
    manifest = imageManifest(dir);
  } finally {
    console.log = original;
  }
  assert.deepEqual(Object.keys(manifest), ["/images/post-a/hero.png"]);
  assert.deepEqual(lines, ["warn: unreadable image: notes.txt"]);
});

test("imageManifest on a missing dir returns {}", () => {
  assert.deepEqual(imageManifest(join(dir, "does-not-exist")), {});
});

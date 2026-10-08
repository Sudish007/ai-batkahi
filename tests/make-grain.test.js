import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeGrain } from "../scripts/make-grain.mjs";
import { ROOT } from "./helpers.js";

const png = makeGrain();

test("grain tile is a valid 256x256 8-bit grayscale+alpha PNG", () => {
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.subarray(12, 16).toString("latin1"), "IHDR");
  assert.equal(png.readUInt32BE(16), 256, "width");
  assert.equal(png.readUInt32BE(20), 256, "height");
  assert.equal(png[24], 8, "bit depth");
  assert.equal(png[25], 4, "colour type grayscale+alpha");
});

test("grain tile stays small", () => {
  assert.ok(png.length <= 12 * 1024, `${png.length} bytes`);
});

test("committed public/grain.png equals the generator output", () => {
  const committed = readFileSync(join(ROOT, "public", "grain.png"));
  assert.equal(committed.length, 11445);
  assert.ok(png.equals(committed));
});

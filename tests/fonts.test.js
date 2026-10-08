import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { DIST, htmlFiles, read } from "./helpers.js";

const css = read(join(DIST, "styles.css"));
const distFonts = readdirSync(join(DIST, "fonts")).filter((f) => f.endsWith(".woff2")).sort();

test("six font faces load with font-display: optional, none with swap", () => {
  assert.equal((css.match(/font-display:\s*optional;/g) || []).length, 6);
  assert.equal((css.match(/font-display:\s*swap/g) || []).length, 0);
  assert.equal((css.match(/@font-face/g) || []).length, 6);
});

test("the CSS url() font set equals the files shipped in dist/fonts", () => {
  const urls = [...css.matchAll(/url\(([^)]+\.woff2)\)/g)].map((m) => basename(m[1].replace(/["']/g, "")));
  assert.deepEqual([...new Set(urls)].sort(), distFonts);
  assert.equal(distFonts.length, 6);
});

test("every page preloads exactly the six shipped font files", () => {
  for (const file of htmlFiles()) {
    const html = read(file);
    const preloads = [...html.matchAll(/<link rel="preload"[^>]*>/g)].map((m) => m[0]);
    const fontPreloads = preloads.filter((l) => /\bas="font"/.test(l));
    assert.equal(fontPreloads.length, 6, `${file}: font preloads`);
    const names = fontPreloads.map((l) => {
      assert.match(l, /type="font\/woff2"/, file);
      assert.match(l, /\bcrossorigin\b/, file);
      return basename(l.match(/href="([^"]+)"/)[1]);
    });
    assert.deepEqual(names.sort(), distFonts, file);
  }
});

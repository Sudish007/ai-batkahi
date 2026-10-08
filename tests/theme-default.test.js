import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { DIST, htmlFiles, read } from "./helpers.js";

const css = read(join(DIST, "styles.css"));

test("stylesheet never reads the OS colour scheme and has no light override", () => {
  assert.ok(!css.includes("prefers-color-scheme"));
  assert.ok(!css.includes('[data-theme="light"]'));
});

test(":root is light by default and :root[data-theme=dark] is dark", () => {
  const rootBlock = css.match(/\n:root\s*\{([^}]*)\}/);
  assert.ok(rootBlock, ":root block");
  assert.match(rootBlock[1], /color-scheme:\s*light;/);
  const darkBlock = css.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/);
  assert.ok(darkBlock, "dark block");
  assert.match(darkBlock[1], /color-scheme:\s*dark;/);
});

test("every page declares light metas and a storage-only pre-paint script", () => {
  for (const file of htmlFiles()) {
    const html = read(file);
    const scheme = html.match(/<meta name="color-scheme"[^>]*>/g) || [];
    assert.equal(scheme.length, 1, `${file}: color-scheme metas`);
    assert.match(scheme[0], /content="light"/, file);
    const themeColor = html.match(/<meta name="theme-color"[^>]*>/g) || [];
    assert.equal(themeColor.length, 1, `${file}: theme-color metas`);
    assert.match(themeColor[0], /content="#FAF6EF"/, file);
    assert.ok(!/<meta name="theme-color"[^>]*media=/.test(html), `${file}: media-gated theme-color`);
    const inline = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(inline, `${file}: inline script`);
    assert.ok(inline[1].includes('localStorage.getItem("theme")'), file);
    assert.ok(!inline[1].includes("matchMedia"), `${file}: inline script reads matchMedia`);
    // metas must precede the script so it can rewrite them for a stored dark choice
    assert.ok(html.indexOf('<meta name="theme-color"') < html.indexOf("<script>"), `${file}: meta order`);
  }
});

test("main.js never reads prefers-color-scheme", () => {
  const js = read(join(DIST, "main.js"));
  assert.ok(!js.includes("prefers-color-scheme"));
});

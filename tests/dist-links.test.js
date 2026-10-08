import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import config from "../site.config.js";
import { DIST, htmlFiles, read } from "./helpers.js";

const base = config.basePath;

function resolveInternal(href) {
  const clean = href.split("#")[0].split("?")[0];
  if (clean === "") return true; // same-page fragment
  if (!clean.startsWith(base)) return false;
  const rel = clean.slice(base.length);
  let target = join(DIST, rel);
  if (!existsSync(target)) return false;
  if (statSync(target).isDirectory()) {
    target = join(target, "index.html");
    return existsSync(target);
  }
  return true;
}

test("every internal href/src in dist resolves to a file and is basePath-prefixed", () => {
  const files = htmlFiles();
  assert.ok(files.length >= 10, "expected at least 10 html pages");
  const failures = [];
  for (const file of files) {
    const html = read(file);
    for (const m of html.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
      const value = m[1];
      if (/^(https?:|mailto:|data:|#)/.test(value)) continue;
      if (!resolveInternal(value)) {
        failures.push(`${relative(DIST, file)} -> ${value}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test("no root-absolute links that bypass basePath", () => {
  const offenders = [];
  for (const file of htmlFiles()) {
    const html = read(file);
    for (const m of html.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)) {
      if (!m[1].startsWith(base)) offenders.push(`${relative(DIST, file)} -> ${m[1]}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("styles.css font urls are basePath-prefixed and resolve", () => {
  const css = read(join(DIST, "styles.css"));
  assert.ok(!css.includes("__BASE__"), "token not rewritten");
  const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/["']/g, ""));
  assert.ok(urls.length >= 6);
  for (const u of urls) {
    assert.ok(u.startsWith(base), `css url not under basePath: ${u}`);
    assert.ok(existsSync(join(DIST, u.slice(base.length))), `missing font: ${u}`);
  }
});

test("external links carry rel=noopener", () => {
  for (const file of htmlFiles()) {
    const html = read(file);
    for (const m of html.matchAll(/<a\s+([^>]*href="https?:\/\/[^"]*"[^>]*)>/g)) {
      assert.match(m[1], /rel="[^"]*noopener/, `${relative(DIST, file)}: ${m[0].slice(0, 80)}`);
    }
  }
});

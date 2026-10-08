import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { DIST, htmlFiles, read } from "./helpers.js";

const postDirs = readdirSync(join(DIST, "posts"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

test("there are six post pages", () => {
  assert.equal(postDirs.length, 6);
});

for (const slug of postDirs) {
  test(`post ${slug}: lang attributes, single h1, computed reading time`, () => {
    const html = read(join(DIST, "posts", slug, "index.html"));
    assert.match(html, /<html lang="bho">/);
    assert.match(html, /<p class="title-en" lang="en">/);
    assert.match(html, /<section class="in-english" lang="en"/);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
    assert.match(html, /पढ़े में ~\d+ मिनट/);
    assert.match(html, /<article/);
    assert.match(html, /<time datetime="\d{4}-\d{2}-\d{2}">/);
  });
}

test("every page has exactly one h1, lang=bho, landmarks and a skip link", () => {
  for (const file of htmlFiles()) {
    const html = read(file);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, file);
    assert.match(html, /<html lang="bho">/, file);
    for (const tag of ["<header", "<nav", "<main", "<footer"]) {
      assert.ok(html.includes(tag), `${file} missing ${tag}`);
    }
    assert.match(html, /class="skip-link" href="#main"/, file);
    assert.match(html, /<main id="main"/, file);
  }
});

test("heading levels never skip on any page", () => {
  for (const file of htmlFiles()) {
    const html = read(file);
    const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    let prev = 0;
    for (const lv of levels) {
      assert.ok(lv <= prev + 1, `${file}: h${prev} -> h${lv}`);
      prev = lv;
    }
  }
});

test("inline svg marks are aria-hidden and imgs have alt", () => {
  for (const file of htmlFiles()) {
    const html = read(file);
    for (const m of html.matchAll(/<svg\b[^>]*>/g)) {
      assert.match(m[0], /aria-hidden="true"/, file);
    }
    for (const m of html.matchAll(/<img\b[^>]*>/g)) {
      assert.match(m[0], /\salt="[^"]*"/, file);
    }
  }
});

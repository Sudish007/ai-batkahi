import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DIST, htmlFiles, read } from "./helpers.js";

test("zero-post category (khabar) has no page and is not in nav or filters", () => {
  assert.ok(!existsSync(join(DIST, "category", "khabar")));
  for (const slug of ["samajh", "aujaar", "raasta"]) {
    assert.ok(existsSync(join(DIST, "category", slug, "index.html")), slug);
  }
  const postsIndex = read(join(DIST, "posts", "index.html"));
  assert.ok(!postsIndex.includes('data-filter="khabar"'));
  assert.ok(!postsIndex.includes("/category/khabar/"));
});

test("site nav has at most 5 items and no emoji", () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const file of htmlFiles()) {
    const html = read(file);
    const nav = html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/);
    assert.ok(nav, file);
    const items = (nav[0].match(/<li>/g) || []).length;
    assert.ok(items <= 5, `${file}: ${items} nav items`);
    const chrome = html.replace(/<main[\s\S]*<\/main>/, "");
    assert.ok(!emoji.test(chrome), `${file}: emoji in chrome`);
  }
});

test("home links to Instagram with the handle and has the honest intro", () => {
  const home = read(join(DIST, "index.html"));
  assert.ok(home.includes('href="https://www.instagram.com/batkahi/"'));
  assert.ok(home.includes("@batkahi"));
  assert.ok(home.includes("अक्टूबर 2026"));
  assert.ok(home.includes("नया बतकही"));
});

test("no page contains placeholder or fake-social text", () => {
  const banned = [/lorem/i, /coming soon/i, /follower/i, /trusted by/i, /testimonial/i];
  for (const file of htmlFiles()) {
    const html = read(file);
    for (const re of banned) assert.ok(!re.test(html), `${file} matches ${re}`);
  }
});

test("footer has copyright, Instagram, feed and BhojVerse links", () => {
  const home = read(join(DIST, "index.html"));
  assert.ok(home.includes("© 2026 AI Batkahi · Sudish Kumar"));
  assert.ok(home.includes('href="/ai-batkahi/feed.xml"'));
  assert.ok(home.includes("https://sudish007.github.io/bhojverse-site/"));
});

test("post pages have share controls, tags and prev/next where applicable", () => {
  const post = read(join(DIST, "posts", "llm-kaise-bolela", "index.html"));
  assert.match(post, /<div class="share" hidden>/);
  assert.match(post, /class="copy-link">लिंक कॉपी करीं</);
  assert.match(post, /<ul class="tags"/);
  assert.match(post, /<nav class="post-nav"/);
  assert.match(post, /rel="prev"/);
  assert.match(post, /rel="next"/);
});

test("about page states owner facts without invented claims", () => {
  const about = read(join(DIST, "about", "index.html"));
  assert.ok(about.includes("Sudish Kumar"));
  assert.ok(about.includes("https://github.com/Sudish007"));
  assert.ok(about.includes("https://sudish.dev"));
  assert.ok(about.includes("BhojVerse"));
});

test("404 page exists with Bhojpuri message and noindex", () => {
  const nf = read(join(DIST, "404.html"));
  assert.ok(nf.includes("ई पन्ना नइखे मिलल।"));
  assert.match(nf, /name="robots" content="noindex"/);
});

test("per-page HTML+CSS+JS stays under 100 KB", () => {
  const css = Buffer.byteLength(read(join(DIST, "styles.css")));
  const js = Buffer.byteLength(read(join(DIST, "main.js")));
  for (const file of htmlFiles()) {
    const total = Buffer.byteLength(read(file)) + css + js;
    assert.ok(total <= 100 * 1024, `${file}: ${total} bytes`);
  }
});

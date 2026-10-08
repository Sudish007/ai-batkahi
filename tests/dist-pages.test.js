import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import config from "../site.config.js";
import categories from "../content/categories.js";
import { DIST, htmlFiles, read, contentPosts, activeCategorySlugs } from "./helpers.js";

test("a category has a page, filter chip and links iff it has a post", () => {
  const active = new Set(activeCategorySlugs());
  const postsIndex = read(join(DIST, "posts", "index.html"));
  for (const { slug } of categories) {
    const isActive = active.has(slug);
    assert.equal(existsSync(join(DIST, "category", slug, "index.html")), isActive, `${slug} page`);
    assert.equal(postsIndex.includes(`data-filter="${slug}"`), isActive, `${slug} filter`);
    assert.equal(postsIndex.includes(`/category/${slug}/`), isActive, `${slug} link`);
  }
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

test("about page labels zero-post pillars as plain text, never a link", () => {
  const about = read(join(DIST, "about", "index.html"));
  const active = new Set(activeCategorySlugs());
  const inactive = categories.filter((c) => !active.has(c.slug));
  const notes = (about.match(/<span class="pillar-note">अबहीं पोस्ट नइखे<\/span>/g) || []).length;
  assert.equal(notes, inactive.length, "one note per inactive pillar");
  for (const { slug, name } of categories) {
    assert.equal(about.includes(`category/${slug}/`), active.has(slug), `${slug} link`);
    if (!active.has(slug)) {
      assert.ok(about.includes(`<dt>${name} <span class="pillar-note">अबहीं पोस्ट नइखे</span>`), `${slug} plain text`);
    }
  }
});

test("summary verb fix: no 'लगावेले' on home or posts index", () => {
  for (const rel of ["index.html", join("posts", "index.html")]) {
    assert.ok(!read(join(DIST, rel)).includes("लगावेले"), rel);
  }
});

test("search.json is the v1 index of every non-draft post", () => {
  const index = JSON.parse(read(join(DIST, "search.json")));
  const keys = ["slug", "url", "title", "title_en", "summary", "summary_en", "category", "categoryName", "tags", "date", "minutes"];
  assert.equal(index.v, 1);
  assert.equal(index.posts.length, contentPosts().length);
  for (const entry of index.posts) {
    assert.deepEqual(Object.keys(entry).sort(), [...keys].sort(), entry.slug);
    assert.ok(entry.url.startsWith(config.basePath), entry.url);
  }
});

test("404 page exists with Bhojpuri message and noindex", () => {
  const nf = read(join(DIST, "404.html"));
  assert.ok(nf.includes("ई पन्ना नइखे मिलल।"));
  assert.match(nf, /name="robots" content="noindex"/);
});

test("size budgets: styles.css and main.js <= 60 KB, per-page HTML+CSS+JS <= 150 KB", () => {
  const css = Buffer.byteLength(read(join(DIST, "styles.css")));
  const js = Buffer.byteLength(read(join(DIST, "main.js")));
  assert.ok(css <= 60 * 1024, `styles.css: ${css} bytes`);
  assert.ok(js <= 60 * 1024, `main.js: ${js} bytes`);
  for (const file of htmlFiles()) {
    const total = Buffer.byteLength(read(file)) + css + js;
    assert.ok(total <= 150 * 1024, `${file}: ${total} bytes`);
  }
});

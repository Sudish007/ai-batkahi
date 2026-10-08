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

test("home hero: display h1, kinetic slot without aria-label, computed facts", () => {
  const home = read(join(DIST, "index.html"));
  assert.match(home, /<h1 class="display" id="site-title">एआई बतकही<span class="visually-hidden"> — AI Batkahi<\/span><\/h1>/);
  const slotTag = home.match(/<button class="slot"[^>]*>/);
  assert.ok(slotTag, "slot button");
  assert.ok(!/aria-label/.test(slotTag[0]), "slot must not carry aria-label");
  assert.match(slotTag[0], /aria-describedby="slot-hint"/);
  assert.match(slotTag[0], /\bdisabled\b/);
  const items = home.match(/<span class="slot-item"[^>]*>/g) || [];
  assert.equal(items.length, config.heroWords.length);
  assert.equal(items.length, 6);
  assert.match(items[0], / data-on>/);
  for (const it of items.slice(1)) assert.ok(!/data-on/.test(it));
  assert.ok(home.includes('<span class="visually-hidden" id="slot-hint">अगिला शब्द खातिर दबाईं</span>'));
  assert.ok(home.includes('<a class="scroll-cue" href="#latest">'));
  const facts = home.match(/<p class="hero-facts">([\s\S]*?)<\/p>/);
  assert.ok(facts, "hero-facts");
  assert.ok(facts[1].includes(`<span>${contentPosts().length} बतकही</span>`));
  assert.ok(facts[1].includes(`<span>${activeCategorySlugs().length} विषय</span>`));
  assert.ok(facts[1].includes(`<span lang="en">${config.instagramHandle}</span>`));
});

test("home sections: bento grid, pillar strip with real counts, Instagram aside", () => {
  const home = read(join(DIST, "index.html"));
  assert.ok(!home.includes("चार विषय"), "no literal pillar count on home");
  assert.ok(home.includes("सब बतकही देखीं"));
  assert.ok(home.includes('<ul class="post-grid bento">'));
  assert.equal((home.match(/<li class="post-item reveal" data-category="/g) || []).length, contentPosts().length);
  assert.ok(!/post-index/.test(home), "no decorative index numerals");
  const vishay = home.match(/<ul class="vishay">([\s\S]*?)<\/ul>/);
  assert.ok(vishay, "ul.vishay");
  const cells = vishay[1].match(/<li class="reveal"><a href="[^"]*\/category\//g) || [];
  assert.equal(cells.length, activeCategorySlugs().length);
  const posts = contentPosts();
  for (const slug of activeCategorySlugs()) {
    const n = posts.filter(({ data }) => data.category === slug).length;
    const cell = vishay[1].match(new RegExp(`/category/${slug}/"[\\s\\S]*?</li>`));
    assert.ok(cell, `${slug} cell`);
    assert.ok(cell[0].includes(`<p class="vishay-count">${n} बतकही</p>`), `${slug} count`);
  }
  assert.ok(home.includes('<aside class="cta container" aria-label="Instagram">'));
  assert.match(home, /<a class="insta-handle" href="https:\/\/www\.instagram\.com\/batkahi\/" rel="noopener" lang="en">@batkahi<\/a>/);
});

test("every page has the v2 shell: masthead, three nav links, tools", () => {
  for (const file of htmlFiles()) {
    const html = read(file);
    assert.match(html, /<a class="masthead" href="\/ai-batkahi\/">/, file);
    assert.ok(!html.includes("masthead-wrap"), file);
    const nav = html.match(/<nav class="site-nav" aria-label="मुख्य">[\s\S]*?<\/nav>/);
    assert.ok(nav, file);
    assert.equal((nav[0].match(/<li>/g) || []).length, 3, file);
    assert.equal((nav[0].match(/class="nav-link"/g) || []).length, 3, file);
    assert.match(html, /<\/nav>\s*<div class="tools">/, file);
    assert.match(html, /<a class="icon-btn search-btn" href="\/ai-batkahi\/posts\/">/, file);
    assert.ok(!/<a class="icon-btn search-btn"[^>]*aria-label/.test(html), `${file}: search link has aria-label`);
    assert.match(html, /<button class="icon-btn theme-toggle" type="button" disabled aria-label="अन्हार थीम करीं" data-dark-label="अन्हार थीम करीं" data-light-label="अंजोर थीम करीं">/, file);
    assert.match(html, /<svg class="sunmoon"[^>]*aria-hidden="true"/, file);
    assert.match(html, /<main id="main"( class="[^"]*")? tabindex="-1">/, file);
  }
  const home = read(join(DIST, "index.html"));
  assert.match(home, /<main id="main" tabindex="-1">/);
  assert.ok(!home.includes('<div class="progress"'));
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

test("every post page: one share block, details ToC with In English, progress bar, rail", () => {
  const postPages = htmlFiles().filter((f) => /[\\/]posts[\\/][^\\/]+[\\/]index\.html$/.test(f));
  assert.equal(postPages.length, contentPosts().length);
  for (const file of postPages) {
    const html = read(file);
    assert.equal((html.match(/class="share"/g) || []).length, 1, `${file}: share blocks`);
    const details = html.match(/<details class="toc-wrap" open>[\s\S]*?<\/details>/);
    assert.ok(details, `${file}: details.toc-wrap`);
    assert.ok(details[0].includes('href="#in-english-heading"'), `${file}: ToC In English link`);
    assert.ok(details[0].includes('<nav class="toc" aria-label="एह बतकही में">'), file);
    assert.ok(html.includes('<div class="progress" aria-hidden="true"><div class="progress-bar"></div></div>'), `${file}: progress`);
    assert.ok(html.includes('<aside class="post-rail" aria-label="एह बतकही के बारे में">'), `${file}: rail`);
    assert.match(html, /<main id="main" class="container post-wrap" tabindex="-1">/, file);
    assert.match(html, /<h1>[^<]+<\/h1>\s*<p class="title-en" lang="en">/, file);
    assert.ok(html.includes('<p class="eyebrow"><span lang="en">Summary</span></p>'), `${file}: Summary eyebrow`);
  }
  for (const file of htmlFiles()) {
    if (postPages.includes(file)) continue;
    assert.ok(!read(file).includes('<div class="progress"'), `${file}: progress on a non-post page`);
  }
});

test("inline scripts: the pre-paint script everywhere, the ToC collapse only right after details on posts", () => {
  const tocScript = '<script>if(!matchMedia("(min-width: 75em)").matches)document.querySelector(".toc-wrap").open=false;</script>';
  for (const file of htmlFiles()) {
    const html = read(file);
    const inline = html.match(/<script>[\s\S]*?<\/script>/g) || [];
    const isPost = /[\\/]posts[\\/][^\\/]+[\\/]index\.html$/.test(file);
    assert.equal(inline.length, isPost ? 2 : 1, `${file}: inline script count`);
    assert.ok(inline[0].includes('localStorage.getItem("theme")'), `${file}: first inline script is the pre-paint script`);
    if (isPost) {
      assert.equal(inline[1], tocScript, `${file}: ToC collapse script`);
      assert.match(html, /<\/details>\s*<script>if\(!matchMedia/, `${file}: ToC script follows the details`);
    } else {
      assert.ok(!html.includes(".toc-wrap"), `${file}: ToC markup on a non-post page`);
    }
    for (const s of inline) assert.ok(!s.includes("prefers-color-scheme"), `${file}: inline script reads the OS scheme`);
  }
});

test("a category without posts appears nowhere except the About pillar list", () => {
  const active = new Set(activeCategorySlugs());
  const inactive = categories.filter((c) => !active.has(c.slug));
  const search = JSON.parse(read(join(DIST, "search.json")));
  const sitemap = read(join(DIST, "sitemap.xml"));
  for (const { slug, name } of inactive) {
    // The name as an element's whole text (heading, chip, link); prose may use the word.
    const asLabel = `>${name}<`;
    for (const rel of ["index.html", join("posts", "index.html"), "404.html"]) {
      const html = read(join(DIST, rel));
      assert.ok(!html.includes(slug), `${rel}: slug ${slug}`);
      assert.ok(!html.includes(asLabel), `${rel}: label ${name}`);
    }
    for (const file of htmlFiles()) {
      // Chrome = everything outside <main>: header, footer, palette.
      const chrome = read(file).replace(/<main[\s\S]*<\/main>/, "");
      assert.ok(!chrome.includes(slug) && !chrome.includes(asLabel), `${file}: ${slug} in the chrome`);
    }
    assert.ok(!sitemap.includes(`/category/${slug}/`), `sitemap: ${slug}`);
    assert.ok(search.posts.every((p) => p.category !== slug), `search.json: ${slug}`);
    const about = read(join(DIST, "about", "index.html"));
    assert.ok(about.includes(`<dt>${name} <span class="pillar-note">अबहीं पोस्ट नइखे</span>`), `about: ${slug} labelled`);
  }
});

test("related-by-tags: llm-kaise-bolela lists the two ChatGPT posts; career post has none", () => {
  const post = read(join(DIST, "posts", "llm-kaise-bolela", "index.html"));
  const related = post.match(/<section class="related" aria-labelledby="related-heading">[\s\S]*?<\/section>/);
  assert.ok(related, "section.related");
  assert.ok(related[0].includes('<h2 class="eyebrow" id="related-heading">मिलत-जुलत बतकही</h2>'));
  const hrefs = [...related[0].matchAll(/href="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(hrefs, [
    `${config.basePath}posts/ai-ke-jawab-par-bharosa/`,
    `${config.basePath}posts/ai-se-sahi-sawal/`,
  ]);
  assert.equal((related[0].match(/एही टैग पर: ChatGPT<\/p>/g) || []).length, 2);
  const career = read(join(DIST, "posts", "chhot-shahar-se-ai-career", "index.html"));
  assert.ok(!career.includes('class="related"'));
});

test("posts index and category pages render the card grid with the filter chips", () => {
  const index = read(join(DIST, "posts", "index.html"));
  const filters = [...index.matchAll(/data-filter="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(filters, ["all", ...activeCategorySlugs()].sort());
  assert.match(index, /<a href="[^"]*" data-filter="all" aria-current="true">सब<\/a>/);
  assert.ok(index.includes('<ul class="post-grid cards">'));
  const items = index.match(/<li class="post-item[^>]*>/g) || [];
  assert.equal(items.length, contentPosts().length);
  for (const li of items) assert.match(li, / data-category="[a-z]+"/);
  assert.ok(index.includes('<header class="page-header">'));
  for (const slug of activeCategorySlugs()) {
    const page = read(join(DIST, "category", slug, "index.html"));
    assert.ok(page.includes('<ul class="post-grid cards">'), slug);
    assert.ok(!page.includes('class="filter"'), `${slug}: no filter on a category page`);
  }
});

test("about page states owner facts without invented claims", () => {
  const about = read(join(DIST, "about", "index.html"));
  assert.ok(about.includes("Sudish Kumar"));
  assert.ok(about.includes("https://github.com/Sudish007"));
  assert.ok(about.includes("https://sudish.dev"));
  assert.ok(about.includes("BhojVerse"));
});

test("about page is the two-column grid with the pillar list", () => {
  const about = read(join(DIST, "about", "index.html"));
  assert.ok(about.includes('<div class="about-grid">'));
  assert.ok(about.includes('<aside class="about-side" aria-label="विषय आ बनावे वाला">'));
  assert.ok(about.includes("चार विषय"));
  assert.equal((about.match(/<div class="pillar">/g) || []).length, categories.length);
  assert.equal((about.match(/<h1[\s>]/g) || []).length, 1);
  assert.equal((about.match(/<h[3-6][\s>]/g) || []).length, 0, "about uses only h1 and h2");
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
  assert.equal((nf.match(/<a class="pill" href="/g) || []).length, 2);
  assert.ok(nf.includes('<ul class="link-row">'));
});

test("every page carries the command palette with an a11y-correct listbox", () => {
  for (const file of htmlFiles()) {
    const html = read(file);
    assert.equal((html.match(/role="listbox"/g) || []).length, 1, `${file}: listbox count`);
    const dialog = html.match(/<dialog class="palette" aria-label="खोजीं"[^>]*>[\s\S]*?<\/dialog>/);
    assert.ok(dialog, `${file}: dialog.palette`);
    assert.ok(html.includes(`data-index="${config.basePath}search.json"`), `${file}: data-index`);
    // Every option is the <a>/<button> itself, never the <li>.
    for (const m of html.matchAll(/<(\w+)[^>]*role="option"/g)) {
      assert.ok(m[1] === "a" || m[1] === "button", `${file}: role=option on <${m[1]}>`);
    }
    assert.ok(/<li role="presentation"><a role="option"/.test(html), `${file}: li[role=presentation] > a[role=option]`);
    const chord = (key) => {
      const m = html.match(new RegExp(`<a role="option"[^>]*data-chord="${key}"[^>]*href="([^"]*)"`));
      assert.ok(m, `${file}: data-chord=${key}`);
      return m[1];
    };
    assert.equal(chord("h"), config.basePath);
    assert.equal(chord("p"), `${config.basePath}posts/`);
    assert.equal(chord("a"), `${config.basePath}about/`);
    const insta = html.match(new RegExp(`<a role="option"[^>]*href="${config.instagramUrl}"[^>]*>`));
    assert.ok(insta, `${file}: Instagram option`);
    assert.match(insta[0], /rel="noopener"/, file);
    assert.ok(html.includes('<button role="option" id="pal-s5" tabindex="-1" type="button" class="palette-theme" data-static>थीम बदलीं</button>'), `${file}: theme action`);
    assert.ok(html.includes('class="shortcuts-toggle" aria-pressed="true"'), `${file}: shortcuts toggle`);
    assert.ok(!/<h[1-6][\s>]/.test(dialog[0]), `${file}: palette must not contain headings`);
    assert.ok(html.includes('placeholder="बतकही खोजीं…"'), `${file}: placeholder`);
  }
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

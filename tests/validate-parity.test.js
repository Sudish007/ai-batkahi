// Parity between the admin's validator (public/admin/lib/validate.js, run in the
// owner's browser BEFORE the commit) and what `npm test` rejects AFTER the commit
// lands (pages.yml runs the suite on every push to main). Two directions:
//   (a) every content/posts/*.md passes the validator with the paths the admin
//       derives from the repository (posts, categories, fixed pages, images);
//   (b) for every rule the dist tests enforce on a post body there is a minimal
//       fixture here that (1) the dist tests' own checks reject when applied to
//       the rendered page and (2) the validator rejects — plus must-pass bodies
//       both accept. Fixtures live in this file only; content/ is never touched.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { Marked } from "marked";
import config from "../site.config.js";
import categories from "../content/categories.js";
import { MARKED_OPTIONS, createRenderer, splitInEnglish } from "../src/lib/markdown-core.js";
import { url } from "../src/lib/urls.js";
import { escapeHtml } from "../src/lib/xml.js";
import { countWords } from "../src/lib/reading-time.js";
import { slugFromFilename } from "../src/lib/slugify.js";
import { parse } from "../src/lib/frontmatter.js";
import { validatePost, SITE_PAGES } from "../public/admin/lib/validate.js";
import { ROOT, DIST, POSTS_DIR, read, walk, contentPosts, activeCategorySlugs } from "./helpers.js";

// Exactly how the admin lexes a body (admin.js: `new Marked(MARKED_OPTIONS).lexer`).
const lexer = (md) => new Marked(MARKED_OPTIONS).lexer(md);
const categorySlugs = categories.map((c) => c.slug);
const isDraft = (data) => data.draft === "true" || data.draft === true;

/* ---------- what the admin knows about the site (derived from the repository) ---------- */
const IMAGES_DIR = join(ROOT, "content", "images");
const imagePaths = existsSync(IMAGES_DIR) ? walk(IMAGES_DIR).map((p) => "/images/" + relative(IMAGES_DIR, p).split(sep).join("/")) : [];
const postSlugs = contentPosts().map(({ file }) => `/posts/${slugFromFilename(file)}/`);
const categoryPaths = activeCategorySlugs().map((s) => `/category/${s}/`);
const knownPaths = [...SITE_PAGES, ...postSlugs, ...categoryPaths, ...imagePaths];
const allSlugs = readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md")).map(slugFromFilename);

/* ---------- (a) every real post passes ---------- */
for (const file of readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md")).sort()) {
  test(`parity (a): ${file} passes the admin validator with repository-derived paths`, () => {
    const { data, body } = parse(read(join(POSTS_DIR, file)));
    const slug = slugFromFilename(file);
    const errors = validatePost({
      data: { ...data, slug },
      body,
      existingSlugs: allSlugs,
      currentSlug: slug,
      draft: isDraft(data),
      countWords,
      lexer,
      categories: categorySlugs,
      knownPaths,
    });
    assert.deepEqual(errors, []);
  });
}

/* ---------- the CI oracle: the dist tests' checks applied to one rendered post ---------- */
// The build's renderer (createRenderer + url(), as src/lib/markdown.js wires it),
// silent about missing image sizes (the build only warns).
const marked = new Marked(MARKED_OPTIONS).use({
  renderer: createRenderer({ resolveUrl: (h) => (h.startsWith("/") ? url(h) : h), imageSizes: {}, onMissingSize: () => {} }),
});
// The post page as src/templates/post.js and layout.js assemble it around the
// body: title and description in <head>, article.post with the title's h1, the
// rendered body, the template's In English h2 and the rendered English part.
function pageFor(body, data) {
  const { body: main, inEnglish } = splitInEnglish(body);
  return (
    `<head><title>${escapeHtml(data.title)} · ${escapeHtml(config.title)}</title>` +
    `<meta name="description" content="${escapeHtml(data.summary_en || data.summary)}"></head>` +
    `<article class="post"><h1>${escapeHtml(data.title)}</h1>\n${marked.parse(main)}\n` +
    `<h2 id="in-english-heading">In English</h2>\n${marked.parse(inEnglish)}</article>`
  );
}
// tests/dist-links.test.js resolveInternal(), verbatim.
function resolveInternal(href) {
  const clean = href.split("#")[0].split("?")[0];
  if (clean === "") return true;
  if (!clean.startsWith(config.basePath)) return false;
  const rel = clean.slice(config.basePath.length);
  let target = join(DIST, rel);
  if (!existsSync(target)) return false;
  if (statSync(target).isDirectory()) return existsSync(join(target, "index.html"));
  return true;
}
// Returns the dist-test failures the page would produce (empty = CI green).
function ciFailures(body, data) {
  const out = [];
  if (!splitInEnglish(body).inEnglish) out.push("posts.js: missing In English section (build throws)");
  const html = pageFor(body, data);
  // dist-lang: one h1; heading levels never skip; imgs have alt.
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) out.push("dist-lang: h1 count");
  let prev = 0;
  for (const m of html.matchAll(/<h([1-6])[\s>]/g)) {
    const lv = Number(m[1]);
    if (lv > prev + 1) out.push(`dist-lang: h${prev} -> h${lv}`);
    prev = lv;
  }
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\salt="[^"]*"/.test(m[0])) out.push("dist-lang: img without alt");
  // dist-links: internal href/src resolve under basePath; external <a> carry noopener.
  for (const m of html.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
    if (/^(https?:|mailto:|data:|#)/.test(m[1])) continue;
    if (!resolveInternal(m[1])) out.push(`dist-links: ${m[1]}`);
  }
  for (const m of html.matchAll(/<a\s+([^>]*href="https?:\/\/[^"]*"[^>]*)>/g)) if (!/rel="[^"]*noopener/.test(m[1])) out.push("dist-links: noopener");
  // dist-admin: no page links to admin/.
  for (const m of html.matchAll(/\bhref="([^"]*)"/g)) if (m[1].includes("/admin/")) out.push("dist-admin: admin link");
  // dist-pages: inline script count; banned words outside article.post.
  if (/<script>/.test(html)) out.push("dist-pages: inline script count");
  const chrome = html.replace(/<article class="post">[\s\S]*<\/article>/, "");
  for (const re of [/lorem/i, /coming soon/i, /follower/i, /trusted by/i, /testimonial/i]) if (re.test(chrome)) out.push(`dist-pages: ${re}`);
  return out;
}

/* ---------- (b) fixtures ---------- */
const BHO = "ई एगो लंबा बतकही बा जे पचास शब्द से जादा होखे के चाहीं, एही से हम एके बात कई बेर कहत बानी। ".repeat(4);
const EN = "This is the English summary of the post with more than twenty words in it for the validator to accept. ".repeat(2);
const DATA = {
  title: "समता के जाँच",
  title_en: "Parity check",
  slug: "parity-post",
  date: "2026-10-10",
  category: activeCategorySlugs()[0],
  tags: ["परीक्षण"],
  summary: "छोट सार।",
  summary_en: "Short summary.",
  instagram: "",
};
const realPost = postSlugs[0]; // "/posts/<slug>/" of a published post
const activeCategory = categoryPaths[0];
const inactiveCategory = categorySlugs.filter((s) => !activeCategorySlugs().includes(s)).map((s) => `/category/${s}/`)[0];
const anyImage = imagePaths[0]; // a committed file under content/images (copied to dist/images)
const BODY = (middle = "") => `परिचय।\n\n## पहिला खंड\n\n${BHO}\n\n${middle}\n\n## दूसरा खंड\n\n${BHO}\n\n## In English\n\n${EN}`;

function validate(body, data = {}) {
  return validatePost({
    data: { ...DATA, ...data },
    body,
    existingSlugs: allSlugs,
    draft: false,
    countWords,
    lexer,
    categories: categorySlugs,
    knownPaths: [...knownPaths, `/posts/${DATA.slug}/`],
  });
}

// ci: true  -> the dist tests reject the page AND the validator must reject the post;
// ci: false -> both accept;
// ci: null  -> a rule of the admin alone (the build would accept the file but
//              render the wrong thing); only the validator's verdict is asserted.
const fixtures = [
  // one-h1 ban (dist-lang)
  { name: "ATX h1", body: `# शीर्षक\n\n${BODY()}`, ci: true },
  { name: "setext h1", body: `शीर्षक\n===\n\n${BODY()}`, ci: true },
  // heading order and depth (dist-lang "heading levels never skip")
  { name: "### before the first ##", body: `### छोट\n\n${BODY()}`, ci: true },
  { name: "#### as the first heading", body: `#### चार\n\n${BODY()}`, ci: true },
  { name: "## -> #### in the body", body: BODY("#### चार"), ci: true, message: "## के बाद #### नइखे चलेला — ### लगाईं" },
  { name: "## In English -> ####", body: `${BODY()}\n\n#### Four\n\n${EN}`, ci: true, message: "## के बाद #### नइखे चलेला — ### लगाईं" },
  { name: "### -> #####", body: BODY("### तीन\n\n##### पाँच"), ci: true },
  // the In English section (posts.js throws without it; the rest is the admin's own rule)
  { name: "no In English", body: `## पहिला\n\n${BHO}`, ci: true },
  { name: "In English not last", body: `## In English\n\n${EN}\n\n## पहिला\n\n${BHO}`, ci: null },
  { name: "two In English", body: `${BODY()}\n\n## In English\n\n${EN}`, ci: null },
  { name: "fenced In English before the real one", body: `## पहिला\n\n${BHO}\n\n\`\`\`md\n## In English\n\`\`\`\n\n## In English\n\n${EN}`, ci: null },
  // internal links resolve (dist-links)
  { name: "relative link", body: BODY("[x](about/)"), ci: true, message: "लिंक / से शुरू करीं (जइसे /posts/<slug>/) या पूरा https:// URL दीं: about/" },
  { name: "parent-relative link", body: BODY("[x](../posts/)"), ci: true },
  { name: "unknown post slug", body: BODY("[x](/posts/typo/)"), ci: true },
  { name: "unknown root path", body: BODY("[x](/nowhere/)"), ci: true },
  { name: "link to admin/", body: BODY("[x](/admin/)"), ci: true },
  { name: "uppercase scheme", body: BODY("[x](HTTPS://example.com/)"), ci: true },
  ...(inactiveCategory ? [{ name: `category without posts (${inactiveCategory})`, body: BODY(`[x](${inactiveCategory})`), ci: true }] : []),
  // images exist (dist-links on src)
  { name: "missing image", body: BODY("![x](/images/parity-post/missing.webp)"), ci: true },
  { name: "relative image", body: BODY("![x](photo.png)"), ci: true },
  // raw HTML the page tests judge as markup (dist-lang / dist-links / dist-pages)
  { name: "raw <h4>", body: BODY("<h4>चार</h4>"), ci: true },
  { name: "raw <a> relative", body: BODY('<a href="about/">x</a>'), ci: true },
  { name: "raw <a> external without rel", body: BODY('<a href="https://example.com/">x</a>'), ci: true },
  { name: "raw <img> without alt", body: BODY('<img src="https://example.com/a.png">'), ci: true },
  { name: "raw <script>", body: BODY("<script>x()</script>"), ci: true },
  // front matter words dist-pages bans from every page (title and description are in <head>)
  { name: "banned word in title", body: BODY(), data: { title: "Lorem ipsum" }, ci: true },
  { name: "banned word in summary_en", body: BODY(), data: { summary_en: "How follower counts lie" }, ci: true },
  // must-pass bodies
  { name: "plain post", body: BODY(), ci: false },
  { name: "## -> ### -> #### and ### under In English", body: `${BODY("### तीन\n\n#### चार")}\n\n### Three\n\n#### Four\n\n${EN}`, ci: false },
  { name: "known internal links in every form", body: BODY(`[a](${realPost}) [b](${realPost.slice(0, -1)}) [c](${realPost}#x) [d](${realPost}?q=1) [e](${realPost}index.html) [f](/about/) [g](/) [h](/posts/) [i](/feed.xml) [j](${activeCategory})`), ci: false },
  { name: "external, mailto, fragment, autolink, data: image", body: BODY("[a](https://example.com/x) [b](http://example.com/y) [c](mailto:x@y.z) [d](#section-1) <https://example.com/z> ![e](data:image/png;base64,AA==) ![f](https://example.com/a.png)"), ci: false },
  { name: "links inside heading, list, quote, table", body: BODY(`## शीर्षक [x](${realPost})\n\n- [y](${realPost})\n\n> [z](${realPost})\n\n| क |\n|---|\n| [t](${realPost}) |`), ci: false },
  { name: "fenced and code-span pseudo markup", body: BODY("```md\n# h1\n#### h4\n[x](nope/)\n<a href=\"nope/\">\n```\n\n`<img src=x>` आ `[y](nope/)`"), ci: false },
  { name: "harmless inline HTML", body: BODY("एक<br>दू <kbd>Ctrl</kbd> <!-- टिप्पणी -->"), ci: false },
  ...(anyImage ? [{ name: `committed image (${anyImage})`, body: BODY(`![x](${anyImage})`), ci: false }] : []),
];

for (const f of fixtures) {
  test(`parity (b): ${f.name}`, () => {
    const data = { ...DATA, ...(f.data || {}) };
    const ci = ciFailures(f.body, data);
    const errors = validate(f.body, f.data);
    if (f.ci === true) {
      assert.ok(ci.length > 0, "the dist tests' checks must reject this fixture");
      assert.ok(errors.length > 0, `the validator must reject it (CI would: ${ci.join("; ")})`);
    } else if (f.ci === false) {
      assert.deepEqual(ci, [], "the dist tests' checks must accept this fixture");
      assert.deepEqual(errors, [], "the validator must accept it");
    } else {
      assert.ok(errors.length > 0, "the validator must reject it");
    }
    if (f.message) assert.ok(errors.some((e) => e.message === f.message), JSON.stringify(errors.map((e) => e.message)));
  });
}

test("parity (b): a link to the post's own page is accepted (the page exists once it is published)", () => {
  // Not in dist/ yet, so the CI oracle cannot judge it; the admin adds
  // "/posts/<slug>/" of the post being published to knownPaths (admin.js sitePaths()).
  assert.deepEqual(validate(BODY(`[k](/posts/${DATA.slug}/#section-1)`)), []);
});

test("parity (b): the inventory of CI rules is covered by at least one must-fail fixture each", () => {
  const covered = new Set();
  for (const f of fixtures) if (f.ci === true) for (const c of ciFailures(f.body, { ...DATA, ...(f.data || {}) })) covered.add(c.split(":")[0]);
  assert.deepEqual([...covered].sort(), ["dist-admin", "dist-lang", "dist-links", "dist-pages", "posts.js"]);
});

test("parity: the admin's fixed page list matches the pages the build writes", () => {
  for (const p of SITE_PAGES) assert.ok(resolveInternal(url(p)), `${p} is not in dist/`);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { Marked } from "marked";
import config from "../site.config.js";
import { renderMarkdown, splitInEnglish } from "../src/lib/markdown.js";
import { MARKED_OPTIONS, createRenderer } from "../src/lib/markdown-core.js";

const base = config.basePath;

// Capture console.log while fn runs (renderMarkdown warns on unsized images).
function captureLog(fn) {
  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.join(" "));
  try {
    return { result: fn(), lines };
  } finally {
    console.log = original;
  }
}

test("heading ids: Latin slug, section-N for Devanagari, -2 for duplicates", () => {
  const html = renderMarkdown("## Model\n\n## पहिला खंड\n\n## दूसरा खंड\n\n## Model\n\n### Sub");
  assert.match(html, /<h2 id="model">Model<\/h2>/);
  assert.match(html, /<h2 id="section-2">पहिला खंड<\/h2>/);
  assert.match(html, /<h2 id="section-3">दूसरा खंड<\/h2>/);
  assert.match(html, /<h2 id="model-2">Model<\/h2>/);
  assert.match(html, /<h3 id="sub">Sub<\/h3>/);
});

test("heading counter restarts per renderMarkdown call", () => {
  assert.match(renderMarkdown("## पहिला"), /id="section-1"/);
  assert.match(renderMarkdown("## पहिला"), /id="section-1"/);
});

test("root-relative link is rewritten under basePath without rel=noopener", () => {
  const html = renderMarkdown("[पढ़ीं](/posts/x/)");
  assert.ok(html.includes(`<a href="${base}posts/x/">पढ़ीं</a>`), html);
  assert.ok(!html.includes("noopener"));
});

test("external link gets rel=noopener and keeps its title", () => {
  const html = renderMarkdown('[OpenAI](https://openai.com "Site")');
  assert.ok(html.includes('<a href="https://openai.com" title="Site" rel="noopener">OpenAI</a>'), html);
});

test("relative link is left untouched", () => {
  const html = renderMarkdown("[x](../y/)");
  assert.ok(html.includes('<a href="../y/">x</a>'), html);
});

test("image without a manifest entry: no width/height, one warning", () => {
  const { result: html, lines } = captureLog(() => renderMarkdown("![alt](/images/x/y.webp)"));
  assert.ok(
    html.includes(`<img src="${base}images/x/y.webp" alt="alt" loading="lazy" decoding="async">`),
    html,
  );
  assert.deepEqual(lines, ["warn: image without dimensions: /images/x/y.webp"]);
});

test("image with a manifest entry gets width and height, no warning", () => {
  const imageSizes = { "/images/x/y.webp": { width: 1600, height: 900 } };
  const { result: html, lines } = captureLog(() => renderMarkdown("![alt](/images/x/y.webp)", { imageSizes }));
  assert.ok(
    html.includes(
      `<img src="${base}images/x/y.webp" alt="alt" loading="lazy" decoding="async" width="1600" height="900">`,
    ),
    html,
  );
  assert.deepEqual(lines, []);
});

test("image title is escaped and placed before width/height", () => {
  const imageSizes = { "/images/a.png": { width: 10, height: 20 } };
  const { result: html } = captureLog(() => renderMarkdown('![a](/images/a.png "x & \\"y\\"")', { imageSizes }));
  assert.ok(
    html.includes(
      `<img src="${base}images/a.png" alt="a" loading="lazy" decoding="async" title="x &amp; &quot;y&quot;" width="10" height="20">`,
    ),
    html,
  );
});

test("external image src is untouched; empty alt is allowed", () => {
  const { result: html } = captureLog(() => renderMarkdown("![](https://example.com/p.jpg)"));
  assert.ok(html.includes('<img src="https://example.com/p.jpg" alt="" loading="lazy" decoding="async">'), html);
});

test("alt text is HTML-escaped", () => {
  const { result: html } = captureLog(() => renderMarkdown('![a "b" <c>](/images/q.webp)'));
  assert.ok(html.includes('alt="a &quot;b&quot; &lt;c&gt;"'), html);
});

test("createRenderer with identity resolveUrl leaves hrefs as-is (browser path)", () => {
  const marked = new Marked(MARKED_OPTIONS);
  marked.use({ renderer: createRenderer() });
  const html = marked.parse("[x](/posts/x/)\n\n![y](/images/y.webp)\n\n## Model\n\n## पहिला");
  assert.ok(html.includes('<a href="/posts/x/">x</a>'), html);
  assert.ok(html.includes('<img src="/images/y.webp" alt="y" loading="lazy" decoding="async">'), html);
  assert.match(html, /<h2 id="model">/);
  assert.match(html, /<h2 id="section-2">/);
});

test("createRenderer resolveUrl can map images to blob: URLs (preview path)", () => {
  const marked = new Marked(MARKED_OPTIONS);
  const seen = [];
  marked.use({
    renderer: createRenderer({
      resolveUrl: (h) => (h === "/images/y.webp" ? "blob:https://x/abc" : h),
      onMissingSize: (h) => seen.push(h),
    }),
  });
  const html = marked.parse("![y](/images/y.webp)");
  assert.ok(html.includes('src="blob:https://x/abc"'), html);
  assert.deepEqual(seen, ["/images/y.webp"]);
});

test("core and wrapper produce identical heading ids for the same body", () => {
  const body = "## Model\n\n## पहिला खंड\n\n## Model\n\n### Data and Model";
  const marked = new Marked(MARKED_OPTIONS);
  marked.use({ renderer: createRenderer() });
  const ids = (html) => [...html.matchAll(/<h\d id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids(marked.parse(body)), ids(renderMarkdown(body)));
  assert.deepEqual(ids(renderMarkdown(body)), ["model", "section-2", "model-2", "data-and-model"]);
});

test("splitInEnglish is re-exported from the wrapper", () => {
  const { body, inEnglish } = splitInEnglish("पहिला।\n\n## In English\n\nFirst.\n");
  assert.equal(body, "पहिला।\n");
  assert.equal(inEnglish, "First.");
});

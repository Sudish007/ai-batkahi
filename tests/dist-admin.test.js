import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import config from "../site.config.js";
import categories from "../content/categories.js";
import { PREPAINT } from "../src/templates/layout.js";
import { ROOT, DIST, htmlFiles, read, walk } from "./helpers.js";

const ADMIN = join(DIST, "admin", "index.html");
const html = read(ADMIN);
const base = config.basePath;

test("admin page: noindex, no canonical, CSP meta with the PREPAINT hash", () => {
  assert.ok(existsSync(ADMIN));
  assert.ok(html.includes('<meta name="robots" content="noindex">'));
  assert.ok(!html.includes('rel="canonical"'));
  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(csp, "CSP meta");
  const hash = createHash("sha256").update(PREPAINT).digest("base64");
  assert.ok(csp[1].includes(`script-src 'self' 'sha256-${hash}'`), csp[1]);
  assert.ok(csp[1].includes("connect-src 'self' https://api.github.com https://sudish007.github.io"));
  assert.ok(csp[1].includes("style-src 'self'"));
  assert.ok(csp[1].includes("form-action 'self'"));
  assert.ok(csp[1].includes("img-src 'self' data: blob: https://raw.githubusercontent.com"));
  assert.ok(csp[1].includes("object-src 'none'"));
  assert.ok(csp[1].includes("base-uri 'none'"));
  assert.ok(csp[1].includes("frame-src 'self' blob:"));
  // A meta CSP governs only what is parsed after it: it must precede the script it hashes.
  assert.ok(csp.index < html.indexOf(`<script>${PREPAINT}</script>`), "CSP meta before the pre-paint script");
});
test("admin page: no inline styles, one bare inline script, the module script", () => {
  assert.ok(!html.includes(' style="'));
  assert.ok(!html.includes("<style"));
  const inline = html.match(/<script>[\s\S]*?<\/script>/g) || [];
  assert.equal(inline.length, 1);
  assert.ok(inline[0].includes('localStorage.getItem("theme")'));
  assert.equal((html.match(/<script type="module" src="\/ai-batkahi\/admin\/admin\.js"><\/script>/g) || []).length, 1);
  assert.ok(html.includes(`<link rel="stylesheet" href="${base}admin/admin.css">`));
  assert.ok(html.includes('<script type="application/json" id="admin-config">'));
  const cfg = JSON.parse(html.match(/<script type="application\/json" id="admin-config">([\s\S]*?)<\/script>/)[1]);
  assert.equal(cfg.owner, config.repo.owner);
  assert.equal(cfg.repo, config.repo.name);
  assert.equal(cfg.branch, config.repo.branch);
  assert.equal(cfg.stylesheet, `${base}styles.css`);
  assert.equal(cfg.categories.length, categories.length);
  // The config JSON lives inside <main> so the chrome never names an inactive category.
  assert.ok(html.indexOf('id="admin-config"') < html.indexOf("</main>"));
});
test("admin/ is absent from sitemap, feed, search.json and other pages' hrefs; robots disallows it", () => {
  assert.ok(!read(join(DIST, "sitemap.xml")).includes("admin/"));
  assert.ok(!read(join(DIST, "feed.xml")).includes("admin/"));
  assert.ok(!read(join(DIST, "search.json")).includes("admin/"));
  for (const file of htmlFiles()) {
    if (file === ADMIN) continue;
    for (const m of read(file).matchAll(/\bhref="([^"]*)"/g)) {
      assert.ok(!m[1].includes("/admin/"), `${relative(DIST, file)} -> ${m[1]}`);
    }
  }
  assert.ok(read(join(DIST, "robots.txt")).includes(`Disallow: ${base}admin/`));
});
test("admin page: all categories in the select, every control labelled", () => {
  assert.ok(html.includes('<option value="khabar">खबर</option>'));
  const select = html.match(/<select id="f-category">([\s\S]*?)<\/select>/);
  assert.ok(select);
  assert.equal((select[1].match(/<option /g) || []).length, categories.length);
  const ids = [...html.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
  const fors = new Set([...html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]));
  assert.ok(ids.length >= 15, `only ${ids.length} controls`);
  for (const id of ids) {
    if (id === "palette-input") continue; // layout's palette has its own label
    assert.ok(fors.has(id), `control #${id} has no <label for>`);
  }
});
test("admin page: lock, help, security and limits copy; initial state", () => {
  for (const s of [
    "personal-access-tokens/new",
    "Only select repositories",
    "Sudish007/ai-batkahi",
    "Contents",
    "Read and write",
    "Actions",
    "Read-only",
    "ई डिवाइस पर याद राखीं",
    "settings/tokens",
    "sudish007.github.io",
    "GitHub Actions",
    "एक मिनट",
    "एह पन्ना खातिर JavaScript जरूरी बा",
  ]) {
    assert.ok(html.includes(s), s);
  }
  assert.ok(html.includes('<section id="dashboard" hidden'));
  assert.ok(html.includes('<section id="editor" hidden'));
  assert.ok(html.includes('<section id="activity" aria-labelledby="activity-heading" hidden>'));
  assert.ok(html.includes('id="signin-btn" disabled'));
  assert.ok(html.includes('<form id="signin" method="post" novalidate>'));
  assert.ok(html.includes('<iframe id="preview" sandbox="allow-same-origin"'));
  assert.ok(html.includes('<main id="main" class="container admin" tabindex="-1">'));
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.ok(html.includes("<h1>संपादक</h1>"));
  assert.equal((html.match(/<h[3-6][\s>]/g) || []).length, 0);
  assert.equal((html.match(/<dialog id="[^"]+" class="admin-dialog"/g) || []).length, 4);
  assert.equal((html.match(/data-md="/g) || []).length, 8);
});
test("admin libs and marked are byte copies of their sources; admin js within budget", () => {
  for (const f of ["markdown-core.js", "slugify.js", "xml.js", "reading-time.js", "frontmatter.js"]) {
    assert.deepEqual(readFileSync(join(DIST, "admin", "lib", f)), readFileSync(join(ROOT, "src", "lib", f)), f);
  }
  assert.deepEqual(
    readFileSync(join(DIST, "admin", "vendor", "marked.esm.js")),
    readFileSync(join(ROOT, "node_modules", "marked", "lib", "marked.esm.js")),
  );
  assert.ok(existsSync(join(DIST, "admin", "vendor", "marked.LICENSE")));
  const libs = walk(join(DIST, "admin", "lib"), (p) => p.endsWith(".js"));
  const total = libs.reduce((s, p) => s + readFileSync(p).length, readFileSync(join(DIST, "admin", "admin.js")).length);
  assert.ok(total <= 80 * 1024, `admin js ${total} B`);
  const js = read(join(DIST, "admin", "admin.js"));
  assert.ok(!js.includes("innerHTML"));
  assert.ok(!js.includes(".style."));
  assert.ok(!js.includes("console.log"));
});

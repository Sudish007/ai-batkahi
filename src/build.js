// AI Batkahi build: Markdown + templates -> dist/. Run with `npm run build`.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import config from "../site.config.js";
import categories from "../content/categories.js";
import { loadPosts, activeCategories as pickActive, categoryCounts, relatedPosts } from "./lib/posts.js";
import { searchIndex } from "./lib/search-index.js";
import { FONT_FILES } from "./lib/fonts.js";
import { atomFeed, sitemap, robots } from "./feeds.js";
import { homePage } from "./templates/home.js";
import { postsIndexPage } from "./templates/posts-index.js";
import { postPage } from "./templates/post.js";
import { categoryPage } from "./templates/category.js";
import { aboutPage } from "./templates/about.js";
import { notFoundPage } from "./templates/not-found.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const PUBLIC = join(ROOT, "public");
const POSTS_DIR = join(ROOT, "content", "posts");

// Size budgets (bytes). The build fails on any violation.
const KB = 1024;
const BUDGET_CSS = 60 * KB;
const BUDGET_JS = 60 * KB;
const BUDGET_PAGE = 150 * KB; // one HTML page + styles.css + main.js
const BUDGET_FONTS = 500 * KB; // sum of dist/fonts/*

function write(relPath, content) {
  const out = join(DIST, relPath);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, content, "utf8");
  const bytes = Buffer.byteLength(content, "utf8");
  console.log(`  ${relPath.padEnd(48)} ${String(bytes).padStart(7)} B`);
}

function copyPublic() {
  cpSync(PUBLIC, DIST, { recursive: true });
  // styles.css uses the literal token __BASE__ for font URLs; rewrite to basePath.
  const cssPath = join(DIST, "styles.css");
  const css = readFileSync(cssPath, "utf8").replace(/__BASE__/g, config.basePath);
  writeFileSync(cssPath, css, "utf8");
}

function copyFonts() {
  const outDir = join(DIST, "fonts");
  mkdirSync(outDir, { recursive: true });
  let total = 0;
  for (const [pkg, file] of FONT_FILES) {
    const src = join(ROOT, "node_modules", pkg, "files", file);
    cpSync(src, join(outDir, file));
    total += statSync(src).size;
  }
  console.log(`  fonts/ (${FONT_FILES.length} files)${" ".repeat(27)} ${String(total).padStart(7)} B`);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function assertBudgets() {
  const size = (p) => statSync(p).size;
  const rel = (p) => relative(DIST, p).replace(/\\/g, "/");
  const over = (p, bytes, limit) => new Error(`size budget exceeded: ${rel(p)} is ${bytes} B (limit ${limit} B)`);

  const cssPath = join(DIST, "styles.css");
  const jsPath = join(DIST, "main.js");
  const css = size(cssPath);
  const js = size(jsPath);
  if (css > BUDGET_CSS) throw over(cssPath, css, BUDGET_CSS);
  if (js > BUDGET_JS) throw over(jsPath, js, BUDGET_JS);

  for (const p of walk(DIST).filter((f) => f.endsWith(".html"))) {
    const total = size(p) + css + js;
    if (total > BUDGET_PAGE) throw over(p, total, BUDGET_PAGE);
  }

  const fontsDir = join(DIST, "fonts");
  const fonts = walk(fontsDir).reduce((sum, p) => sum + size(p), 0);
  if (fonts > BUDGET_FONTS) throw over(fontsDir, fonts, BUDGET_FONTS);
}

function build() {
  const started = Date.now();
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  const posts = loadPosts({ dir: POSTS_DIR, categories, wordsPerMinute: config.wordsPerMinute });
  const activeCategories = pickActive(categories, posts);

  console.log(`Building ${posts.length} posts, ${activeCategories.length} active categories -> dist/`);
  copyPublic();
  copyFonts();

  write("index.html", homePage({ posts, activeCategories, categoryCounts: categoryCounts(categories, posts) }));
  write("posts/index.html", postsIndexPage({ posts, activeCategories }));
  for (const post of posts) {
    write(
      `posts/${post.slug}/index.html`,
      postPage({ post, prev: post.prev, next: post.next, related: relatedPosts(post, posts) }),
    );
  }
  for (const category of activeCategories) {
    const inCategory = posts.filter((p) => p.category.slug === category.slug);
    write(`category/${category.slug}/index.html`, categoryPage({ category, posts: inCategory }));
  }
  write("about/index.html", aboutPage({ activeCategories, allCategories: categories }));
  write("404.html", notFoundPage());
  write("feed.xml", atomFeed(posts));
  write("sitemap.xml", sitemap(posts, activeCategories));
  write("robots.txt", robots());
  write("search.json", JSON.stringify(searchIndex(posts)));

  assertBudgets();
  console.log(`Done in ${Date.now() - started} ms`);
}

build();

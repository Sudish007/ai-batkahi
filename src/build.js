// AI Batkahi build: Markdown + templates -> dist/. Run with `npm run build`.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import config from "../site.config.js";
import categories from "../content/categories.js";
import { parse } from "./lib/frontmatter.js";
import { slugFromFilename } from "./lib/slugify.js";
import { countWords, readingMinutes } from "./lib/reading-time.js";
import { renderMarkdown, splitInEnglish } from "./lib/markdown.js";
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

// Exact font files copied into dist/fonts (devanagari + latin subsets only).
const FONT_FILES = [
  ["@fontsource/tiro-devanagari-hindi", "tiro-devanagari-hindi-devanagari-400-normal.woff2"],
  ["@fontsource/tiro-devanagari-hindi", "tiro-devanagari-hindi-latin-400-normal.woff2"],
  ["@fontsource/noto-sans-devanagari", "noto-sans-devanagari-devanagari-400-normal.woff2"],
  ["@fontsource/noto-sans-devanagari", "noto-sans-devanagari-devanagari-700-normal.woff2"],
  ["@fontsource/noto-sans-devanagari", "noto-sans-devanagari-latin-400-normal.woff2"],
  ["@fontsource/noto-sans-devanagari", "noto-sans-devanagari-latin-700-normal.woff2"],
];

const REQUIRED_KEYS = ["title", "title_en", "date", "category", "tags", "summary", "summary_en"];

function write(relPath, content) {
  const out = join(DIST, relPath);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, content, "utf8");
  const bytes = Buffer.byteLength(content, "utf8");
  console.log(`  ${relPath.padEnd(48)} ${String(bytes).padStart(7)} B`);
}

function loadPosts() {
  const byCategory = new Map(categories.map((c) => [c.slug, c]));
  const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md")).sort();
  const posts = files.map((file) => {
    const raw = readFileSync(join(POSTS_DIR, file), "utf8");
    const { data, body: fullBody } = parse(raw);
    for (const key of REQUIRED_KEYS) {
      if (data[key] === undefined || data[key] === "") {
        throw new Error(`${file}: missing front-matter key "${key}"`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      throw new Error(`${file}: date must be YYYY-MM-DD`);
    }
    const category = byCategory.get(data.category);
    if (!category) {
      throw new Error(`${file}: unknown category "${data.category}"`);
    }
    if (!Array.isArray(data.tags)) {
      throw new Error(`${file}: tags must be a list`);
    }
    const { body, inEnglish } = splitInEnglish(fullBody);
    if (!inEnglish) {
      throw new Error(`${file}: missing "## In English" section`);
    }
    const words = countWords(fullBody);
    return {
      file,
      slug: slugFromFilename(file),
      title: data.title,
      title_en: data.title_en,
      date: data.date,
      category,
      tags: data.tags,
      summary: data.summary,
      summary_en: data.summary_en,
      instagram: data.instagram || "",
      words,
      minutes: readingMinutes(words, config.wordsPerMinute),
      html: renderMarkdown(body),
      inEnglishHtml: renderMarkdown(inEnglish),
    };
  });

  // Newest first; tie-break by filename ascending (01- before 02-).
  posts.sort((a, b) => (a.date === b.date ? a.file.localeCompare(b.file) : b.date.localeCompare(a.date)));
  // prev/next follow list (reading) order: previous = item above, next = item below.
  posts.forEach((p, i) => {
    p.prev = posts[i - 1] || null;
    p.next = posts[i + 1] || null;
  });
  return posts;
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

function build() {
  const started = Date.now();
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  const posts = loadPosts();
  const activeCategories = categories.filter((c) => posts.some((p) => p.category.slug === c.slug));

  console.log(`Building ${posts.length} posts, ${activeCategories.length} active categories -> dist/`);
  copyPublic();
  copyFonts();

  write("index.html", homePage({ posts }));
  write("posts/index.html", postsIndexPage({ posts, activeCategories }));
  for (const post of posts) {
    write(`posts/${post.slug}/index.html`, postPage({ post, prev: post.prev, next: post.next }));
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

  console.log(`Done in ${Date.now() - started} ms`);
}

build();

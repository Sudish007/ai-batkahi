// Post loading and derived data (drafts, active categories, related posts).
// Kept out of build.js so it can be unit-tested with a temp-dir fixture.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parse } from "./frontmatter.js";
import { slugFromFilename } from "./slugify.js";
import { countWords, readingMinutes } from "./reading-time.js";
import { renderMarkdown, splitInEnglish } from "./markdown.js";
import { extractToc } from "./toc.js";

export const REQUIRED_KEYS = ["title", "title_en", "date", "category", "tags", "summary", "summary_en"];

function isDraft(data) {
  return data.draft === "true" || data.draft === true;
}

export function loadPosts({ dir, categories, wordsPerMinute, imageSizes = {} }) {
  const byCategory = new Map(categories.map((c) => [c.slug, c]));
  const files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  const posts = [];
  for (const file of files) {
    const raw = readFileSync(join(dir, file), "utf8");
    const { data, body: fullBody } = parse(raw);
    if (isDraft(data)) {
      console.log(`skip draft: ${file}`);
      continue;
    }
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
    const html = renderMarkdown(body, { imageSizes });
    posts.push({
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
      minutes: readingMinutes(words, wordsPerMinute),
      html,
      toc: extractToc(html),
      inEnglishHtml: renderMarkdown(inEnglish, { imageSizes }),
    });
  }

  // Newest first; tie-break by filename ascending (01- before 02-).
  posts.sort((a, b) => (a.date === b.date ? a.file.localeCompare(b.file) : b.date.localeCompare(a.date)));
  // prev/next follow list (reading) order: previous = item above, next = item below.
  posts.forEach((p, i) => {
    p.prev = posts[i - 1] || null;
    p.next = posts[i + 1] || null;
  });
  return posts;
}

// Categories with at least one post, in categories.js order.
export function activeCategories(categories, posts) {
  return categories.filter((c) => posts.some((p) => p.category.slug === c.slug));
}

// [{ category, count }] for active categories only.
export function categoryCounts(categories, posts) {
  return activeCategories(categories, posts).map((category) => ({
    category,
    count: posts.filter((p) => p.category.slug === category.slug).length,
  }));
}

// Up to 3 other posts sharing >= 1 tag: most shared tags first, then newest.
export function relatedPosts(post, posts) {
  const mine = new Set(post.tags);
  return posts
    .filter((p) => p !== post && p.slug !== post.slug)
    .map((p) => ({ post: p, shared: p.tags.filter((t) => mine.has(t)) }))
    .filter((r) => r.shared.length >= 1)
    .sort((a, b) =>
      a.shared.length === b.shared.length ? b.post.date.localeCompare(a.post.date) : b.shared.length - a.shared.length,
    )
    .slice(0, 3);
}

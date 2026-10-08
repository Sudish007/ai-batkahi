import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "../src/lib/frontmatter.js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DIST = join(ROOT, "dist");
export const POSTS_DIR = join(ROOT, "content", "posts");

export function walk(dir, filter = () => true, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out;
}

export function htmlFiles() {
  return walk(DIST, (p) => p.endsWith(".html"));
}

export function read(p) {
  return readFileSync(p, "utf8");
}

// Non-draft posts in content/posts, as parsed front matter: [{ file, data }].
// Tests derive expected counts from here instead of hard-coding them.
export function contentPosts() {
  return readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((file) => ({ file, data: parse(read(join(POSTS_DIR, file))).data }))
    .filter(({ data }) => !(data.draft === "true" || data.draft === true));
}

// Distinct category slugs used by non-draft posts.
export function activeCategorySlugs() {
  return [...new Set(contentPosts().map(({ data }) => data.category))];
}

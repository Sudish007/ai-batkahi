// Publish dry run: proves `npm test` stays green after a real admin publish.
// Writes a temporary 7th post in the (empty) `khabar` category, a draft and an
// image fixture, builds, runs the whole test suite, then removes all three.
// Usage: npm run dryrun   (exit 0 = green; 2 = build output assertions failed)
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parse } from "../src/lib/frontmatter.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_DIR = join(ROOT, "content", "posts");
const IMAGES_DIR = join(ROOT, "content", "images");
const DIST = join(ROOT, "dist");

const POST_FILE = join(POSTS_DIR, "97-dry-run-khabar.md");
const DRAFT_FILE = join(POSTS_DIR, "98-dry-run-draft.md");
const IMAGE_DIR = join(IMAGES_DIR, "dry-run");
const IMAGE_FILE = join(IMAGE_DIR, "x.webp");

const today = new Date().toISOString().slice(0, 10);
const TAGS = ["dry-run", "परीक्षण"];

function post({ title, draft }) {
  return `---
${draft ? "draft: true\n" : ""}title: ${title}
title_en: ${draft ? "Dry run draft post" : "Dry run news post"}
date: ${today}
category: khabar
tags: [${TAGS.join(", ")}]
summary: ई एगो अस्थायी परीक्षण पोस्ट बा जे प्रकाशन के बाद टेस्ट हरियर रहे कि ना, ई जाँचे खातिर लिखल गइल बा।
summary_en: A temporary test post that checks the test suite stays green after a publish.
instagram:
---

ई बतकही असली नइखे। ई खाली एह बात के जाँच खातिर बा कि जब एडमिन से नया पोस्ट छपेला, तब साइट के बनावट आ सब टेस्ट ठीक-ठाक चलत रहेला कि ना। एह में एगो नया विषय, एगो ड्राफ्ट आ एगो छवि शामिल बा।

## पहिला खंड

पहिला खंड में हम देखत बानी कि नया विषय के पन्ना बनेला कि ना, फिल्टर में ओकर नाम आवेला कि ना, आ घर के पन्ना पर गिनती सही होला कि ना। ई सब गिनती सामग्री से निकलेला, हाथ से लिखल नइखे।

![परीक्षण छवि](/images/dry-run/x.webp)

## दूसरा खंड

दूसरा खंड में छवि के चौड़ाई आ ऊँचाई के जाँच होला, जे बिना झटका के पन्ना लोड होखे खातिर जरूरी बा। एकरा बाद ई पूरा पोस्ट आ छवि हटा दिहल जाला, ताकि भंडार में कवनो बदलाव ना बाचे।

## In English

This is a temporary dry-run post. It exists only to prove that the build and the full test suite still pass after a new post, a new category, a draft and an image land in the repository. It is deleted right after the run.
`;
}

// 1x1 lossless WebP (RIFF / WEBP / VP8L), same layout as tests/image-size.test.js.
function webpVp8l1x1() {
  const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
  const u32le = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  const payload = [0x2f, 0, 0, 0, 0, 0, 0, 0]; // signature, 14-bit (w-1)=0, (h-1)=0
  const body = [...ascii("WEBP"), ...ascii("VP8L"), ...u32le(payload.length), ...payload];
  return Buffer.from([...ascii("RIFF"), ...u32le(body.length), ...body]);
}

// Same logic as tests/helpers.js contentPosts()/activeCategorySlugs().
function counts() {
  const posts = readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((file) => parse(readFileSync(join(POSTS_DIR, file), "utf8")).data)
    .filter((data) => !(data.draft === "true" || data.draft === true));
  const active = new Set(posts.map((d) => d.category));
  return { posts: posts.length, categories: active.size };
}

function run(args) {
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: "inherit" });
  return r.status ?? 1;
}

function assertBuilt() {
  const must = [
    join(DIST, "category", "khabar", "index.html"),
    // Slugs come from the filename (slugFromFilename), not title_en.
    join(DIST, "posts", "dry-run-khabar", "index.html"),
    join(DIST, "images", "dry-run", "x.webp"),
  ];
  const failures = must.filter((p) => !existsSync(p)).map((p) => `missing: ${p}`);
  const postHtml = existsSync(must[1]) ? readFileSync(must[1], "utf8") : "";
  if (!/<img [^>]*width="1" height="1"[^>]*>/.test(postHtml)) failures.push("post img lacks width=\"1\" height=\"1\"");
  if (existsSync(join(DIST, "posts", "dry-run-draft-post"))) failures.push("draft post was built");
  return failures;
}

for (const p of [POST_FILE, DRAFT_FILE, IMAGE_FILE, IMAGE_DIR]) {
  if (existsSync(p)) {
    console.error(`dry-run: refusing to run, path already exists: ${p}`);
    process.exit(1);
  }
}

const before = counts();
console.log(`dry-run before: ${before.posts} posts, ${before.categories} active categories`);

let code = 1;
try {
  mkdirSync(IMAGE_DIR, { recursive: true });
  writeFileSync(IMAGE_FILE, webpVp8l1x1());
  writeFileSync(POST_FILE, post({ title: "ड्राई-रन खबर", draft: false }), "utf8");
  writeFileSync(DRAFT_FILE, post({ title: "ड्राई-रन ड्राफ्ट", draft: true }), "utf8");
  const during = counts();
  console.log(`dry-run during: ${during.posts} posts, ${during.categories} active categories`);

  code = run(["src/build.js"]);
  if (code === 0) {
    const failures = assertBuilt();
    if (failures.length) {
      for (const f of failures) console.error(`dry-run: ${f}`);
      code = 2;
    }
  }
  if (code === 0) code = run(["--test", "tests/**/*.test.js"]);
} finally {
  rmSync(POST_FILE, { force: true });
  rmSync(DRAFT_FILE, { force: true });
  rmSync(IMAGE_DIR, { recursive: true, force: true });
  const after = counts();
  console.log(`dry-run after: ${after.posts} posts, ${after.categories} active categories`);
  console.log(`dry-run exit code: ${code}`);
}
process.exit(code);

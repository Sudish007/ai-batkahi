import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPosts, activeCategories, categoryCounts, relatedPosts } from "../src/lib/posts.js";

const categories = [
  { slug: "samajh", name: "समझ", description: "a" },
  { slug: "aujaar", name: "औजार", description: "b" },
  { slug: "khabar", name: "खबर", description: "c" },
];

function post({ title, date, category, tags, draft, inEnglish = true }) {
  return `---
title: ${title}
title_en: ${title} en
date: ${date}
category: ${category}
tags: [${tags.join(", ")}]
summary: सार।
summary_en: Summary.
${draft ? "draft: true\n" : ""}---

पहिला पैरा।

## पहिला खंड

कुछ बात।

## Model

आउर बात।
${inEnglish ? "\n## In English\n\nEnglish summary.\n" : ""}`;
}

const dir = mkdtempSync(join(tmpdir(), "batkahi-"));
writeFileSync(join(dir, "01-purana.md"), post({ title: "पुरान", date: "2026-10-01", category: "samajh", tags: ["डेटा", "मॉडल"] }), "utf8");
writeFileSync(join(dir, "02-naya.md"), post({ title: "नया", date: "2026-10-08", category: "aujaar", tags: ["ChatGPT", "डेटा"] }), "utf8");
writeFileSync(join(dir, "03-draft.md"), post({ title: "ड्राफ्ट", date: "2026-10-09", category: "khabar", tags: ["डेटा"], draft: true }), "utf8");

after(() => rmSync(dir, { recursive: true, force: true }));

const posts = loadPosts({ dir, categories, wordsPerMinute: 180 });

test("loadPosts skips drafts and returns the rest newest first with prev/next wired", () => {
  assert.equal(posts.length, 2);
  assert.deepEqual(posts.map((p) => p.slug), ["naya", "purana"]);
  assert.equal(posts[0].prev, null);
  assert.equal(posts[0].next, posts[1]);
  assert.equal(posts[1].prev, posts[0]);
  assert.equal(posts[1].next, null);
  assert.ok(!posts.some((p) => p.slug === "draft"));
  assert.equal(posts[0].minutes >= 1, true);
  assert.deepEqual(posts[0].toc, [
    { id: "section-1", text: "पहिला खंड" },
    { id: "model", text: "Model" },
  ]);
  assert.match(posts[0].inEnglishHtml, /English summary/);
});

test("relatedPosts returns the other post with the shared tag", () => {
  const [naya, purana] = posts;
  assert.deepEqual(relatedPosts(purana, posts), [{ post: naya, shared: ["डेटा"] }]);
  assert.deepEqual(relatedPosts(naya, posts), [{ post: purana, shared: ["डेटा"] }]);
});

test("activeCategories and categoryCounts ignore categories without posts", () => {
  assert.deepEqual(activeCategories(categories, posts).map((c) => c.slug), ["samajh", "aujaar"]);
  assert.deepEqual(
    categoryCounts(categories, posts).map(({ category, count }) => [category.slug, count]),
    [["samajh", 1], ["aujaar", 1]],
  );
});

test("a post without '## In English' throws with the file name", () => {
  const bad = mkdtempSync(join(tmpdir(), "batkahi-bad-"));
  writeFileSync(join(bad, "09-bina.md"), post({ title: "बिना", date: "2026-10-02", category: "samajh", tags: ["x"], inEnglish: false }), "utf8");
  try {
    assert.throws(
      () => loadPosts({ dir: bad, categories, wordsPerMinute: 180 }),
      (err) => err instanceof Error && err.message.includes("09-bina.md") && err.message.includes("In English"),
    );
  } finally {
    rmSync(bad, { recursive: true, force: true });
  }
});

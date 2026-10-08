import { test } from "node:test";
import assert from "node:assert/strict";
import config from "../site.config.js";
import { searchIndex } from "../src/lib/search-index.js";

const KEYS = ["slug", "url", "title", "title_en", "summary", "summary_en", "category", "categoryName", "tags", "date", "minutes"];

function fixture(slug, date, extra = {}) {
  return {
    slug,
    title: `शीर्षक ${slug}`,
    title_en: `Title ${slug}`,
    date,
    category: { slug: "samajh", name: "समझ" },
    tags: ["डेटा"],
    summary: "सार।",
    summary_en: "Summary.",
    minutes: 3,
    html: "<p>never indexed</p>",
    ...extra,
  };
}

test("searchIndex has v 1 and exactly the 11 schema keys per entry", () => {
  const index = searchIndex([fixture("a", "2026-10-08")]);
  assert.equal(index.v, 1);
  assert.deepEqual(Object.keys(index), ["v", "posts"]);
  assert.equal(index.posts.length, 1);
  assert.deepEqual(Object.keys(index.posts[0]).sort(), [...KEYS].sort());
  const e = index.posts[0];
  assert.equal(e.url, `${config.basePath}posts/a/`);
  assert.equal(e.category, "samajh");
  assert.equal(e.categoryName, "समझ");
  assert.deepEqual(e.tags, ["डेटा"]);
  assert.equal(e.minutes, 3);
});

test("summary and summary_en are capped at 240 characters", () => {
  const long = "क".repeat(300);
  const longEn = "e".repeat(300);
  const [e] = searchIndex([fixture("a", "2026-10-08", { summary: long, summary_en: longEn })]).posts;
  assert.equal(e.summary.length, 240);
  assert.equal(e.summary_en.length, 240);
  const [s] = searchIndex([fixture("b", "2026-10-08")]).posts;
  assert.equal(s.summary, "सार।");
});

test("input order is preserved", () => {
  const index = searchIndex([fixture("c", "2026-10-09"), fixture("a", "2026-10-08"), fixture("b", "2026-10-01")]);
  assert.deepEqual(index.posts.map((p) => p.slug), ["c", "a", "b"]);
});

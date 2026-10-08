import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, serialize } from "../src/lib/frontmatter.js";

test("parses scalar keys, inline tag list and empty values", () => {
  const md = `---
title: मशीन लर्निंग का होला?
title_en: What is machine learning?
date: 2026-10-08
category: samajh
tags: [machine learning, डेटा, मॉडल]
summary: "किसान: अनुभव से सीखेला।"
instagram:
---
# Body

Hello.
`;
  const { data, body } = parse(md);
  assert.equal(data.title, "मशीन लर्निंग का होला?");
  assert.equal(data.title_en, "What is machine learning?");
  assert.equal(data.date, "2026-10-08");
  assert.equal(data.category, "samajh");
  assert.deepEqual(data.tags, ["machine learning", "डेटा", "मॉडल"]);
  assert.equal(data.summary, "किसान: अनुभव से सीखेला।");
  assert.equal(data.instagram, "");
  assert.equal(body.trim(), "# Body\n\nHello.");
});

test("handles CRLF line endings and BOM", () => {
  const md = "\uFEFF---\r\ntitle: X\r\ntags: [a, b]\r\n---\r\nbody\r\n";
  const { data, body } = parse(md);
  assert.equal(data.title, "X");
  assert.deepEqual(data.tags, ["a", "b"]);
  assert.equal(body.trim(), "body");
});

test("returns empty data when there is no front matter", () => {
  const { data, body } = parse("just text");
  assert.deepEqual(data, {});
  assert.equal(body, "just text");
});

test("empty list parses to []", () => {
  const { data } = parse("---\ntags: []\n---\n");
  assert.deepEqual(data.tags, []);
});

// ---------------------------------------------------------------------------
// serialize(): every fixture must round-trip through parse() unchanged.
// The admin writes files with serialize(); the build reads them with parse().

const base = {
  title: "मशीन लर्निंग का होला?",
  title_en: "What is machine learning?",
  date: "2026-10-08",
  category: "samajh",
  tags: ["machine learning", "डेटा", "मॉडल"],
  summary: "किसान अनुभव से सीखेला।",
  summary_en: "A farmer learns from experience.",
  instagram: "https://www.instagram.com/p/abc/",
};

// What parse() hands back for a given input: draft becomes the string "true"
// when set and is absent otherwise; newlines in scalars collapse to a space.
function expected(input) {
  const out = {};
  if (input.draft === true || input.draft === "true") out.draft = "true";
  for (const key of ["title", "title_en", "date", "category", "tags", "summary", "summary_en", "instagram"]) {
    const v = input[key];
    out[key] = Array.isArray(v) ? v : String(v ?? "").replace(/\r?\n/g, " ");
  }
  return out;
}

const fixtures = [
  ["plain post", {}],
  ["title with ':' (single-quoted because it also has inner double quotes)", { title: 'AI के "बुद्धि": सच?' }],
  ["title with ':' only", { title: "AI: का होला?" }],
  ["title with inner single quote (double-quoted)", { title: "किसान के 'अनुभव' आ AI" }],
  ["value with '#'", { summary: "खंड #2 में देखीं" }],
  ["leading '['", { title: "[ड्राफ्ट] पहिला बात" }],
  ["leading '#'", { title_en: "#1 question about AI" }],
  ["leading '-'", { summary_en: "- not a list item" }],
  ["leading '>'", { summary: "> उद्धरण नइखे" }],
  ["leading '*'", { summary_en: "*starred* opening" }],
  ["leading '@'", { title_en: "@batkahi on AI" }],
  ["leading '\"'", { title_en: '"Quoted" title' }],
  ["leading \"'\"", { title_en: "'Quoted' title" }],
  ["leading spaces", { title: "  अगुआ खाली जगह" }],
  ["trailing spaces", { title_en: "trailing spaces   " }],
  ["Devanagari + Latin mix", { title: "ChatGPT से सही सवाल कइसे पूछीं", summary_en: "Mixing देवनागरी and Latin" }],
  ["embedded newline collapsed to a space", { summary: "पहिला लाइन\nदूसरा लाइन" }],
  ["CRLF collapsed to a space", { summary_en: "first\r\nsecond" }],
  ["empty instagram", { instagram: "" }],
  ["one tag", { tags: ["AI"] }],
  ["eight tags", { tags: ["a", "b", "c", "d", "e", "f", "g", "ह"] }],
  ["draft true", { draft: true }],
  ["draft as the string 'true'", { draft: "true" }],
  ["draft false", { draft: false }],
  ["date string untouched", { date: "2027-01-31" }],
  ["summary with a question mark and danda", { summary: "का ई सच बा? हँ।" }],
  ["summary_en with a URL (contains ':')", { summary_en: "See https://example.com for details" }],
];

for (const [name, patch] of fixtures) {
  test(`serialize round-trips: ${name}`, () => {
    const input = { ...base, ...patch };
    const text = serialize(input);
    assert.ok(text.startsWith("---\n"), "starts with a fence");
    assert.ok(text.endsWith("---\n"), "ends with a fence");
    const { data, body } = parse(text + "\nbody\n");
    assert.deepEqual(data, expected(input));
    assert.equal(body.trim(), "body");
  });
}

test("serialize puts 'draft: true' on the first line and omits the key otherwise", () => {
  const draft = serialize({ ...base, draft: true }).split("\n");
  assert.equal(draft[1], "draft: true");
  assert.equal(draft[2].startsWith("title:"), true);
  const published = serialize({ ...base, draft: false });
  assert.ok(!published.includes("draft"));
  assert.ok(!serialize(base).includes("draft"));
});

test("serialize key order is title, title_en, date, category, tags, summary, summary_en, instagram", () => {
  const keys = serialize(base)
    .split("\n")
    .filter((l) => l && l !== "---")
    .map((l) => l.slice(0, l.indexOf(":")));
  assert.deepEqual(keys, ["title", "title_en", "date", "category", "tags", "summary", "summary_en", "instagram"]);
});

test("serialize picks the quote style that does not occur in the value", () => {
  assert.match(serialize({ ...base, title: 'AI के "बुद्धि": सच?' }), /^title: 'AI के "बुद्धि": सच\?'$/m);
  assert.match(serialize({ ...base, title: "AI: 'सच'" }), /^title: "AI: 'सच'"$/m);
  assert.match(serialize({ ...base, title: "सादा शीर्षक" }), /^title: सादा शीर्षक$/m);
});

test("serialize emits an empty instagram bare and tags unquoted", () => {
  const text = serialize({ ...base, instagram: "" });
  assert.match(text, /^instagram:$/m);
  assert.match(text, /^tags: \[machine learning, डेटा, मॉडल\]$/m);
});

test("serialize throws on a value with both quote kinds", () => {
  assert.throws(() => serialize({ ...base, title: `AI के "बुद्धि": 'सच'?` }), /mixed quotes/);
});

test("serialize throws on tags containing ',', '[' or ']' or empty", () => {
  assert.throws(() => serialize({ ...base, tags: ["a,b"] }), /invalid tag/);
  assert.throws(() => serialize({ ...base, tags: ["[a"] }), /invalid tag/);
  assert.throws(() => serialize({ ...base, tags: ["a]"] }), /invalid tag/);
  assert.throws(() => serialize({ ...base, tags: [""] }), /invalid tag/);
  assert.throws(() => serialize({ ...base, tags: ["   "] }), /invalid tag/);
});

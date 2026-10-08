import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "../src/lib/frontmatter.js";

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

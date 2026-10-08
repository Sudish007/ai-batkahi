import { test } from "node:test";
import assert from "node:assert/strict";
import { extractToc } from "../src/lib/toc.js";
import { renderMarkdown } from "../src/lib/markdown.js";

test("extractToc returns h2 ids and text in document order", () => {
  const html = `<p>intro</p>
<h2 id="section-1">किसान के अनुभव</h2>
<p>…</p>
<h3 id="section-2">उप-खंड</h3>
<h2 id="data">Data &amp; Model</h2>`;
  assert.deepEqual(extractToc(html), [
    { id: "section-1", text: "किसान के अनुभव" },
    { id: "data", text: "Data &amp; Model" },
  ]);
});

test("extractToc strips inner tags but keeps entities", () => {
  const html = `<h2 id="a">With <em>emphasis</em> and <code>code &lt;x&gt;</code></h2>
<h2 id="b">Plain</h2>`;
  assert.deepEqual(extractToc(html), [
    { id: "a", text: "With emphasis and code &lt;x&gt;" },
    { id: "b", text: "Plain" },
  ]);
});

test("extractToc with zero or one h2 returns []", () => {
  assert.deepEqual(extractToc("<p>no headings</p>"), []);
  assert.deepEqual(extractToc("<h1 id=\"t\">Title</h1><h3 id=\"x\">x</h3>"), []);
  assert.deepEqual(extractToc("<h2 id=\"only\">Only</h2>"), []);
});

test("renderMarkdown gives duplicate headings unique ids (-2, -3)", () => {
  const html = renderMarkdown("## Data\n\n## Data\n\n## Data");
  assert.match(html, /<h2 id="data">/);
  assert.match(html, /<h2 id="data-2">/);
  assert.match(html, /<h2 id="data-3">/);
  assert.deepEqual(extractToc(html).map((t) => t.id), ["data", "data-2", "data-3"]);
});

test("heading ids restart per renderMarkdown call", () => {
  assert.match(renderMarkdown("## Data"), /<h2 id="data">/);
  assert.match(renderMarkdown("## Data"), /<h2 id="data">/);
});

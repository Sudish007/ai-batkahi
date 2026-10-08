import { test } from "node:test";
import assert from "node:assert/strict";
import { countWords, readingMinutes } from "../src/lib/reading-time.js";

test("countWords ignores markdown syntax and code", () => {
  const md = `## शीर्षक

एक दू तीन [लिंक](https://example.com) \`code\` **चार**

\`\`\`
ignored code block words here
\`\`\`
`;
  // शीर्षक, एक, दू, तीन, लिंक, चार = 6
  assert.equal(countWords(md), 6);
});

test("countWords returns 0 for empty input", () => {
  assert.equal(countWords(""), 0);
  assert.equal(countWords("   \n"), 0);
});

test("readingMinutes floors at 1 and rounds up", () => {
  assert.equal(readingMinutes(0, 180), 1);
  assert.equal(readingMinutes(180, 180), 1);
  assert.equal(readingMinutes(181, 180), 2);
  assert.equal(readingMinutes(900, 180), 5);
});

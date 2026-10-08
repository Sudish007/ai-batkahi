import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { DIST, htmlFiles, read } from "./helpers.js";

// View-transition names are assigned in CSS (and, for the clicked card title,
// by JS at navigation time). A dist-HTML "no duplicates" check would be vacuous,
// so the stylesheet is the thing to test: exactly the two documented names, each
// declared once, and each of their selectors matches at most one element per page.

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

test("stylesheet declares exactly the view-transition names masthead and post-title, once each", () => {
  const css = stripComments(read(join(DIST, "styles.css")));
  const names = [...css.matchAll(/view-transition-name\s*:\s*([a-z0-9-]+)/g)].map((m) => m[1]);
  assert.deepEqual([...names].sort(), ["masthead", "post-title"]);
  for (const name of new Set(names)) {
    assert.equal(names.filter((n) => n === name).length, 1, `${name} declared more than once`);
  }
  assert.equal((css.match(/@view-transition\b/g) || []).length, 1, "@view-transition rule count");
});

test("every page has one masthead and one h1 (the named elements are unique)", () => {
  for (const file of htmlFiles()) {
    const html = read(file);
    assert.equal((html.match(/class="masthead"/g) || []).length, 1, `${file}: masthead`);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${file}: h1`);
  }
});

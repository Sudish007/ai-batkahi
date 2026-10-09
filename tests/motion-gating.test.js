import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { DIST, read } from "./helpers.js";

const GATE = "@media (prefers-reduced-motion: no-preference)";
const MOTION_DECL = /^\s*(transition|animation)(-[a-z-]+)?\s*:\s*([^;]+)/m;

// Walk a stylesheet with a brace-depth stack of at-rule preludes and return
// every motion declaration / @view-transition rule that is NOT enclosed by the
// reduced-motion gate. `view-transition-name` is a plain property (ignored),
// `@keyframes` may live anywhere, and a `none` value disables motion so it is
// allowed outside the gate (print styles use it).
export function ungatedMotion(cssText) {
  const css = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
  const stack = []; // prelude of each open block
  const offenders = [];
  let buf = "";
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") {
      const prelude = buf.trim();
      if (prelude.startsWith("@view-transition") && !stack.includes(GATE)) {
        offenders.push(prelude);
      }
      stack.push(prelude);
      buf = "";
    } else if (ch === "}") {
      checkDecls(buf, stack, offenders);
      stack.pop();
      buf = "";
    } else if (ch === ";") {
      checkDecls(buf + ";", stack, offenders);
      buf = "";
    } else {
      buf += ch;
    }
  }
  return offenders;
}

function checkDecls(chunk, stack, offenders) {
  const m = chunk.match(MOTION_DECL);
  if (!m) return;
  if (m[3].trim() === "none") return;
  if (stack.some((p) => p.startsWith("@keyframes"))) return;
  if (!stack.includes(GATE)) offenders.push(`${stack.join(" > ")} :: ${m[0].trim()}`);
}

test("scanner rejects a top-level transition and accepts a gated one", () => {
  const bad = "a { color: red; transition: color 1s }";
  assert.equal(ungatedMotion(bad).length, 1);
  const good = `${GATE} { a { transition: color 1s } }`;
  assert.deepEqual(ungatedMotion(good), []);
  assert.deepEqual(ungatedMotion(".x { view-transition-name: masthead }"), []);
  assert.deepEqual(ungatedMotion("@keyframes rise { from { translate: 0 10px } }"), []);
  assert.deepEqual(ungatedMotion("@media print { .reveal { animation: none } }"), []);
  assert.equal(ungatedMotion("@view-transition { navigation: auto }").length, 1);
  assert.equal(ungatedMotion("@media (hover: hover) { a::after { transition: transform 1s } }").length, 1);
});

test("every transition/animation/@view-transition in dist/styles.css is gated", () => {
  const css = read(join(DIST, "styles.css"));
  assert.ok(css.includes(GATE), "gate block missing");
  assert.deepEqual(ungatedMotion(css), []);
});

test("admin.css declares no motion at all", () => {
  const adminCss = read(join(DIST, "admin", "admin.css"));
  assert.deepEqual(ungatedMotion(adminCss), []);
  assert.ok(!/\b(transition|animation)\b/.test(adminCss.replace(/\/\*[\s\S]*?\*\//g, "")));
});
test("the stylesheet has exactly one reduced-motion gate block", () => {
  const css = read(join(DIST, "styles.css")).replace(/\/\*[\s\S]*?\*\//g, "");
  const gates = css.split(GATE).length - 1;
  assert.equal(gates, 1);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { DIST, read } from "./helpers.js";

const css = read(join(DIST, "styles.css"));
const ROOT_PX = 16;

// Resolve --fs-* tokens (declared as rem) to px.
const tokens = {};
for (const m of css.matchAll(/(--fs-[a-z0-9]+):\s*([\d.]+)(rem|px)/g)) {
  const px = m[3] === "rem" ? Number(m[2]) * ROOT_PX : Number(m[2]);
  // keep the smallest declaration per token (media overrides only go up)
  tokens[m[1]] = tokens[m[1]] === undefined ? px : Math.min(tokens[m[1]], px);
}

test("every --fs-* token is at least 12px", () => {
  assert.ok(Object.keys(tokens).length >= 7);
  for (const [name, px] of Object.entries(tokens)) {
    assert.ok(px >= 12, `${name} = ${px}px`);
  }
});

test("every font-size declaration resolves to >= 12px", () => {
  for (const m of css.matchAll(/font-size:\s*([^;]+);/g)) {
    const v = m[1].trim();
    if (v === "inherit") continue;
    const varRef = v.match(/^var\((--fs-[a-z0-9]+)\)$/);
    if (varRef) {
      assert.ok(tokens[varRef[1]] >= 12, `${v} -> ${tokens[varRef[1]]}px`);
      continue;
    }
    const num = v.match(/^([\d.]+)(rem|em|px)$/);
    assert.ok(num, `unparseable font-size: ${v}`);
    const px = num[2] === "px" ? Number(num[1]) : Number(num[1]) * ROOT_PX;
    assert.ok(px >= 12, `font-size ${v} = ${px}px`);
  }
});

test("body font-size is >= 16px and uses --fs-base", () => {
  const body = css.match(/\nbody\s*\{([^}]*)\}/);
  assert.ok(body);
  assert.match(body[1], /font-size:\s*var\(--fs-base\)/);
  assert.ok(tokens["--fs-base"] >= 16, `--fs-base = ${tokens["--fs-base"]}px`);
});

test("no gradients, shadows or filters in the stylesheet", () => {
  assert.ok(!/gradient/.test(css));
  assert.ok(!/box-shadow/.test(css));
  assert.ok(!/\bfilter:/.test(css));
  assert.ok(!/fonts\.googleapis/.test(css));
});

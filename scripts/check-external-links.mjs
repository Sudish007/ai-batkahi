// Scan dist/**/*.html for external http(s) links and verify each returns 200
// after following redirects. Exit 1 if any link fails. Run via `npm run check-links`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import config from "../site.config.js";

const DIST = new URL("../dist/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const TIMEOUT_MS = 20_000;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

// Canonical / og:url self-references point at siteUrl and are not external links.
const urls = new Set();
for (const file of walk(DIST)) {
  const html = readFileSync(file, "utf8");
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    const u = m[1].replace(/&amp;/g, "&");
    if (u.startsWith(config.siteUrl)) continue;
    urls.add(u);
  }
}

async function check(u) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(u, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      signal: ctrl.signal,
    });
    return { url: u, status: res.status, final: res.url };
  } catch (err) {
    return { url: u, status: 0, error: String(err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

const results = await Promise.all([...urls].sort().map(check));
let failed = 0;
for (const r of results) {
  const ok = r.status === 200;
  if (!ok) failed += 1;
  const extra = r.error ? ` (${r.error})` : r.final && r.final !== r.url ? ` -> ${r.final}` : "";
  console.log(`${ok ? "OK  " : "FAIL"} ${r.status} ${r.url}${extra}`);
}
console.log(`\n${results.length} external links, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

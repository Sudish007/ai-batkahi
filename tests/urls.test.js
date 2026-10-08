import { test } from "node:test";
import assert from "node:assert/strict";
import config from "../site.config.js";
import { url, absUrl } from "../src/lib/urls.js";
import { formatBhojpuriDate, toAtomDate } from "../src/lib/dates.js";
import { escapeXml } from "../src/lib/xml.js";

test("url() prefixes basePath and strips leading slashes", () => {
  assert.equal(url("posts/x/"), `${config.basePath}posts/x/`);
  assert.equal(url("/posts/x/"), `${config.basePath}posts/x/`);
  assert.equal(url(""), config.basePath);
  assert.ok(url("posts/x/").startsWith("/ai-batkahi/"));
});

test("absUrl() uses siteUrl origin + basePath", () => {
  assert.equal(absUrl("feed.xml"), "https://sudish007.github.io/ai-batkahi/feed.xml");
  assert.equal(absUrl(""), "https://sudish007.github.io/ai-batkahi/");
});

test("Bhojpuri date formatting", () => {
  assert.equal(formatBhojpuriDate("2026-10-08"), "8 अक्टूबर 2026");
  assert.equal(formatBhojpuriDate("2027-01-15"), "15 जनवरी 2027");
  assert.equal(toAtomDate("2026-10-08"), "2026-10-08T00:00:00Z");
  assert.throws(() => formatBhojpuriDate("08/10/2026"));
});

test("escapeXml escapes the five XML specials", () => {
  assert.equal(escapeXml(`<a href="x">&'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;");
});

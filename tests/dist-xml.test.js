import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { XMLValidator, XMLParser } from "fast-xml-parser";
import config from "../site.config.js";
import categories from "../content/categories.js";
import { DIST, read, activeCategorySlugs } from "./helpers.js";

const feed = read(join(DIST, "feed.xml"));
const sitemap = read(join(DIST, "sitemap.xml"));

test("feed.xml is well-formed Atom with <= 20 entries and absolute URLs", () => {
  assert.equal(XMLValidator.validate(feed), true);
  const doc = new XMLParser({ ignoreAttributes: false }).parse(feed);
  assert.ok(doc.feed, "root <feed>");
  assert.equal(doc.feed["@_xmlns"], "http://www.w3.org/2005/Atom");
  const entries = [].concat(doc.feed.entry || []);
  assert.ok(entries.length >= 1 && entries.length <= config.feedLimit);
  assert.ok(String(doc.feed.id).startsWith(config.siteUrl));
  for (const e of entries) {
    assert.ok(String(e.id).startsWith(config.siteUrl), `entry id absolute: ${e.id}`);
    assert.ok(String(e.link["@_href"]).startsWith(config.siteUrl));
    assert.match(String(e.updated), /^\d{4}-\d{2}-\d{2}T00:00:00Z$/);
    assert.equal(e.content["@_type"], "html");
  }
});

test("feed entry content HTML is escaped (no raw tags inside <content>)", () => {
  const inner = feed.match(/<content type="html"[^>]*>([\s\S]*?)<\/content>/);
  assert.ok(inner, "content element present");
  assert.ok(!/<p>|<h2/.test(inner[1]), "raw HTML tags must be escaped");
  assert.ok(/&lt;p&gt;/.test(inner[1]));
});

test("feed entry links to other posts are absolute", () => {
  assert.ok(!feed.includes(`href=&quot;${config.basePath}`), "basePath-relative link leaked into feed");
});

test("sitemap.xml is well-formed with absolute <loc> values and no inactive category", () => {
  assert.equal(XMLValidator.validate(sitemap), true);
  const doc = new XMLParser().parse(sitemap);
  const urls = [].concat(doc.urlset.url);
  assert.ok(urls.length >= 10);
  for (const u of urls) {
    assert.ok(String(u.loc).startsWith(config.siteUrl), `loc absolute: ${u.loc}`);
  }
  const active = new Set(activeCategorySlugs());
  for (const { slug } of categories) {
    assert.equal(sitemap.includes(`/category/${slug}/`), active.has(slug), slug);
  }
});

test("robots.txt allows all and points at the sitemap", () => {
  const robots = read(join(DIST, "robots.txt"));
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.ok(robots.includes(`Sitemap: ${config.siteUrl}/sitemap.xml`));
});

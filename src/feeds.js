import config from "../site.config.js";
import { url, absUrl } from "./lib/urls.js";
import { escapeXml } from "./lib/xml.js";
import { toAtomDate } from "./lib/dates.js";

// Feed content is read outside the site, so basePath-relative links are
// upgraded to absolute URLs before the HTML is escaped into the entry.
function absolutify(html) {
  const origin = new URL(config.siteUrl).origin;
  const base = config.basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(new RegExp(`(href|src)="${base}`, "g"), `$1="${origin}${config.basePath}`);
}

export function atomFeed(posts) {
  const entries = posts.slice(0, config.feedLimit);
  const updated = entries.length ? toAtomDate(entries[0].date) : toAtomDate("2026-10-08");
  const items = entries
    .map((p) => {
      const link = absUrl(`posts/${p.slug}/`);
      const content = absolutify(`${p.html}\n<h2 lang="en">In English</h2>\n${p.inEnglishHtml}`);
      return `  <entry>
    <id>${escapeXml(link)}</id>
    <title>${escapeXml(p.title)}</title>
    <link rel="alternate" type="text/html" href="${escapeXml(link)}"/>
    <published>${toAtomDate(p.date)}</published>
    <updated>${toAtomDate(p.date)}</updated>
    <author><name>${escapeXml(config.author.name)}</name></author>
    <category term="${escapeXml(p.category.slug)}" label="${escapeXml(p.category.name)}"/>
    <summary>${escapeXml(p.summary)}</summary>
    <content type="html" xml:lang="bho">${escapeXml(content)}</content>
  </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="bho">
  <id>${escapeXml(absUrl(""))}</id>
  <title>${escapeXml(config.title)}</title>
  <subtitle>${escapeXml(config.tagline)}</subtitle>
  <updated>${updated}</updated>
  <link rel="self" type="application/atom+xml" href="${escapeXml(absUrl("feed.xml"))}"/>
  <link rel="alternate" type="text/html" href="${escapeXml(absUrl(""))}"/>
  <author><name>${escapeXml(config.author.name)}</name></author>
  <icon>${escapeXml(absUrl("apple-touch-icon.png"))}</icon>
${items}
</feed>
`;
}

export function sitemap(posts, activeCategories) {
  const pages = [
    { loc: absUrl(""), lastmod: posts[0]?.date },
    { loc: absUrl("posts/"), lastmod: posts[0]?.date },
    ...posts.map((p) => ({ loc: absUrl(`posts/${p.slug}/`), lastmod: p.date })),
    ...activeCategories.map((c) => ({
      loc: absUrl(`category/${c.slug}/`),
      lastmod: posts.find((p) => p.category.slug === c.slug)?.date,
    })),
    { loc: absUrl("about/"), lastmod: posts[0]?.date },
  ];
  const items = pages
    .map(
      (p) =>
        `  <url>\n    <loc>${escapeXml(p.loc)}</loc>${p.lastmod ? `\n    <lastmod>${p.lastmod}</lastmod>` : ""}\n  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>
`;
}

export function robots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${absUrl("sitemap.xml")}\n`;
}

export { url };

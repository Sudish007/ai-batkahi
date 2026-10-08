// Marked-agnostic Markdown core, shared verbatim with the browser admin
// (the build copies this file next to slugify.js and xml.js into
// dist/admin/lib/). It must import nothing else and nothing from node:.
import { slugify } from "./slugify.js";
import { escapeHtml } from "./xml.js";

// The one Marked configuration both the generator and the preview use.
export const MARKED_OPTIONS = { gfm: true, breaks: false };

// Heading ids: Latin slug when the text has Latin characters, otherwise a
// stable positional id (Devanagari headings produce an empty Latin slug).
// Ids are unique per render: repeats get -2, -3, … suffixes.
//
// resolveUrl(href) maps root-relative hrefs ("/posts/x/", "/images/a.webp");
// the generator rewrites them under basePath, the admin preview maps images
// to blob:/raw URLs. imageSizes is { "/images/…": { width, height } };
// onMissingSize(href) fires once per image without an entry.
export function createRenderer({ resolveUrl = (h) => h, imageSizes = {}, onMissingSize = () => {} } = {}) {
  let count = 0;
  const used = new Set();
  return {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const plain = text.replace(/<[^>]+>/g, "");
      count += 1;
      const latin = slugify(plain);
      const base = latin !== "" ? latin : `section-${count}`;
      let id = base;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
      used.add(id);
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const external = /^https?:\/\//i.test(href);
      // Root-relative links in Markdown ("/posts/x/") are rewritten under basePath.
      const resolved = href.startsWith("/") ? resolveUrl(href) : href;
      const attrs = [`href="${escapeHtml(resolved)}"`];
      if (title) attrs.push(`title="${escapeHtml(title)}"`);
      if (external) attrs.push('rel="noopener"');
      return `<a ${attrs.join(" ")}>${text}</a>`;
    },
    image({ href, title, text }) {
      const attrs = [
        `src="${escapeHtml(resolveUrl(href))}"`,
        `alt="${escapeHtml(text || "")}"`,
        'loading="lazy"',
        'decoding="async"',
      ];
      if (title) attrs.push(`title="${escapeHtml(title)}"`);
      const size = imageSizes[href];
      if (size) attrs.push(`width="${size.width}"`, `height="${size.height}"`);
      else onMissingSize(href);
      return `<img ${attrs.join(" ")}>`;
    },
  };
}

// Split the trailing "## In English" section out of the body.
export function splitInEnglish(markdown) {
  const re = /^##\s+In English\s*$/im;
  const m = re.exec(markdown);
  if (!m) return { body: markdown, inEnglish: "" };
  const body = markdown.slice(0, m.index).trimEnd() + "\n";
  const inEnglish = markdown.slice(m.index + m[0].length).trim();
  return { body, inEnglish };
}

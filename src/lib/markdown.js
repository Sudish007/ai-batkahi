import { Marked } from "marked";
import { slugify } from "./slugify.js";
import { escapeHtml } from "./xml.js";
import { url } from "./urls.js";

// Heading ids: Latin slug when the text has Latin characters, otherwise a
// stable positional id (Devanagari headings produce an empty Latin slug).
function makeRenderer() {
  let count = 0;
  return {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const plain = text.replace(/<[^>]+>/g, "");
      count += 1;
      const latin = slugify(plain);
      const id = latin !== "" ? latin : `section-${count}`;
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const external = /^https?:\/\//i.test(href);
      // Root-relative links in Markdown ("/posts/x/") are rewritten under basePath.
      const resolved = href.startsWith("/") ? url(href) : href;
      const attrs = [`href="${escapeHtml(resolved)}"`];
      if (title) attrs.push(`title="${escapeHtml(title)}"`);
      if (external) attrs.push('rel="noopener"');
      return `<a ${attrs.join(" ")}>${text}</a>`;
    },
  };
}

export function renderMarkdown(markdown) {
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({ renderer: makeRenderer() });
  return marked.parse(markdown);
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

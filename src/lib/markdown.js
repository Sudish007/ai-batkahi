// Node wrapper around the shared Markdown core (markdown-core.js). Knows about
// Marked and basePath; the admin preview uses the core directly in the browser
// with its own resolveUrl, so renderer logic must live in the core, not here.
import { Marked } from "marked";
import { url } from "./urls.js";
import { MARKED_OPTIONS, createRenderer, splitInEnglish } from "./markdown-core.js";

export { splitInEnglish };

export function renderMarkdown(markdown, { imageSizes = {} } = {}) {
  const marked = new Marked(MARKED_OPTIONS);
  marked.use({
    renderer: createRenderer({
      resolveUrl: (h) => (h.startsWith("/") ? url(h) : h),
      imageSizes,
      onMissingSize: (h) => console.log(`warn: image without dimensions: ${h}`),
    }),
  });
  return marked.parse(markdown);
}

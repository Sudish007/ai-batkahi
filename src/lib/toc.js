// Table of contents from rendered post HTML: every <h2 id="…">…</h2>, in order.
// Inner tags (<em>, <code>, <a>…) are stripped; entities are kept as-is.
// A contents list needs at least two entries: zero or one H2 -> [].
export function extractToc(html) {
  const toc = [];
  for (const m of html.matchAll(/<h2 id="([^"]*)"[^>]*>([\s\S]*?)<\/h2>/g)) {
    toc.push({ id: m[1], text: m[2].replace(/<[^>]+>/g, "").trim() });
  }
  return toc.length >= 2 ? toc : [];
}

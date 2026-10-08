// Build-time search index written to dist/search.json (consumed by the palette).
import { url } from "./urls.js";

const SUMMARY_MAX = 240;

function truncate(text) {
  const s = String(text || "");
  return s.length > SUMMARY_MAX ? s.slice(0, SUMMARY_MAX) : s;
}

export function searchIndex(posts) {
  return {
    v: 1,
    posts: posts.map((p) => ({
      slug: p.slug,
      url: url(`posts/${p.slug}/`),
      title: p.title,
      title_en: p.title_en,
      summary: truncate(p.summary),
      summary_en: truncate(p.summary_en),
      category: p.category.slug,
      categoryName: p.category.name,
      tags: p.tags,
      date: p.date,
      minutes: p.minutes,
    })),
  };
}

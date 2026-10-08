import { escapeHtml } from "../lib/xml.js";
import { layout } from "./layout.js";
import { postGrid } from "./partials.js";

export function categoryPage({ category, posts }) {
  const body = `<header class="page-header">
  <h1>${escapeHtml(category.name)} <span class="slug-hint" lang="en">${escapeHtml(category.slug)}</span></h1>
  <p class="lede">${escapeHtml(category.description)}</p>
  <p class="count">${posts.length} बतकही</p>
</header>

${postGrid(posts, { kind: "cards", headingLevel: 2 })}`;

  return layout({
    title: category.name,
    description: `${category.name} (${category.slug}) — ${category.description}`,
    path: `category/${category.slug}/`,
    body,
    bodyClass: "page-category",
  });
}

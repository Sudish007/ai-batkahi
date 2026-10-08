import { url } from "../lib/urls.js";
import { escapeHtml } from "../lib/xml.js";
import { layout } from "./layout.js";
import { postGrid } from "./partials.js";

export function postsIndexPage({ posts, activeCategories }) {
  const filters = activeCategories
    .map(
      (c) =>
        `<li><a href="${url(`category/${c.slug}/`)}" data-filter="${c.slug}">${escapeHtml(c.name)}</a></li>`,
    )
    .join("\n    ");

  const body = `<header class="page-header">
  <h1>सब बतकही</h1>
  <p class="lede">अबले ${posts.length} बतकही। विषय चुन के छाँटीं, या सब एके साथ पढ़ीं।</p>
</header>

<nav class="filter" aria-label="विषय">
  <ul>
    <li><a href="${url("posts/")}" data-filter="all" aria-current="true">सब</a></li>
    ${filters}
  </ul>
  <p class="filter-status" role="status" aria-live="polite"></p>
</nav>

${postGrid(posts, { kind: "cards", headingLevel: 2 })}`;

  return layout({
    title: "सब बतकही",
    description: "All posts from AI Batkahi — AI, machine learning and data science explained in Bhojpuri.",
    path: "posts/",
    body,
    bodyClass: "page-posts",
  });
}

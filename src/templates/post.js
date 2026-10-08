import config from "../../site.config.js";
import { url } from "../lib/urls.js";
import { escapeHtml } from "../lib/xml.js";
import { formatBhojpuriDate } from "../lib/dates.js";
import { layout } from "./layout.js";

// Eyebrow meta: category link · date · reading time. Shown once, above the
// title (the right rail never repeats it).
function eyebrowMeta(post) {
  return `<a href="${url(`category/${post.category.slug}/`)}">${escapeHtml(post.category.name)}</a> · <time datetime="${post.date}">${formatBhojpuriDate(post.date)}</time> · पढ़े में ~${post.minutes} मिनट`;
}

// related: [{ post, shared }] from relatedPosts(); empty -> no section.related.
export function postPage({ post, prev, next, related = [] }) {
  const tags = post.tags.length
    ? `<ul class="tags" aria-label="टैग">
${post.tags.map((t) => `        <li>${escapeHtml(t)}</li>`).join("\n")}
      </ul>`
    : "";

  const instaHref = post.instagram || config.instagramUrl;
  const instaText = post.instagram
    ? `ई बतकही Instagram पर भी देखीं: ${escapeHtml(config.instagramHandle)}`
    : `छोट-छोट बतकही Instagram पर भी: ${escapeHtml(config.instagramHandle)}`;

  // Native <details> works without JS (open by default). The inline script right
  // after it collapses it below 75em during parsing (before first paint, so the
  // body never shifts); main.js keeps it in sync and forces it open at >= 75em,
  // where the summary is hidden and the plain p.toc-title is shown instead so
  // the rail cannot be collapsed.
  const toc = post.toc.length >= 2
    ? `<details class="toc-wrap" open>
    <summary class="toc-title eyebrow">एह बतकही में</summary>
    <p class="toc-title eyebrow" aria-hidden="true">एह बतकही में</p>
    <nav class="toc" aria-label="एह बतकही में">
      <ol id="toc-list">
${post.toc.map((t) => `        <li><a href="#${t.id}">${t.text}</a></li>`).join("\n")}
        <li><a href="#in-english-heading" lang="en">In English</a></li>
      </ol>
    </nav>
  </details>
  <script>if(!matchMedia("(min-width: 75em)").matches)document.querySelector(".toc-wrap").open=false;</script>`
    : "";

  const relatedSection = related.length
    ? `<section class="related" aria-labelledby="related-heading">
      <h2 class="eyebrow" id="related-heading">मिलत-जुलत बतकही</h2>
      <ul>
${related
  .map(
    (r) => `        <li><article><h3 class="post-item-title"><a href="${url(`posts/${r.post.slug}/`)}">${escapeHtml(r.post.title)}</a></h3><p class="related-why">एही टैग पर: ${r.shared.map(escapeHtml).join(", ")}</p></article></li>`,
  )
  .join("\n")}
      </ul>
    </section>`
    : "";

  const navItems = [];
  if (prev) {
    navItems.push(`<a class="post-nav-prev" href="${url(`posts/${prev.slug}/`)}" rel="prev"><span class="eyebrow">पिछला बतकही</span><span class="post-nav-title">${escapeHtml(prev.title)}</span></a>`);
  }
  if (next) {
    navItems.push(`<a class="post-nav-next" href="${url(`posts/${next.slug}/`)}" rel="next"><span class="eyebrow">अगला बतकही</span><span class="post-nav-title">${escapeHtml(next.title)}</span></a>`);
  }
  const postNav = navItems.length
    ? `<nav class="post-nav" aria-label="आगे-पीछे">
${navItems.join("\n")}
</nav>`
    : "";

  const body = `<article class="post">
  <header class="post-header">
    <p class="eyebrow">${eyebrowMeta(post)}</p>
    <h1>${escapeHtml(post.title)}</h1>
    <p class="title-en" lang="en">${escapeHtml(post.title_en)}</p>
  </header>

  ${toc}

  <div class="post-body">
    <div class="prose">
${post.html}
    </div>

    <section class="in-english" lang="en" aria-labelledby="in-english-heading">
      <p class="eyebrow"><span lang="en">Summary</span></p>
      <h2 id="in-english-heading">In English</h2>
${post.inEnglishHtml}
    </section>

    <footer class="post-footer">
      ${tags}
      <p class="insta"><a href="${instaHref}" rel="noopener">${instaText}</a></p>
    </footer>
  </div>

  <aside class="post-rail" aria-label="एह बतकही के बारे में">
    <a class="rail-en" href="#in-english-heading">In English पढ़ीं</a>
    <div class="share" hidden>
      <button type="button" class="copy-link">लिंक कॉपी करीं</button>
      <button type="button" class="web-share" hidden>शेयर करीं</button>
      <span class="share-status" role="status" aria-live="polite"></span>
    </div>
    ${relatedSection}
  </aside>
</article>

${postNav}`;

  return layout({
    title: post.title,
    description: post.summary_en || post.summary,
    path: `posts/${post.slug}/`,
    body,
    ogType: "article",
    bodyClass: "page-post",
    mainClass: "container post-wrap",
    progress: true,
  });
}

import config from "../../site.config.js";
import { url } from "../lib/urls.js";
import { escapeHtml } from "../lib/xml.js";
import { layout } from "./layout.js";
import { metaLine } from "./partials.js";

export function postPage({ post, prev, next }) {
  const tags = post.tags.length
    ? `<ul class="tags" aria-label="टैग">
${post.tags.map((t) => `      <li>${escapeHtml(t)}</li>`).join("\n")}
    </ul>`
    : "";

  const instaHref = post.instagram || config.instagramUrl;
  const instaText = post.instagram
    ? `ई बतकही Instagram पर भी देखीं: ${escapeHtml(config.instagramHandle)}`
    : `छोट-छोट बतकही Instagram पर भी: ${escapeHtml(config.instagramHandle)}`;

  const navItems = [];
  if (prev) {
    navItems.push(`<a class="post-nav-prev" href="${url(`posts/${prev.slug}/`)}" rel="prev"><span class="post-nav-label">पिछला बतकही</span><span class="post-nav-title">${escapeHtml(prev.title)}</span></a>`);
  }
  if (next) {
    navItems.push(`<a class="post-nav-next" href="${url(`posts/${next.slug}/`)}" rel="next"><span class="post-nav-label">अगला बतकही</span><span class="post-nav-title">${escapeHtml(next.title)}</span></a>`);
  }
  const postNav = navItems.length
    ? `<nav class="post-nav" aria-label="आगे-पीछे">
${navItems.join("\n")}
</nav>`
    : "";

  const body = `<article class="post">
  <header class="post-header">
    <h1>${escapeHtml(post.title)}</h1>
    <p class="title-en" lang="en">${escapeHtml(post.title_en)}</p>
    ${metaLine(post)}
  </header>

  <div class="prose">
${post.html}
  </div>

  <section class="in-english" lang="en" aria-labelledby="in-english-heading">
    <h2 id="in-english-heading">In English</h2>
${post.inEnglishHtml}
  </section>

  <footer class="post-footer">
    ${tags}
    <div class="share" hidden>
      <button type="button" class="copy-link">लिंक कॉपी करीं</button>
      <button type="button" class="web-share" hidden>शेयर करीं</button>
      <span class="share-status" role="status" aria-live="polite"></span>
    </div>
    <p class="insta"><a href="${instaHref}" rel="noopener">${instaText}</a></p>
  </footer>
</article>

${postNav}`;

  return layout({
    title: post.title,
    description: post.summary_en || post.summary,
    path: `posts/${post.slug}/`,
    body,
    ogType: "article",
    bodyClass: "page-post",
  });
}

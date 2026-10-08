import { readFileSync } from "node:fs";
import config from "../../site.config.js";
import { url } from "../lib/urls.js";
import { escapeHtml } from "../lib/xml.js";
import { formatBhojpuriDate } from "../lib/dates.js";

const markSvg = readFileSync(new URL("../../assets/brand/mark.svg", import.meta.url), "utf8")
  .replace(/<svg /, '<svg class="mark" aria-hidden="true" focusable="false" ')
  .replace(/\s+width="64"\s+height="64"/, "")
  .replace(/>\s+</g, "><")
  .trim();

export function masthead({ home = false } = {}) {
  const Tag = home ? "div" : "div";
  return `<${Tag} class="masthead-wrap">
  <a class="masthead" href="${url("")}">
    ${markSvg}
    <span class="wordmark">${escapeHtml(config.title)}</span>
    <span class="wordmark-dev">${escapeHtml(config.titleDevanagari)}</span>
  </a>
</${Tag}>`;
}

export function siteNav() {
  return `<nav class="site-nav" aria-label="मुख्य">
  <ul>
    <li><a href="${url("posts/")}">सब बतकही</a></li>
    <li><a href="${url("about/")}">हमरा बारे में</a></li>
    <li><a href="${config.instagramUrl}" rel="noopener">Instagram</a></li>
    <li><button class="theme-toggle" type="button" hidden aria-label="थीम बदलीं" data-dark-label="अन्हार थीम" data-light-label="अंजोर थीम">अन्हार थीम</button></li>
  </ul>
</nav>`;
}

export function footer() {
  return `<footer class="site-footer">
  <div class="container footer-inner">
    <p class="copy">© ${config.copyrightYear} ${escapeHtml(config.title)} · ${escapeHtml(config.author.name)}</p>
    <ul class="footer-links">
      <li><a href="${config.instagramUrl}" rel="noopener">Instagram ${escapeHtml(config.instagramHandle)}</a></li>
      <li><a href="${url("feed.xml")}">Feed</a></li>
      <li><a href="${config.bhojverseUrl}" rel="noopener">BhojVerse</a></li>
    </ul>
  </div>
</footer>`;
}

export function metaLine(post, { categoryLink = true } = {}) {
  const cat = categoryLink
    ? `<a href="${url(`category/${post.category.slug}/`)}">${escapeHtml(post.category.name)}</a>`
    : escapeHtml(post.category.name);
  return `<p class="meta"><time datetime="${post.date}">${formatBhojpuriDate(post.date)}</time> · ${cat} · पढ़े में ~${post.minutes} मिनट</p>`;
}

export function postListItem(post, { headingLevel = 2 } = {}) {
  const h = `h${headingLevel}`;
  return `<li class="post-item" data-category="${post.category.slug}">
  <article>
    <${h} class="post-item-title"><a href="${url(`posts/${post.slug}/`)}">${escapeHtml(post.title)}</a></${h}>
    <p class="title-en" lang="en">${escapeHtml(post.title_en)}</p>
    ${metaLine(post)}
    <p class="summary">${escapeHtml(post.summary)}</p>
  </article>
</li>`;
}

export function postList(posts, opts) {
  if (posts.length === 0) {
    return `<p class="empty">अभी एह विषय में कोई बतकही नइखे।</p>`;
  }
  return `<ul class="post-list">
${posts.map((p) => postListItem(p, opts)).join("\n")}
</ul>`;
}

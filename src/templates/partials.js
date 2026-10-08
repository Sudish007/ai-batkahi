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

export function masthead() {
  return `<a class="masthead" href="${url("")}">
      ${markSvg}
      <span class="wordmark">${escapeHtml(config.title)}</span>
      <span class="wordmark-dev">${escapeHtml(config.titleDevanagari)}</span>
    </a>`;
}

export function siteNav() {
  return `<nav class="site-nav" aria-label="मुख्य">
      <ul>
        <li><a class="nav-link" href="${url("posts/")}">सब बतकही</a></li>
        <li><a class="nav-link" href="${url("about/")}">हमरा बारे में</a></li>
        <li><a class="nav-link" href="${config.instagramUrl}" rel="noopener">Instagram</a></li>
      </ul>
    </nav>`;
}

// Header tools: search link (palette opener in FEAT-004) and the theme toggle.
// The toggle ships disabled; main.js enables it. No aria-label on the search
// link: its name is the visible "खोजीं" (visually hidden below 48em).
export function tools() {
  return `<div class="tools">
      <a class="icon-btn search-btn" href="${url("posts/")}">
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>
        <span class="search-label">खोजीं</span>
        <kbd class="kbd" aria-hidden="true">Ctrl K</kbd>
      </a>
      <button class="icon-btn theme-toggle" type="button" disabled aria-label="अन्हार थीम करीं" data-dark-label="अन्हार थीम करीं" data-light-label="अंजोर थीम करीं">
        <svg class="sunmoon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <mask id="moon-mask"><rect width="24" height="24" fill="#fff"/><circle class="mask-dot" cx="30" cy="2" r="7" fill="#000"/></mask>
          <circle class="disc" cx="12" cy="12" r="5.5" fill="currentColor" mask="url(#moon-mask)"/>
          <g class="rays" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/>
          </g>
        </svg>
      </button>
    </div>`;
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

export function postCard(post, { headingLevel = 2 } = {}) {
  const h = `h${headingLevel}`;
  return `<li class="post-item reveal" data-category="${post.category.slug}">
  <article>
    <${h} class="post-item-title"><a href="${url(`posts/${post.slug}/`)}">${escapeHtml(post.title)}</a></${h}>
    <p class="title-en" lang="en">${escapeHtml(post.title_en)}</p>
    ${metaLine(post)}
    <p class="summary">${escapeHtml(post.summary)}</p>
  </article>
</li>`;
}

// kind: "bento" (home) | "cards" (posts index, category pages)
export function postGrid(posts, { kind = "cards", headingLevel = 2 } = {}) {
  if (posts.length === 0) {
    return `<p class="empty">अभी एह विषय में कोई बतकही नइखे।</p>`;
  }
  return `<ul class="post-grid ${kind}">
${posts.map((p) => postCard(p, { headingLevel })).join("\n")}
</ul>`;
}

// Kept for posts-index/category until FEAT-003 switches them to postGrid.
export function postList(posts, opts = {}) {
  return postGrid(posts, { kind: "cards", ...opts });
}

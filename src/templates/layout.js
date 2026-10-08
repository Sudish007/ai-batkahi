import config from "../../site.config.js";
import { url, absUrl } from "../lib/urls.js";
import { escapeHtml } from "../lib/xml.js";
import { fontUrls } from "../lib/fonts.js";
import { masthead, siteNav, tools, footer } from "./partials.js";

// Runs before CSS paints so a stored dark choice never flashes. Light is the
// default for everyone: only a stored "dark" is honoured, the OS preference is
// never read. Also marks html.js and html.no-sda (no scroll-driven animations).
export const PREPAINT =
  'try{var t=localStorage.getItem("theme");if(t==="dark"){var d=document.documentElement;d.setAttribute("data-theme","dark");var m=document.querySelector(\'meta[name="color-scheme"]\');if(m)m.content="dark";var c=document.querySelector(\'meta[name="theme-color"]\');if(c)c.content="#15130F"}}catch(e){}document.documentElement.classList.add("js");if(!(window.CSS&&CSS.supports&&CSS.supports("animation-timeline: view()")))document.documentElement.classList.add("no-sda");';

export function layout({
  title,
  description,
  path, // site-relative path e.g. "posts/x/" (used for canonical/og:url)
  body,
  ogType = "website",
  bodyClass = "",
  noindex = false,
  mainClass = "container",
  progress = false,
}) {
  const fullTitle = title ? `${title} · ${config.title}` : `${config.title} · ${config.tagline}`;
  const desc = description || config.description;
  const canonical = absUrl(path);
  const preloads = fontUrls()
    .map((f) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="${url(f)}">`)
    .join("\n");
  return `<!doctype html>
<html lang="bho">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeHtml(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${canonical}">`}
<meta property="og:site_name" content="${escapeHtml(config.title)}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${escapeHtml(title || config.title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${absUrl("og-default.png")}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escapeHtml(config.title)} — ${escapeHtml(config.tagline)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#FAF6EF">
<link rel="alternate" type="application/atom+xml" title="${escapeHtml(config.title)}" href="${url("feed.xml")}">
<link rel="icon" href="${url("favicon.svg")}" type="image/svg+xml">
<link rel="icon" href="${url("favicon.ico")}" sizes="32x32">
<link rel="apple-touch-icon" href="${url("apple-touch-icon.png")}">
<script>${PREPAINT}</script>
${preloads}
<link rel="stylesheet" href="${url("styles.css")}">
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>
<a class="skip-link" href="#main">सीधे मुख्य सामग्री पर जाईं</a>
${progress ? '<div class="progress" aria-hidden="true"><div class="progress-bar"></div></div>\n' : ""}<header class="site-header">
  <div class="container header-inner">
    ${masthead()}
    ${siteNav()}
    ${tools()}
  </div>
</header>
<main id="main"${mainClass ? ` class="${mainClass}"` : ""} tabindex="-1">
${body}
</main>
${footer()}
<script src="${url("main.js")}" defer></script>
</body>
</html>
`;
}

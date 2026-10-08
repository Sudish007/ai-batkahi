import config from "../../site.config.js";
import { url, absUrl } from "../lib/urls.js";
import { escapeHtml } from "../lib/xml.js";
import { masthead, siteNav, footer } from "./partials.js";

// Runs before CSS paints so the stored theme never flashes.
const PREPAINT =
  'try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}';

export function layout({
  title,
  description,
  path, // site-relative path e.g. "posts/x/" (used for canonical/og:url)
  body,
  ogType = "website",
  bodyClass = "",
  noindex = false,
}) {
  const fullTitle = title ? `${title} · ${config.title}` : `${config.title} · ${config.tagline}`;
  const desc = description || config.description;
  const canonical = absUrl(path);
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
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#FAF6EF">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#15130F">
<link rel="alternate" type="application/atom+xml" title="${escapeHtml(config.title)}" href="${url("feed.xml")}">
<link rel="icon" href="${url("favicon.svg")}" type="image/svg+xml">
<link rel="icon" href="${url("favicon.ico")}" sizes="32x32">
<link rel="apple-touch-icon" href="${url("apple-touch-icon.png")}">
<script>${PREPAINT}</script>
<link rel="stylesheet" href="${url("styles.css")}">
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>
<a class="skip-link" href="#main">सीधे मुख्य सामग्री पर जाईं</a>
<header class="site-header">
  <div class="container header-inner">
    ${masthead()}
    ${siteNav()}
  </div>
</header>
<main id="main" class="container" tabindex="-1">
${body}
</main>
${footer()}
<script src="${url("main.js")}" defer></script>
</body>
</html>
`;
}

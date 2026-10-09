// Builds the srcdoc of the live preview: the post template's skeleton with
// the SAME Marked options and renderer as the generator (both passed in from
// the copied markdown-core.js). DOM-free so node:test can compare heading ids.
export function renderPreviewHtml({
  data,
  body,
  Marked,
  MARKED_OPTIONS,
  createRenderer,
  splitInEnglish,
  resolveUrl = (h) => h,
  imageSizes = {},
  stylesheetHref,
  theme = "light",
  categoryName = "",
  minutes = 1,
  dateLabel = "",
  escapeHtml,
}) {
  const render = (md) => new Marked(MARKED_OPTIONS).use({ renderer: createRenderer({ resolveUrl, imageSizes }) }).parse(md);
  const { body: main, inEnglish } = splitInEnglish(String(body ?? "").replace(/\r\n/g, "\n"));
  const bodyHtml = render(main);
  const inEnglishHtml = inEnglish ? render(inEnglish) : "";
  const title = String(data.title ?? "").trim();
  const titleEn = String(data.title_en ?? "").trim();
  const meta = [categoryName, dateLabel, `पढ़े में ~${minutes} मिनट`].filter(Boolean).join(" · ");
  return (
    `<!doctype html><html lang="bho"${theme === "dark" ? ' data-theme="dark"' : ""}><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<link rel="stylesheet" href="${escapeHtml(stylesheetHref)}"></head>` +
    `<body class="page-post"><main class="container post-wrap"><article class="post"><header class="post-header">` +
    `<p class="eyebrow">${escapeHtml(meta)}</p><h1>${escapeHtml(title || "शीर्षक")}</h1>` +
    `<p class="title-en" lang="en">${escapeHtml(titleEn)}</p></header>` +
    `<div class="post-body"><div class="prose">${bodyHtml}</div>` +
    (inEnglish
      ? `<section class="in-english" lang="en"><p class="eyebrow"><span lang="en">Summary</span></p><h2 id="in-english-heading">In English</h2>${inEnglishHtml}</section>`
      : "") +
    `</div></article></main></body></html>`
  );
}

// Post validation (design 7.7). Returns [{ field, message }] in field order so
// the editor can list them and link each to its control. Imports nothing;
// `countWords` is passed in (the copied reading-time.js).
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INSTAGRAM = /^https:\/\/www\.instagram\.com\//;
const IN_ENGLISH = /^##\s+In English\s*$/im;

function realDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function h2Headings(text) {
  return [...String(text).matchAll(/^##\s+(.*)$/gm)].map((m) => m[1].trim());
}

export function validatePost({ data, body, existingSlugs = [], currentSlug = null, draft = false, countWords, categories = null }) {
  const errors = [];
  const push = (field, message) => errors.push({ field, message });
  const str = (k) => String(data[k] ?? "").trim();

  const title = str("title");
  if (title === "") push("title", "शीर्षक जरूरी बा");
  else if (title.length > 120) push("title", "120 अक्षर से कम राखीं");

  const slug = str("slug");
  if (slug === "" || !SLUG.test(slug) || slug.length < 3 || slug.length > 60) push("slug", "slug में सिर्फ a-z, 0-9 आ -");
  else if (existingSlugs.includes(slug) && slug !== currentSlug) push("slug", "ई slug पहिले से बा");

  if (draft === true) return errors;

  const titleEn = str("title_en");
  if (titleEn === "") push("title_en", "Title is required");
  else if (titleEn.length > 120) push("title_en", "Keep it under 120 characters");

  const date = str("date");
  if (!DATE.test(date) || !realDate(date)) push("date", "तारीख YYYY-MM-DD में");

  const allowed = categories || (data.categories ?? null);
  if (!str("category") || (Array.isArray(allowed) && !allowed.includes(str("category")))) push("category", "विषय चुनीं");

  const tags = Array.isArray(data.tags) ? data.tags.map((t) => String(t).trim()) : [];
  if (tags.length < 1 || tags.length > 8) push("tags", "1 से 8 टैग");
  else if (tags.some((t) => t.length < 1 || t.length > 30 || /[,[\]]/.test(t))) push("tags", "टैग में , या [ ] ना चलेला");

  for (const key of ["summary", "summary_en"]) {
    const v = str(key).replace(/\r?\n/g, " ");
    if (v === "") push(key, "सार जरूरी बा");
    else if (v.length > 300) push(key, "सार 300 अक्षर से कम");
  }

  const insta = str("instagram");
  if (insta !== "" && !INSTAGRAM.test(insta)) push("instagram", "Instagram लिंक https://www.instagram.com/ से शुरू होखे");

  const text = String(body ?? "").replace(/\r\n/g, "\n");
  if (/^#\s/m.test(text)) push("body", "# (h1) मत लिखीं — h2 से शुरू करीं");
  const firstH2 = text.search(/^##\s/m);
  const firstH3 = text.search(/^###\s/m);
  if (firstH3 !== -1 && (firstH2 === -1 || firstH3 < firstH2)) push("body", "### से पहिले ## चाहीं");
  const m = IN_ENGLISH.exec(text);
  const all = h2Headings(text);
  const inEnglishCount = all.filter((h) => /^In English$/i.test(h)).length;
  if (!m || inEnglishCount !== 1 || !/^In English$/i.test(all[all.length - 1])) {
    push("body", "In English खंड जरूरी बा (अंत में)");
  } else {
    const before = text.slice(0, m.index);
    const after = text.slice(m.index + m[0].length);
    if (countWords(before) < 50) push("body", "कम से कम 50 शब्द");
    if (countWords(after) < 20) push("body", "In English में कम से कम 20 शब्द");
  }
  return errors;
}

// Non-blocking notes shown under the body (the build makes a ToC only for >= 2 sections).
export function hints({ body }) {
  const text = String(body ?? "");
  const m = IN_ENGLISH.exec(text);
  const before = m ? text.slice(0, m.index) : text;
  return h2Headings(before).length < 2 ? ["2 से कम ## खंड: ToC ना बनी"] : [];
}

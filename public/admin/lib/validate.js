// Post validation (design 7.7). Returns [{ field, message }] in field order so
// the editor can list them and link each to its control. Imports nothing;
// `countWords` (the copied reading-time.js) and `lexer` (Marked's, with the
// preview's options) are passed in.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INSTAGRAM = /^https:\/\/www\.instagram\.com\//;
const IN_ENGLISH = /^##\s+In English\s*$/im;
const ATX = /^ {0,3}#/;

// Every heading token in document order, walking list items and block quotes
// too. Every structure rule below is decided from these tokens, never from raw
// lines, so `#`, `###`, `## x` or `---` inside a fence or indented code — which
// the build renders as code — never trigger a rule.
function allHeadings(tokens, out = []) {
  for (const t of tokens) {
    if (t.type === "heading") {
      out.push(t);
      continue;
    }
    if (t.items) allHeadings(t.items, out);
    if (t.tokens) allHeadings(t.tokens, out);
  }
  return out;
}

const isAtx = (h) => ATX.test(h.raw);
const isInEnglish = (h) => /^In English$/i.test(String(h.text).trim());

// Source offset of a top-level token: the lexer consumes the source token by
// token, so the raws of the preceding top-level tokens add up to its start.
function topLevelOffset(tokens, target) {
  let offset = 0;
  for (const t of tokens) {
    if (t === target) return offset;
    offset += t.raw.length;
  }
  return -1;
}

function realDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function validatePost({ data, body, existingSlugs = [], currentSlug = null, draft = false, countWords, lexer, categories = null }) {
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
  // Headings as the same lexer the preview renders with sees them (same
  // options as the build): what it does not call a heading, the build will not
  // render as one, and vice versa.
  const tokens = lexer(text);
  const heads = allHeadings(tokens);
  if (heads.some((h) => h.depth === 1 && isAtx(h))) push("body", "# (h1) मत लिखीं — h2 से शुरू करीं");
  // A setext underline (=== / ---) under a paragraph renders an h1/h2 the
  // build's one-h1 and ToC tests would then fail on.
  if (heads.some((h) => !isAtx(h))) push("body", "शीर्षक खातिर ## लिखीं (=== / --- ना)");
  const firstH2 = heads.findIndex((h) => h.depth === 2);
  const firstH3 = heads.findIndex((h) => h.depth === 3);
  if (firstH3 !== -1 && (firstH2 === -1 || firstH3 < firstH2)) push("body", "### से पहिले ## चाहीं");
  // Exactly one rendered `## In English`, last of the h2s, and the build's
  // splitInEnglish (a line regex, so it also matches inside a fence) must cut
  // the body at that very heading: its first match has to sit where the
  // top-level heading token starts.
  const h2s = heads.filter((h) => h.depth === 2 && isAtx(h)); // setext ones are reported above
  const inEnglish = h2s.filter(isInEnglish);
  const m = IN_ENGLISH.exec(text);
  const splitAt = inEnglish.length === 1 ? topLevelOffset(tokens, inEnglish[0]) : -1;
  if (!m || inEnglish.length !== 1 || !isInEnglish(h2s[h2s.length - 1]) || m.index !== splitAt) {
    push("body", "In English खंड जरूरी बा (अंत में)");
  } else {
    const before = text.slice(0, m.index);
    const after = text.slice(m.index + m[0].length);
    if (countWords(before) < 50) push("body", "कम से कम 50 शब्द");
    if (countWords(after) < 20) push("body", "In English में कम से कम 20 शब्द");
  }
  return errors;
}

// Non-blocking notes shown under the body (the build makes a ToC only for >= 2
// sections). Counts the h2 tokens of the part the build keeps as the body, i.e.
// before splitInEnglish's cut, with the same lexer as validatePost.
export function hints({ body, lexer }) {
  const text = String(body ?? "").replace(/\r\n/g, "\n");
  const m = IN_ENGLISH.exec(text);
  const before = m ? text.slice(0, m.index) : text;
  const sections = allHeadings(lexer(before)).filter((h) => h.depth === 2).length;
  return sections < 2 ? ["2 से कम ## खंड: ToC ना बनी"] : [];
}

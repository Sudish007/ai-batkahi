// Post validation (design 7.7). Returns [{ field, message }] in field order so
// the editor can list them and link each to its control. Imports nothing;
// `countWords` (the copied reading-time.js) and `lexer` (Marked's, with the
// preview's options) are passed in.
//
// Parity with CI: pages.yml runs `npm test` on every push to main, so a body the
// dist tests reject (tests/dist-lang.test.js, tests/dist-links.test.js,
// tests/dist-pages.test.js) would be committed and then fail the deploy. Every
// body rule below mirrors one of those tests and is decided from the lexer's
// tokens, never from raw lines; tests/validate-parity.test.js keeps one failing
// fixture per rule and checks every content/posts/*.md passes.
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isValidSlug = (slug) => SLUG.test(slug) && slug.length >= 3 && slug.length <= 60;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INSTAGRAM = /^https:\/\/www\.instagram\.com\//;
const IN_ENGLISH = /^##\s+In English\s*$/im;
const ATX = /^ {0,3}#/;
// tests/dist-links.test.js skips exactly these href/src values; every other one
// must be root-relative (the renderer prefixes basePath) and resolve in dist/.
const EXTERNAL = /^(https?:|mailto:|data:|#)/;
// tests/dist-pages.test.js "no page contains placeholder or fake-social text":
// title and summaries reach <title>, the meta description and the prev/next nav.
const BANNED = [/lorem/i, /coming soon/i, /follower/i, /trusted by/i, /testimonial/i];
// Raw HTML passes through the renderer untouched, so these tags would be judged
// by the page tests (one h1, heading order, img alt, rel=noopener, one inline script).
const RAW_HTML = /<(a|img|h[1-6]|svg|script)\b/i;
// Pages the build always emits (besides posts, categories and images).
export const SITE_PAGES = ["/", "/posts/", "/about/", "/feed.xml"];

// Every token in document order, descending into inline tokens, list items,
// block quotes and table cells. Every structure rule below is decided from these
// tokens, never from raw lines, so `#`, `###`, `## x`, `---` or `<a href>`
// inside a fence or indented code — which the build renders as code — never
// trigger a rule.
function walk(tokens, visit) {
  for (const t of tokens) {
    visit(t);
    if (t.tokens) walk(t.tokens, visit);
    if (t.items) walk(t.items, visit);
    if (t.header) for (const cell of t.header) walk(cell.tokens, visit);
    if (t.rows) for (const row of t.rows) for (const cell of row) walk(cell.tokens, visit);
  }
}

function collect(tokens) {
  const heads = [];
  const links = [];
  const html = [];
  walk(tokens, (t) => {
    if (t.type === "heading") heads.push(t);
    else if (t.type === "link" || t.type === "image") links.push(t);
    else if (t.type === "html") html.push(t);
  });
  return { heads, links, html };
}

// [{ href, image }] for every link and image token of a lexed body (the admin
// uses it to find which /images/<dir>/ listings a publish has to fetch).
export const collectLinks = (tokens) => collect(tokens).links.map((t) => ({ href: String(t.href ?? ""), image: t.type === "image" }));

const isAtx = (h) => ATX.test(h.raw);
const isInEnglish = (h) => /^In English$/i.test(String(h.text).trim());
const hashes = (n) => "#".repeat(n);

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

// What tests/dist-links.test.js does to a rendered href/src before looking it up
// in dist/: drop the fragment and the query; a directory counts when it holds
// index.html, so a trailing "/" or "/index.html" is optional.
function canonPath(href) {
  let p = href.split("#")[0].split("?")[0];
  if (p.endsWith("/index.html")) p = p.slice(0, -"index.html".length);
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

function realDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// knownPaths: every root-relative path that exists on the site once this post is
// published ("/posts/<slug>/" of every non-draft post incl. this one,
// "/category/<slug>/" of every category with a post, SITE_PAGES, "/images/…" of
// every committed image). Internal links and images must be among them.
export function validatePost({ data, body, existingSlugs = [], currentSlug = null, draft = false, countWords, lexer, categories = null, knownPaths = [] }) {
  const errors = [];
  const push = (field, message) => errors.push({ field, message });
  const str = (k) => String(data[k] ?? "").trim();
  const banned = (key) => {
    const re = BANNED.find((b) => b.test(str(key)));
    if (re) push(key, `"${str(key).match(re)[0]}" शब्द साइट पर रोकल बा — दूसरा शब्द लिखीं`);
  };

  const title = str("title");
  if (title === "") push("title", "शीर्षक जरूरी बा");
  else if (title.length > 120) push("title", "120 अक्षर से कम राखीं");

  const slug = str("slug");
  if (!isValidSlug(slug)) push("slug", "slug में सिर्फ a-z, 0-9 आ -");
  else if (existingSlugs.includes(slug) && slug !== currentSlug) push("slug", "ई slug पहिले से बा");

  if (draft === true) return errors;
  banned("title");

  const titleEn = str("title_en");
  if (titleEn === "") push("title_en", "Title is required");
  else if (titleEn.length > 120) push("title_en", "Keep it under 120 characters");
  else banned("title_en");

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
    else banned(key);
  }

  const insta = str("instagram");
  if (insta !== "" && !INSTAGRAM.test(insta)) push("instagram", "Instagram लिंक https://www.instagram.com/ से शुरू होखे");

  const text = String(body ?? "").replace(/\r\n/g, "\n");
  // Headings as the same lexer the preview renders with sees them (same
  // options as the build): what it does not call a heading, the build will not
  // render as one, and vice versa.
  const tokens = lexer(text);
  const { heads, links, html } = collect(tokens);
  if (heads.some((h) => h.depth === 1 && isAtx(h))) push("body", "# (h1) मत लिखीं — h2 से शुरू करीं");
  // A setext underline (=== / ---) under a paragraph renders an h1/h2 the
  // build's one-h1 and ToC tests would then fail on.
  if (heads.some((h) => !isAtx(h))) push("body", "शीर्षक खातिर ## लिखीं (=== / --- ना)");
  // tests/dist-lang.test.js "heading levels never skip": the page's h1 is the
  // title, so the first heading must be an h2 and each later one at most one
  // level deeper than the one before (the template's In English h2 included).
  let prev = 1;
  for (const h of heads) {
    if (h.depth > prev + 1) {
      push("body", prev === 1 ? `${hashes(h.depth)} से पहिले ## चाहीं` : `${hashes(prev)} के बाद ${hashes(h.depth)} नइखे चलेला — ${hashes(prev + 1)} लगाईं`);
      break;
    }
    prev = h.depth;
  }
  // Exactly one rendered `## In English`, last of the h2s, and the build's
  // splitInEnglish (a line regex, so it also matches inside a fence) must cut
  // the body at that very heading: its first match has to sit where the
  // top-level heading token starts.
  const h2s = heads.filter((h) => h.depth === 2 && isAtx(h)); // setext ones are reported above
  const inEnglish = h2s.filter(isInEnglish);
  const m = IN_ENGLISH.exec(text);
  if (!m || inEnglish.length !== 1 || !isInEnglish(h2s[h2s.length - 1])) {
    push("body", "In English खंड जरूरी बा (अंत में)");
  } else if (m.index !== topLevelOffset(tokens, inEnglish[0])) {
    push("body", "`## In English` लाइन कोड ब्लॉक में भी मत लिखीं — build ओहिजे काटेला");
  } else {
    const before = text.slice(0, m.index);
    const after = text.slice(m.index + m[0].length);
    if (countWords(before) < 50) push("body", "कम से कम 50 शब्द");
    if (countWords(after) < 20) push("body", "In English में कम से कम 20 शब्द");
  }
  // tests/dist-links.test.js: every href/src that is not external must be
  // root-relative and resolve to a page or file of the built site.
  const known = new Set([...knownPaths].map(canonPath));
  const seen = new Set();
  for (const t of links) {
    const href = String(t.href ?? "");
    const image = t.type === "image";
    if (EXTERNAL.test(href) || seen.has(href)) continue;
    seen.add(href);
    const path = canonPath(href);
    if (path === "") continue; // "?x" or "": the test reads it as a same-page link
    if (!path.startsWith("/")) {
      push("body", image ? `छवि के रास्ता /images/ से शुरू होखे — छवि बटन से अपलोड करीं या पूरा https:// URL दीं: ${href}` : `लिंक / से शुरू करीं (जइसे /posts/<slug>/) या पूरा https:// URL दीं: ${href}`);
    } else if (!known.has(path)) {
      push("body", image ? `ई छवि साइट पर नइखे मिलत: ${href} — छवि बटन से अपलोड करीं` : `ई लिंक साइट पर नइखे मिलत: ${href} — मौजूद बतकही के /posts/<slug>/, विषय के /category/<slug>/ या पूरा https:// URL दीं`);
    }
  }
  const tag = html.map((t) => RAW_HTML.exec(t.raw)).find(Boolean);
  if (tag) push("body", `HTML टैग <${tag[1]}> मत लिखीं — ओकर Markdown रूप बरतीं`);
  return errors;
}

// Non-blocking notes shown under the body (the build makes a ToC only for >= 2
// sections). Counts the h2 tokens of the part the build keeps as the body, i.e.
// before splitInEnglish's cut, with the same lexer as validatePost.
export function hints({ body, lexer }) {
  const text = String(body ?? "").replace(/\r\n/g, "\n");
  const m = IN_ENGLISH.exec(text);
  const before = m ? text.slice(0, m.index) : text;
  const sections = collect(lexer(before)).heads.filter((h) => h.depth === 2).length;
  return sections < 2 ? ["2 से कम ## खंड: ToC ना बनी"] : [];
}

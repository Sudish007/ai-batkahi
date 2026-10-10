// AI Batkahi admin UI. Runs only in the owner's browser; talks to
// api.github.com directly with a fine-grained token. Markup is static (see
// src/templates/admin.js); this module toggles `hidden`/classes and builds
// nodes with createElement/textContent — no HTML strings are ever parsed into
// the page (the preview string goes to iframe.srcdoc only) and no inline styles.
import { Marked } from "./vendor/marked.esm.js";
import { MARKED_OPTIONS, createRenderer, splitInEnglish } from "./lib/markdown-core.js";
import { slugify } from "./lib/slugify.js";
import { countWords, readingMinutes } from "./lib/reading-time.js";
import { parse, serialize } from "./lib/frontmatter.js";
import { escapeHtml } from "./lib/xml.js";
import { createClient, GitHubError, scrub } from "./lib/github.js";
import { createStore } from "./lib/store.js";
import { postSlugFromName, nextPostPath, imageFileName, imagePath, imageMarkdownPath, todayIST } from "./lib/paths.js";
import { classifyRun, describeLatest } from "./lib/run-status.js";
import { validatePost, hints } from "./lib/validate.js";
import { renderPreviewHtml } from "./lib/preview.js";
import { processImage } from "./lib/image.js";

const cfg = JSON.parse(document.getElementById("admin-config").textContent);
const store = createStore();
const $ = (id) => document.getElementById(id);
const MONTHS = ["जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];
const POLL_MS = 10000;
const MAX_POLLS = 60;
const POSTS_DIR = "content/posts";

const state = {
  token: null,
  client: null,
  files: [],
  posts: new Map(),
  editing: null,
  dirty: false,
  blobs: new Map(),
  autosaveTimer: 0,
  previewTimer: 0,
  slugTouched: false,
  tags: [],
};

/* ---------- helpers ---------- */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "text") node.textContent = v;
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}
const clear = (node) => node.replaceChildren();
const show = (node, on = true) => node.toggleAttribute("hidden", !on);
const hhmm = (d = new Date(), secs = false) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}${secs ? `:${String(d.getSeconds()).padStart(2, "0")}` : ""}`;
function bhojpuriDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "";
}
const categoryName = (slug) => (cfg.categories.find((c) => c.slug === slug) || {}).name || slug;
const userMessage = (err) => (err instanceof GitHubError ? err.userMessage() : scrub(String(err && err.message ? err.message : err), state.token));
const basename = (p) => p.slice(p.lastIndexOf("/") + 1);

function log(text) {
  const li = el("li", {}, [el("time", { text: hhmm(new Date(), true) }), document.createTextNode(scrub(text, state.token))]);
  $("activity-list").prepend(li);
}
function fail(err, context) {
  const msg = userMessage(err);
  log(`${context}: ${msg}`);
  if (!(err instanceof GitHubError)) console.error(scrub(String(err && err.stack ? err.stack : err), state.token));
  return msg;
}
function setError(node, message) {
  node.textContent = message || "";
  show(node, Boolean(message));
}

/* ---------- views ---------- */
const VIEWS = ["lock", "dashboard", "editor"];
const HELP = [".help", ".security", ".limits"];
function showView(name) {
  for (const v of VIEWS) show($(v), v === name);
  for (const sel of HELP) show(document.querySelector(sel), name === "lock");
  show($("activity"), name !== "lock");
}

function lock(message) {
  state.token = null;
  state.client = null;
  state.posts.clear();
  showView("lock");
  setError($("signin-error"), message);
  if (message) $("token").focus();
}

/* ---------- sign-in / out ---------- */
async function validateToken(token) {
  const client = createClient({ token, owner: cfg.owner, repo: cfg.repo, branch: cfg.branch });
  const r = await client.repo();
  if (!r || !r.permissions || r.permissions.push !== true) throw new GitHubError(403, "no push", { kind: "push" });
  return client;
}

async function signIn(event) {
  event.preventDefault();
  const input = $("token");
  const btn = $("signin-btn");
  const errNode = $("signin-error");
  const token = input.value.trim();
  setError(errNode, "");
  if (!token) return setError(errNode, "token भरीं");
  btn.disabled = true;
  btn.textContent = "जाँचत बानी…";
  try {
    const client = await validateToken(token);
    const { persisted } = store.set(token, $("remember").checked);
    state.token = token;
    state.client = client;
    input.value = "";
    log("साइन इन भइल");
    if (!persisted) log("storage नइखे — सिर्फ एह पन्ना तक");
    // Changing the hash fires hashchange -> route(); only call it directly when it will not.
    if (location.hash === "#/") route();
    else location.hash = "#/";
  } catch (err) {
    if (err instanceof GitHubError && err.kind === "push") setError(errNode, "एह repo पर लिखे के अधिकार नइखे");
    else setError(errNode, userMessage(err));
  } finally {
    btn.disabled = false;
    btn.textContent = "साइन इन";
  }
}

function signOut() {
  store.clear();
  clearInterval(state.pollTimer);
  state.files = [];
  state.editing = null;
  state.dirty = false;
  log("साइन आउट");
  location.hash = "";
  lock("");
}

/* ---------- dashboard ---------- */
async function pool(items, limit, fn) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift());
  });
  await Promise.all(workers);
}

async function fetchPost(name) {
  const cached = state.posts.get(name);
  if (cached && !cached.error) return cached;
  try {
    const { text, sha } = await state.client.getFile(`${POSTS_DIR}/${name}`);
    const { data, body } = parse(text);
    const entry = { data, body, sha, slug: postSlugFromName(name) };
    state.posts.set(name, entry);
    return entry;
  } catch (err) {
    const entry = { error: err, slug: postSlugFromName(name) };
    state.posts.set(name, entry);
    return entry;
  }
}

function postRow(name, entry) {
  const main = el("div", { class: "row-main" });
  const actions = el("div", { class: "actions" });
  if (!entry) entry = { error: new Error("फाइल ना मिलल"), slug: postSlugFromName(name) };
  if (entry.error) {
    main.append(el("strong", { text: name }), el("p", { class: "meta", text: `पढ़ ना पाइल — ${userMessage(entry.error)}` }));
  } else {
    const { data } = entry;
    const isDraft = data.draft === "true" || data.draft === true;
    main.append(
      el("strong", { text: data.title || name }),
      document.createTextNode(" "),
      el("span", { lang: "en", text: data.title_en || "" }),
      el("p", { class: "meta" }, [
        document.createTextNode(`${data.date || ""} · ${categoryName(data.category)} · `),
        el("span", { class: "state", text: isDraft ? "ड्राफ्ट" : "प्रकाशित" }),
      ]),
    );
    actions.append(el("a", { class: "btn", href: `#/edit/${encodeURIComponent(name)}`, text: "संपादन" }));
    if (!isDraft) actions.append(el("a", { class: "btn", href: `${cfg.siteUrl}/posts/${entry.slug}/`, rel: "noopener", text: "देखीं" }));
  }
  const del = el("button", { type: "button", class: "danger", text: "हटाईं" });
  del.addEventListener("click", () => confirmDelete(name, entry));
  actions.append(del);
  return el("li", {}, [main, actions]);
}

// Directory listing of content/posts (numbering, duplicate-slug check). The
// editor can be opened directly via #/new, so it must not rely on the dashboard.
async function loadFiles() {
  const dir = await state.client.listDir(POSTS_DIR);
  state.files = dir.map((f) => f.name).filter((n) => n.endsWith(".md")).sort();
  return state.files;
}

async function loadDashboard() {
  const list = $("post-list");
  setError($("dash-error"), "");
  show($("dash-retry"), false);
  show($("dash-empty"), false);
  list.setAttribute("aria-busy", "true");
  list.classList.add("skeleton");
  clear(list);
  for (let i = 0; i < 3; i++) list.append(el("li"));
  try {
    await loadFiles();
    // Render from what THIS load fetched, not from the cache: another task may
    // evict or replace cache entries while the pool is still running.
    const entries = new Map();
    await pool(state.files, 6, async (n) => entries.set(n, await fetchPost(n)));
    list.classList.remove("skeleton");
    clear(list);
    let drafts = 0;
    for (const name of [...state.files].reverse()) {
      const entry = entries.get(name);
      if (entry && !entry.error && (entry.data.draft === "true" || entry.data.draft === true)) drafts++;
      list.append(postRow(name, entry));
    }
    $("dash-count").textContent = `${state.files.length} बतकही · ${drafts} ड्राफ्ट`;
    show($("dash-empty"), state.files.length === 0);
    loadDeployStatus();
  } catch (err) {
    list.classList.remove("skeleton");
    clear(list);
    if (err instanceof GitHubError && err.status === 401) {
      store.clear();
      return lock(fail(err, "सूची"));
    }
    setError($("dash-error"), fail(err, "सूची"));
    show($("dash-retry"), true);
  } finally {
    list.setAttribute("aria-busy", "false");
  }
}

async function loadDeployStatus() {
  const node = $("deploy-status");
  clear(node);
  try {
    const info = describeLatest(await state.client.latestPagesRun());
    if (!info) return;
    node.append(document.createTextNode(info.text + " "));
    if (info.url) node.append(el("a", { href: info.url, rel: "noopener", lang: "en", text: "run" }), document.createTextNode(" (Actions चलाव)"));
  } catch (err) {
    fail(err, "deploy status");
  }
}

function confirmDelete(name, entry) {
  const dlg = $("confirm-delete");
  const slug = entry.slug;
  const title = entry.error ? name : entry.data.title;
  $("del-text").textContent = `${title} (${slug}) हटाईं? ई commit (बदलाव दर्ज) बनी आ (प्रकाशित पोस्ट खातिर) साइट फेर बनी।`;
  const input = $("confirm-slug");
  const go = $("del-go");
  input.value = "";
  go.disabled = true;
  input.oninput = () => (go.disabled = input.value.trim() !== slug);
  // #del-go is the form's only submit button, so Enter in the slug field submits
  // exactly when the typed slug matches (a disabled default button blocks implicit
  // submission). The dialog stays open until the DELETE has succeeded.
  dlg.querySelector("form").onsubmit = async (ev) => {
    ev.preventDefault();
    if (go.disabled) return;
    go.disabled = true;
    try {
      let sha = entry.sha;
      if (!sha) sha = (await state.client.getFile(`${POSTS_DIR}/${name}`)).sha;
      const titleEn = entry.error ? slug : entry.data.title_en || slug;
      await state.client.deleteFile(`${POSTS_DIR}/${name}`, { sha, message: `post: delete ${titleEn}` });
      log(`हटावल: ${name}`);
      state.posts.delete(name);
      dlg.close("ok");
      loadDashboard();
    } catch (err) {
      $("del-text").textContent = fail(err, "हटावल");
      go.disabled = input.value.trim() !== slug;
    }
  };
  $("del-cancel").onclick = () => dlg.close("cancel");
  dlg.showModal();
}

/* ---------- editor: form state ---------- */
const FIELDS = ["title", "title-en", "slug", "date", "summary", "summary-en", "instagram"];
const FIELD_KEY = { "title-en": "title_en", "summary-en": "summary_en" };

function formData() {
  const data = {};
  for (const f of FIELDS) data[FIELD_KEY[f] || f] = $(`f-${f}`).value;
  data.category = $("f-category").value;
  data.tags = [...state.tags];
  data.draft = $("f-draft").checked;
  return data;
}

function fillForm(data, body) {
  for (const f of FIELDS) $(`f-${f}`).value = data[FIELD_KEY[f] || f] || "";
  $("f-category").value = data.category || cfg.categories[0].slug;
  if (!$("f-category").value) $("f-category").selectedIndex = 0;
  state.tags = Array.isArray(data.tags) ? [...data.tags] : [];
  renderTags();
  $("f-draft").checked = data.draft === "true" || data.draft === true;
  $("f-body").value = body || "";
  updateCounts();
  schedulePreview();
}

function renderTags() {
  const list = $("tag-list");
  clear(list);
  state.tags.forEach((tag, i) => {
    const btn = el("button", { type: "button", "aria-label": `हटाईं ${tag}`, text: "×" });
    btn.addEventListener("click", () => {
      state.tags.splice(i, 1);
      renderTags();
      markDirty();
    });
    list.append(el("li", {}, [el("span", { text: tag }), btn]));
  });
}

function addTag(raw) {
  const tag = raw.trim();
  if (!tag || state.tags.includes(tag) || state.tags.length >= 8) return;
  state.tags.push(tag);
  renderTags();
  markDirty();
}

function updateCounts() {
  $("summary-count").textContent = `${$("f-summary").value.length} / 300`;
  $("summary-en-count").textContent = `${$("f-summary-en").value.length} / 300`;
  const words = countWords($("f-body").value);
  $("word-count").textContent = `${words} शब्द`;
  $("read-time").textContent = `~${readingMinutes(words, cfg.wordsPerMinute)} मिनट`;
  show($("toc-hint"), hints({ body: $("f-body").value }).length > 0);
}

/* ---------- editor: preview ---------- */
function previewResolve(h) {
  if (state.blobs.has(h)) return state.blobs.get(h);
  if (h.startsWith("/images/")) return `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/content${h}`;
  if (h.startsWith("/")) return cfg.basePath + h.slice(1);
  return h;
}

function renderPreview() {
  const iframe = $("preview");
  const data = formData();
  const words = countWords($("f-body").value);
  let scrollY = 0;
  try {
    scrollY = iframe.contentWindow ? iframe.contentWindow.scrollY : 0;
  } catch {
    scrollY = 0;
  }
  iframe.addEventListener(
    "load",
    () => {
      try {
        iframe.contentWindow.scrollTo(0, scrollY);
      } catch {
        /* cross-origin sandbox: ignore */
      }
    },
    { once: true },
  );
  iframe.srcdoc = renderPreviewHtml({
    data,
    body: $("f-body").value,
    Marked,
    MARKED_OPTIONS,
    createRenderer,
    splitInEnglish,
    resolveUrl: previewResolve,
    stylesheetHref: cfg.stylesheet,
    theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
    categoryName: categoryName(data.category),
    minutes: readingMinutes(words, cfg.wordsPerMinute),
    dateLabel: bhojpuriDate(data.date),
    escapeHtml,
  });
}

function schedulePreview() {
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(renderPreview, 300);
}

/* ---------- editor: autosave ---------- */
const draftKey = () => `batkahi.admin.draft.${(state.editing && state.editing.file) || "new"}`;

function markDirty() {
  state.dirty = true;
  $("save-state").textContent = "असहेजल";
  clearTimeout(state.autosaveTimer);
  state.autosaveTimer = setTimeout(saveLocal, 3000);
}

function saveLocal() {
  clearTimeout(state.autosaveTimer);
  if (!$("editor").hidden === false) return;
  try {
    localStorage.setItem(
      draftKey(),
      JSON.stringify({ data: formData(), body: $("f-body").value, sha: state.editing && state.editing.sha, savedAt: Date.now() }),
    );
    $("save-state").textContent = `सहेजल · ${hhmm()}`;
  } catch {
    $("save-state").textContent = "autosave बंद — storage भर गइल";
  }
}

function readLocal() {
  try {
    const raw = localStorage.getItem(draftKey());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// A local copy is worth offering when it differs from what the form holds right
// after loading (for an existing post: the file just fetched). The listing's
// fetch time says nothing about that, so it is not consulted.
function localDiffers(local) {
  return local.body !== $("f-body").value || JSON.stringify(local.data) !== JSON.stringify(formData());
}

/* ---------- editor: open / reset ---------- */
function resetErrors() {
  clear($("errors"));
  for (const f of [...FIELDS, "category", "tags"]) setError($(`f-${f}-error`), "");
}

async function openEditor(file) {
  resetErrors();
  show($("restore"), false);
  state.slugTouched = false;
  state.dirty = false;
  const slugInput = $("f-slug");
  const slugHint = $("f-slug-hint");
  if (!state.files.length) {
    try {
      await loadFiles();
    } catch (err) {
      if (err instanceof GitHubError && err.status === 401) {
        store.clear();
        return lock(fail(err, "सूची"));
      }
      fail(err, "सूची");
    }
  }
  if (!file) {
    state.editing = null;
    $("editor-heading").textContent = "नया बतकही";
    slugInput.readOnly = false;
    slugHint.textContent = "सिर्फ a-z, 0-9 आ -; title_en से अपने बन जाला";
    fillForm({ date: todayIST(), category: cfg.categories[0].slug }, "");
  } else {
    const entry = await fetchPost(file);
    if (entry.error) {
      location.hash = "#/";
      setError($("dash-error"), fail(entry.error, file));
      return;
    }
    state.editing = { file, sha: entry.sha, slug: entry.slug, locked: true };
    $("editor-heading").textContent = `संपादन: ${entry.data.title || entry.slug}`;
    slugInput.readOnly = true;
    slugHint.textContent = "प्रकाशित पोस्ट के slug ना बदले";
    fillForm({ ...entry.data, slug: entry.slug }, entry.body);
  }
  $("save-state").textContent = "असहेजल";
  const local = readLocal();
  if (local && (!file || localDiffers(local))) show($("restore"), true);
  showView("editor");
  $("f-title").focus();
}

/* ---------- editor: toolbar ---------- */
function applyMd(kind) {
  const ta = $("f-body");
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const sel = value.slice(s, e);
  const replace = (text, cursorOffset = text.length) => {
    ta.setRangeText(text, s, e, "end");
    ta.setSelectionRange(s + cursorOffset, s + cursorOffset);
    ta.focus();
    onBodyInput();
  };
  const linePrefix = (prefix) => {
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    ta.setRangeText(prefix, lineStart, lineStart, "preserve");
    ta.setSelectionRange(s + prefix.length, e + prefix.length);
    ta.focus();
    onBodyInput();
  };
  const wrap = (mark) => replace(`${mark}${sel || "लिखाई"}${mark}`, sel ? mark.length * 2 + sel.length : mark.length);
  switch (kind) {
    case "h2":
      return linePrefix("## ");
    case "bold":
      return wrap("**");
    case "italic":
      return wrap("_");
    case "list":
      return linePrefix("- ");
    case "quote":
      return linePrefix("> ");
    case "code":
      return sel.includes("\n") ? replace(`\`\`\`\n${sel}\n\`\`\`\n`) : wrap("`");
    case "image":
      return $("f-image").click();
    case "link": {
      const dlg = $("link-dialog");
      $("link-url").value = "";
      $("link-text").value = sel;
      dlg.onclose = () => {
        if (dlg.returnValue !== "ok") return ta.focus();
        const href = $("link-url").value.trim();
        const text = $("link-text").value.trim() || href;
        if (href) replace(`[${text}](${href})`);
      };
      dlg.showModal();
      return undefined;
    }
    default:
      return undefined;
  }
}

function insertAtCaret(text) {
  const ta = $("f-body");
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const before = s > 0 && value[s - 1] !== "\n" ? "\n\n" : "";
  const after = value[e] && value[e] !== "\n" ? "\n\n" : "\n";
  ta.setRangeText(`${before}${text}${after}`, s, e, "end");
  ta.focus();
  onBodyInput();
}

/* ---------- editor: images ---------- */
function askImage(info) {
  return new Promise((resolve) => {
    const dlg = $("image-dialog");
    const alt = $("image-alt");
    const deco = $("image-decorative");
    const err = $("image-error");
    $("image-info").textContent = info;
    alt.value = "";
    deco.checked = false;
    setError(err, "");
    const form = dlg.querySelector("form");
    form.onsubmit = (ev) => {
      if (ev.submitter && ev.submitter.value === "ok" && !deco.checked && alt.value.trim() === "") {
        ev.preventDefault();
        setError(err, "alt लिखीं या सजावटी टिक करीं");
      }
    };
    dlg.onclose = () => resolve(dlg.returnValue === "ok" ? (deco.checked ? "" : alt.value.trim()) : null);
    dlg.showModal();
  });
}

async function uploadImage(file) {
  const slug = $("f-slug").value.trim();
  if (!slug) {
    showErrors([{ field: "slug", message: "पहिले slug भरीं" }]);
    $("f-slug").focus();
    return;
  }
  try {
    const img = await processImage(file);
    const kb = Math.round(img.bytes.length / 1024);
    const alt = await askImage(`${img.width}×${img.height}, ${kb} KB${img.oversized ? " (बड़ा)" : ""}`);
    if (alt === null) return;
    const name = imageFileName(file.name, img.ext, new Date(), slugify);
    const path = imagePath(slug, name);
    const message = `image: ${name} for ${slug} [skip ci]`;
    try {
      await state.client.putFile(path, { content: img.bytes, message });
    } catch (err) {
      if (!(err instanceof GitHubError && err.status === 422)) throw err;
      const { sha } = await state.client.getFile(path);
      if (!confirm("ई नाम के छवि पहिले से बा — ओवरराइट करीं?")) return;
      await state.client.putFile(path, { content: img.bytes, message, sha });
    }
    const mdPath = imageMarkdownPath(slug, name);
    state.blobs.set(mdPath, URL.createObjectURL(img.blob));
    insertAtCaret(`![${alt}](${mdPath})`);
    log(`छवि अपलोड: ${path} (${kb} KB)`);
    schedulePreview();
  } catch (err) {
    showErrors([{ field: "body", message: fail(err, "छवि") }]);
  }
}

/* ---------- editor: validation / publish ---------- */
function showErrors(errors) {
  const list = $("errors");
  clear(list);
  for (const f of [...FIELDS, "category", "tags"]) setError($(`f-${f}-error`), "");
  for (const { field, message } of errors) {
    const id = `f-${field.replace(/_/g, "-")}`;
    const target = $(id);
    const node = $(`${id}-error`);
    if (node) setError(node, message);
    list.append(el("li", {}, [el("a", { href: `#${id}`, text: message })]));
    if (target && !target.dataset.scrolled) target.setAttribute("aria-invalid", "true");
  }
  if (errors.length) list.focus();
}

function setStep(i, stateName, text) {
  const li = $("pub-steps").children[i];
  li.dataset.state = stateName;
  li.querySelector(".step-status").textContent = text || "";
}

async function publish({ draft }) {
  const data = formData();
  const body = $("f-body").value.replace(/\r\n/g, "\n").trim();
  if (!state.editing) {
    // Fresh listing so numbering and the duplicate-slug check see other devices' commits.
    try {
      await loadFiles();
    } catch (err) {
      fail(err, "सूची");
    }
  }
  const existing = state.files.map(postSlugFromName);
  const errors = validatePost({
    data,
    body,
    existingSlugs: existing,
    currentSlug: state.editing && state.editing.slug,
    draft,
    countWords,
    lexer: (md) => new Marked(MARKED_OPTIONS).lexer(md),
    categories: cfg.categories.map((c) => c.slug),
  });
  showErrors(errors);
  if (errors.length) return;
  for (const t of $("post-form").querySelectorAll("[aria-invalid]")) t.removeAttribute("aria-invalid");

  const slug = data.slug.trim();
  // The autosave key of THIS editing session, read before state.editing changes
  // below: an update must never touch the unrelated ".new" key.
  const key = draftKey();
  const path = state.editing ? `${POSTS_DIR}/${state.editing.file}` : nextPostPath(state.files, slug);
  const dlg = $("publish-dialog");
  $("pub-file").textContent = path;
  for (let i = 0; i < 3; i++) setStep(i, "pending", "");
  $("pub-result").textContent = "";
  show($("run-link"), false);
  show($("live-link"), false);
  show($("copy-live"), false);
  clearInterval(state.pollTimer);
  dlg.showModal();

  let text;
  try {
    text = serialize({ ...data, draft }) + "\n" + body + "\n";
  } catch (err) {
    setStep(0, "failed", err.message === "mixed quotes" ? "शीर्षक में एके तरह के उद्धरण राखीं" : userMessage(err));
    return;
  }
  // Drafts need only title and slug, so the label falls back to the slug.
  const label = data.title_en.trim() || slug;
  const message = draft ? `draft: ${label} [skip ci]` : `post: ${label}`;
  setStep(0, "running", "कमिट करत बानी");
  let result;
  try {
    result = await putWithRetry(path, text, message, state.editing && state.editing.sha);
  } catch (err) {
    if (err instanceof GitHubError && (err.status === 401 || err.status === 403)) {
      saveLocal();
      dlg.close();
      store.clear();
      return lock(fail(err, "कमिट"));
    }
    setStep(0, "failed", fail(err, "कमिट"));
    return;
  }
  if (!result) return; // user chose to reload after a 409
  const { commitSha, contentSha } = result;
  setStep(0, "done", `commit ${commitSha.slice(0, 7)}`);
  log(`${message} → ${path} (${commitSha.slice(0, 7)})`);
  const file = basename(path);
  if (!state.files.includes(file)) state.files.push(file);
  state.editing = { file, sha: contentSha, slug, locked: true };
  state.posts.set(file, { data: { ...data, draft: draft ? "true" : "" }, body, sha: contentSha, slug });
  $("editor-heading").textContent = `संपादन: ${data.title.trim()}`;
  $("f-slug").readOnly = true;
  $("f-slug-hint").textContent = "प्रकाशित पोस्ट के slug ना बदले";
  clearTimeout(state.autosaveTimer);
  localStorage.removeItem(key);
  state.dirty = false;
  $("save-state").textContent = `कमिट · ${hhmm()}`;

  if (draft) {
    setStep(1, "done", "deploy नइखे (ड्राफ्ट)");
    setStep(2, "done", "deploy नइखे (ड्राफ्ट)");
    $("pub-result").textContent = "ड्राफ्ट सहेजल गइल (साइट पर ना देखाई)";
    return;
  }
  pollRun(commitSha, slug);
}

async function putWithRetry(path, content, message, sha) {
  try {
    return await state.client.putFile(path, { content, message, sha });
  } catch (err) {
    if (!(err instanceof GitHubError && err.status === 409)) throw err;
    if (confirm("ई फाइल बीच में बदल गइल बा। फेर लोड करीं (रद्द) या ओवरराइट करीं (OK)?")) {
      const fresh = await state.client.getFile(path);
      return state.client.putFile(path, { content, message, sha: fresh.sha });
    }
    $("publish-dialog").close();
    if (state.editing) {
      state.posts.delete(state.editing.file);
      await openEditor(state.editing.file);
    }
    return null;
  }
}

function pollRun(commitSha, slug) {
  let polls = 0;
  let last = "";
  setStep(1, "running", "run अभी शुरू नइखे भइल");
  const tick = async () => {
    polls++;
    let run;
    try {
      run = await state.client.latestRun();
    } catch (err) {
      fail(err, "run");
      if (polls >= MAX_POLLS) finish();
      return;
    }
    const c = classifyRun(run, commitSha);
    if (c.label !== last) {
      last = c.label;
      log(`deploy: ${c.label}`);
    }
    if (c.url) {
      $("run-link").href = c.url;
      show($("run-link"), true);
    }
    if (c.state === "success") {
      clearInterval(state.pollTimer);
      setStep(1, "done", "सफल");
      const live = `${cfg.siteUrl}/posts/${slug}/`;
      $("live-link").href = live;
      show($("live-link"), true);
      show($("copy-live"), true);
      $("copy-live").onclick = () => navigator.clipboard.writeText(live).then(() => log("लिंक कॉपी भइल"), () => log("कॉपी ना भइल"));
      setStep(2, "done", live);
      $("pub-result").textContent = "लाइव बा";
      loadDeployStatus();
    } else if (c.state === "failure") {
      clearInterval(state.pollTimer);
      setStep(1, "failed", c.label);
      $("pub-result").textContent = "CI असफल — run देखीं, ठीक क के फेर प्रकाशित करीं";
    } else {
      setStep(1, "running", c.label);
      if (polls >= MAX_POLLS) finish();
    }
  };
  const finish = () => {
    clearInterval(state.pollTimer);
    $("pub-result").textContent = "अभी भी चलत बा — Actions देखीं";
    show($("run-link"), true);
  };
  state.pollTimer = setInterval(tick, POLL_MS);
  tick();
}

/* ---------- editor: events ---------- */
function onBodyInput() {
  markDirty();
  updateCounts();
  schedulePreview();
}

function bindEditor() {
  const form = $("post-form");
  for (const f of FIELDS) {
    $(`f-${f}`).addEventListener("input", () => {
      markDirty();
      if (f === "summary" || f === "summary-en") updateCounts();
      if (f === "title-en" && !state.slugTouched && !state.editing) $("f-slug").value = slugify($("f-title-en").value);
      if (f === "slug") state.slugTouched = $("f-slug").value !== "";
      schedulePreview();
    });
  }
  $("f-category").addEventListener("change", () => {
    markDirty();
    schedulePreview();
  });
  $("f-draft").addEventListener("change", markDirty);
  $("f-body").addEventListener("input", onBodyInput);
  const tags = $("f-tags");
  tags.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === "," || (ev.key === "Tab" && tags.value.trim())) {
      ev.preventDefault();
      addTag(tags.value);
      tags.value = "";
    } else if (ev.key === "Backspace" && tags.value === "" && state.tags.length) {
      state.tags.pop();
      renderTags();
      markDirty();
    }
  });
  tags.addEventListener("blur", () => {
    if (tags.value.trim()) {
      addTag(tags.value);
      tags.value = "";
    }
  });
  for (const btn of document.querySelectorAll(".toolbar [data-md]")) btn.addEventListener("click", () => applyMd(btn.dataset.md));
  form.addEventListener("keydown", (ev) => {
    if (!(ev.ctrlKey || ev.metaKey)) return;
    if (ev.key === "s" || ev.key === "S") {
      ev.preventDefault();
      saveLocal();
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      publish({ draft: false });
    }
  });
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    publish({ draft: false });
  });
  $("save-draft").addEventListener("click", () => publish({ draft: true }));
  $("back").addEventListener("click", () => (location.hash = "#/"));
  $("preview-toggle").addEventListener("click", () => {
    const wrap = $("preview-wrap");
    const open = wrap.hidden;
    show(wrap, open);
    $("preview-toggle").setAttribute("aria-expanded", String(open));
    $("preview-toggle").textContent = open ? "पूर्वावलोकन लुकाईं" : "पूर्वावलोकन देखाईं";
    if (open) renderPreview();
  });
  $("restore-yes").addEventListener("click", () => {
    const local = readLocal();
    show($("restore"), false);
    if (!local) return;
    fillForm(local.data, local.body);
    state.slugTouched = true;
    markDirty();
    log("असहेजल बदलाव वापस आइल");
  });
  $("restore-no").addEventListener("click", () => {
    localStorage.removeItem(draftKey());
    show($("restore"), false);
  });
  const files = (ev) => (ev.dataTransfer || ev.clipboardData || {}).files;
  const body = $("f-body");
  $("f-image").addEventListener("change", (ev) => {
    for (const f of ev.target.files) uploadImage(f);
    ev.target.value = "";
  });
  body.addEventListener("dragover", (ev) => ev.preventDefault());
  body.addEventListener("drop", (ev) => {
    const list = files(ev);
    if (!list || !list.length) return;
    ev.preventDefault();
    for (const f of list) uploadImage(f);
  });
  body.addEventListener("paste", (ev) => {
    const list = files(ev);
    if (!list || !list.length) return;
    ev.preventDefault();
    for (const f of list) uploadImage(f);
  });
  $("pub-close").addEventListener("click", () => $("publish-dialog").close());
  // Escape closes the dialog too, so the poll cleanup lives on the close event.
  // publish() already stored the fresh data/body/sha in state.posts; nothing to evict.
  $("publish-dialog").addEventListener("close", () => clearInterval(state.pollTimer));
  new MutationObserver(() => {
    if (!$("editor").hidden) schedulePreview();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  window.addEventListener("beforeunload", (ev) => {
    if (!state.dirty) return;
    saveLocal();
    ev.preventDefault();
    ev.returnValue = "";
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && state.dirty && !$("editor").hidden) saveLocal();
  });
}

/* ---------- router ---------- */
let currentHash = "";
async function route() {
  const hash = location.hash || "#/";
  if (!state.token) {
    showView("lock");
    currentHash = hash;
    return;
  }
  const leavingEditor = currentHash.startsWith("#/new") || currentHash.startsWith("#/edit/");
  const entering = hash.startsWith("#/new") || hash.startsWith("#/edit/");
  if (leavingEditor && !entering && state.dirty) {
    // Saved before the prompt so "stay" is lossless even if the 3 s autosave
    // has not fired yet.
    saveLocal();
    if (!confirm("असहेजल बदलाव बा। छोड़ दीं?")) {
      // Put the editor's hash back WITHOUT a hashchange: assigning location.hash
      // would re-enter openEditor() -> fillForm() and wipe the very edits kept.
      history.replaceState(null, "", currentHash);
      return;
    }
    // "छोड़ दीं" means discard: drop that copy too, or the next open of this
    // post would offer the discarded edits back through the restore banner.
    localStorage.removeItem(draftKey());
    state.dirty = false;
  }
  currentHash = hash;
  if (hash === "#/new") return openEditor(null);
  if (hash.startsWith("#/edit/")) return openEditor(decodeURIComponent(hash.slice("#/edit/".length)));
  showView("dashboard");
  loadDashboard();
}

/* ---------- boot ---------- */
async function boot() {
  if (!("showModal" in HTMLDialogElement.prototype) || typeof TextEncoder === "undefined") {
    setError($("browser-notice"), "ई ब्राउज़र पुरान बा — Chromium/Edge 120+, Firefox 120+, Safari 17+ चाहीं");
    return;
  }
  $("signin").addEventListener("submit", signIn);
  $("signin-btn").disabled = false;
  $("signout").addEventListener("click", signOut);
  $("new-post").addEventListener("click", () => (location.hash = "#/new"));
  $("dash-retry").addEventListener("click", loadDashboard);
  bindEditor();
  window.addEventListener("hashchange", route);

  const stored = store.get();
  if (stored) {
    try {
      state.client = await validateToken(stored);
      state.token = stored;
      log("सहेजल token से साइन इन");
    } catch (err) {
      if (err instanceof GitHubError && (err.status === 401 || err.kind === "push")) {
        store.clear();
        lock(err.kind === "push" ? "एह repo पर लिखे के अधिकार नइखे" : err.userMessage());
      } else {
        lock(userMessage(err));
      }
      return;
    }
  }
  route();
}

boot();

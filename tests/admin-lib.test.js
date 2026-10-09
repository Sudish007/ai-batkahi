import { test } from "node:test";
import assert from "node:assert/strict";
import { Marked } from "marked";
import { encodeUtf8, decodeUtf8, encodeBytes } from "../public/admin/lib/base64.js";
import { createClient, GitHubError, scrub } from "../public/admin/lib/github.js";
import { createStore, KEY } from "../public/admin/lib/store.js";
import { postSlugFromName, existingSlugs, nextPostPath, imageFileName, imagePath, imageMarkdownPath, todayIST } from "../public/admin/lib/paths.js";
import { classifyRun, describeLatest } from "../public/admin/lib/run-status.js";
import { validatePost, hints } from "../public/admin/lib/validate.js";
import { renderPreviewHtml } from "../public/admin/lib/preview.js";
import { MARKED_OPTIONS, createRenderer, splitInEnglish } from "../src/lib/markdown-core.js";
import { renderMarkdown } from "../src/lib/markdown.js";
import { countWords } from "../src/lib/reading-time.js";
import { slugify } from "../src/lib/slugify.js";
import { escapeHtml } from "../src/lib/xml.js";
import { parse } from "../src/lib/frontmatter.js";

const TOKEN = "ghp_FAKE_OK"; // one of the four documented fake tokens (see README "Admin")

/* ---------- base64 ---------- */
test("base64: UTF-8 round-trip, large input, GitHub-style wrapped input", () => {
  for (const s of ["नमस्ते — AI", "x".repeat(100 * 1024), "a\nb\r\n"]) {
    assert.equal(decodeUtf8(encodeUtf8(s)), s);
  }
  const b64 = encodeUtf8("बतकही ".repeat(50));
  const wrapped = b64.replace(/(.{60})/g, "$1\n");
  assert.ok(wrapped.includes("\n"));
  assert.equal(decodeUtf8(wrapped), "बतकही ".repeat(50));
  assert.equal(encodeBytes(new Uint8Array([104, 105])), "aGk=");
  assert.throws(() => decodeUtf8("////"), /decode/);
});

/* ---------- github ---------- */
function fakeFetch(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const r = handler(url, init) || {};
    const status = r.status ?? 200;
    const body = r.body === undefined ? {} : r.body;
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...(r.headers || {}) },
    });
  };
  return { calls, impl };
}
const client = (handler) => {
  const f = fakeFetch(handler);
  return { calls: f.calls, c: createClient({ token: TOKEN, owner: "Sudish007", repo: "ai-batkahi", branch: "main", fetchImpl: f.impl }) };
};

test("github: repo() URL and headers", async () => {
  const { calls, c } = client(() => ({ body: { permissions: { push: true } } }));
  const r = await c.repo();
  assert.equal(r.permissions.push, true);
  assert.equal(calls[0].url, "https://api.github.com/repos/Sudish007/ai-batkahi");
  const h = calls[0].init.headers;
  assert.equal(h.Accept, "application/vnd.github+json");
  assert.equal(h["X-GitHub-Api-Version"], "2022-11-28");
  assert.equal(h.Authorization, `Bearer ${TOKEN}`);
  assert.equal(calls[0].init.method, "GET");
});
test("github: listDir 404 -> [], getFile decodes, putFile/deleteFile bodies", async () => {
  const { c } = client(() => ({ status: 404, body: { message: "Not Found" } }));
  assert.deepEqual(await c.listDir("content/posts"), []);
  const content = encodeUtf8("---\ntitle: क\n---\nbody").replace(/(.{20})/g, "$1\n");
  const { calls, c: c2 } = client((url, init) => {
    if (init.method === "GET") return { body: { content, sha: "abc" } };
    if (init.method === "PUT") return { body: { content: { sha: "newsha" }, commit: { sha: "commit1" } } };
    return { body: { commit: { sha: "del" } } };
  });
  const f = await c2.getFile("content/posts/01-a.md");
  assert.equal(f.text, "---\ntitle: क\n---\nbody");
  assert.equal(f.sha, "abc");
  assert.ok(calls[0].url.endsWith("/contents/content/posts/01-a.md?ref=main"));
  const put = await c2.putFile("content/posts/07-g.md", { content: "hello", message: "post: G" });
  assert.deepEqual(put, { contentSha: "newsha", commitSha: "commit1" });
  const body = JSON.parse(calls[1].init.body);
  assert.deepEqual(Object.keys(body).sort(), ["branch", "content", "message"]);
  assert.equal(body.content, encodeUtf8("hello"));
  assert.equal(body.branch, "main");
  assert.equal(calls[1].init.headers["Content-Type"], "application/json");
  await c2.putFile("content/posts/07-g.md", { content: new Uint8Array([1, 2, 3]), message: "m", sha: "old" });
  const body2 = JSON.parse(calls[2].init.body);
  assert.equal(body2.sha, "old");
  assert.equal(body2.content, encodeBytes(new Uint8Array([1, 2, 3])));
  await c2.deleteFile("content/posts/07-g.md", { message: "post: delete G", sha: "s1" });
  assert.equal(calls[3].init.method, "DELETE");
  assert.deepEqual(JSON.parse(calls[3].init.body), { message: "post: delete G", sha: "s1", branch: "main" });
});
test("github: latestRun / latestPagesRun URLs", async () => {
  const { calls, c } = client(() => ({ body: { workflow_runs: [{ id: 1 }] } }));
  assert.deepEqual(await c.latestRun(), { id: 1 });
  assert.ok(calls[0].url.endsWith("/actions/runs?branch=main&event=push&per_page=1"), calls[0].url);
  await c.latestPagesRun();
  assert.ok(calls[1].url.endsWith("/actions/workflows/pages.yml/runs?per_page=1"));
  const { c: c2 } = client(() => ({ body: { workflow_runs: [] } }));
  assert.equal(await c2.latestRun(), null);
});
test("github: error mapping and token scrubbing", async () => {
  const cases = [
    [{ status: 401, body: { message: "Bad credentials" } }, "टोकन गलत बा या खतम हो गइल"],
    [{ status: 403, body: { message: "rate" }, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1800000000" } }, /^GitHub rate limit — .+ पर फेर कोशिश करीं$/],
    [{ status: 403, body: { message: "Forbidden" } }, "टोकन के एह repo तक पहुँच नइखे"],
    [{ status: 404, body: { message: "Not Found" } }, "टोकन के एह repo तक पहुँच नइखे"],
    [{ status: 409, body: { message: "conflict" } }, "ई फाइल बीच में बदल गइल बा"],
    [{ status: 422, body: { message: "Invalid request.\n\n\"sha\" wasn't supplied." } }, "Invalid request.\n\n\"sha\" wasn't supplied."],
    [{ status: 500, body: { message: "boom" } }, "GitHub 500: boom"],
  ];
  for (const [resp, expected] of cases) {
    const { c } = client(() => resp);
    const err = await c.repo().catch((e) => e);
    assert.ok(err instanceof GitHubError, String(resp.status));
    assert.equal(err.status, resp.status);
    if (expected instanceof RegExp) assert.match(err.userMessage(), expected);
    else assert.equal(err.userMessage(), expected);
    assert.ok(!String(err).includes(TOKEN));
    assert.ok(!err.userMessage().includes(TOKEN));
  }
  const net = createClient({ token: TOKEN, owner: "o", repo: "r", branch: "main", fetchImpl: async () => { throw new TypeError("Failed to fetch"); } });
  const err = await net.repo().catch((e) => e);
  assert.equal(err.kind, "network");
  assert.equal(err.userMessage(), "नेटवर्क नइखे — फेर कोशिश करीं");
  assert.equal(scrub(`Bearer ${TOKEN} failed`, TOKEN), "Bearer ••• failed");
  assert.equal(scrub("plain", null), "plain");
});

/* ---------- store ---------- */
function memStorage(throwOnSet = false) {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      if (throwOnSet) throw new Error("QuotaExceededError");
      m.set(k, v);
    },
    removeItem: (k) => m.delete(k),
  };
}
test("store: session by default, local with remember, clear empties both", () => {
  const session = memStorage();
  const local = memStorage();
  const s = createStore({ session, local });
  assert.equal(KEY, "batkahi.admin.token");
  assert.equal(s.get(), null);
  assert.deepEqual(s.set("t1", false), { persisted: true });
  assert.equal(session.getItem(KEY), "t1");
  assert.equal(local.getItem(KEY), null);
  assert.equal(s.remembered(), false);
  assert.deepEqual(s.set("t2", true), { persisted: true });
  assert.equal(local.getItem(KEY), "t2");
  assert.equal(session.getItem(KEY), null);
  assert.equal(s.get(), "t2");
  assert.equal(s.remembered(), true);
  s.clear();
  assert.equal(session.m.size + local.m.size, 0);
  const broken = createStore({ session: memStorage(true), local: memStorage(true) });
  assert.deepEqual(broken.set("x", false), { persisted: false });
  assert.equal(broken.get(), null);
});

/* ---------- paths ---------- */
test("paths: post names, next path, image names, IST date", () => {
  assert.equal(postSlugFromName("07-x-y.md"), "x-y");
  assert.deepEqual(existingSlugs(["01-a.md", "06-f.md", "README"]), ["a", "f"]);
  assert.equal(nextPostPath(["01-a.md", "06-f.md", "README"], "g"), "content/posts/07-g.md");
  assert.equal(nextPostPath([], "g"), "content/posts/01-g.md");
  assert.equal(imageFileName("My Photo.PNG", "webp", new Date("2026-10-09")), "20261009-my-photo.webp");
  assert.equal(imageFileName("My Photo.PNG", "jpg", new Date("2026-10-09"), slugify), "20261009-my-photo.jpg");
  assert.equal(imageFileName("तस्वीर.png", "webp", new Date("2026-10-09")), "20261009-image.webp");
  // Same IST shift as todayIST: 19:00 UTC is already the next day in India.
  assert.equal(imageFileName("a.png", "webp", new Date("2026-10-08T19:00:00Z")), "20261009-a.webp");
  assert.equal(imageFileName("a.png", "webp", new Date("2026-10-08T18:00:00Z")), "20261008-a.webp");
  assert.equal(imagePath("g", "x.webp"), "content/images/g/x.webp");
  assert.equal(imageMarkdownPath("g", "x.webp"), "/images/g/x.webp");
  assert.equal(todayIST(new Date("2026-10-08T19:00:00Z")), "2026-10-09");
  assert.equal(todayIST(new Date("2026-10-08T18:00:00Z")), "2026-10-08");
});

/* ---------- run-status ---------- */
test("run-status: classifyRun states incl. stale head_sha", () => {
  const sha = "abc";
  assert.equal(classifyRun(null, sha).state, "waiting");
  assert.equal(classifyRun({ head_sha: "other", status: "completed", conclusion: "success" }, sha).state, "waiting");
  assert.equal(classifyRun(null, sha).label, "run अभी शुरू नइखे भइल");
  for (const st of ["queued", "waiting", "pending", "requested"]) {
    assert.deepEqual(classifyRun({ head_sha: sha, status: st, html_url: "u" }, sha), { state: "queued", label: "कतार में", url: "u" });
  }
  assert.equal(classifyRun({ head_sha: sha, status: "in_progress" }, sha).label, "चलत बा");
  assert.deepEqual(classifyRun({ head_sha: sha, status: "completed", conclusion: "success", html_url: "u" }, sha), { state: "success", label: "सफल", url: "u" });
  assert.deepEqual(classifyRun({ head_sha: sha, status: "completed", conclusion: "failure" }, sha), { state: "failure", label: "असफल (failure)", url: null });
  const now = new Date("2026-10-09T10:00:00Z");
  assert.equal(describeLatest(null, now), null);
  assert.equal(describeLatest({ status: "completed", conclusion: "success", updated_at: "2026-10-09T09:55:00Z", html_url: "u" }, now).text, "आखिरी deploy (साइट बनावल): सफल · 5 मिनट पहिले");
  assert.equal(describeLatest({ status: "completed", conclusion: "failure", updated_at: "2026-10-09T07:00:00Z" }, now).text, "आखिरी deploy (साइट बनावल): असफल · 3 घंटा पहिले");
  assert.equal(describeLatest({ status: "in_progress", updated_at: "2026-10-01T07:00:00Z" }, now).text, "आखिरी deploy (साइट बनावल): चलत बा · 2026-10-01");
});

/* ---------- validate ---------- */
const BHO = "ई एगो लंबा बतकही बा जे पचास शब्द से जादा होखे के चाहीं। ".repeat(8);
const EN = "This is the English summary of the post with more than twenty words in it for the validator to accept. ";
const VALID = {
  title: "LLM कइसे बोलेला",
  title_en: "How an LLM talks",
  slug: "llm-kaise-bolela-2",
  date: "2026-10-09",
  category: "samajh",
  tags: ["ChatGPT", "डेटा"],
  summary: "छोट सार।",
  summary_en: "Short summary.",
  instagram: "",
};
const BODY = `परिचय\n\n## पहिला खंड\n\n${BHO}\n\n## दूसरा खंड\n\n${BHO}\n\n## In English\n\n${EN}${EN}`;
const CATS = ["samajh", "aujaar", "raasta", "khabar"];
const run = (data = {}, body = BODY, extra = {}) =>
  validatePost({ data: { ...VALID, ...data }, body, existingSlugs: ["llm-kaise-bolela"], countWords, categories: CATS, ...extra });
const messages = (errs) => errs.map((e) => `${e.field}:${e.message}`);

test("validate: a complete valid post has no errors; draft ignores all but title and slug", () => {
  assert.deepEqual(run(), []);
  assert.deepEqual(run({ title_en: "", summary: "", tags: [] }, "nothing", { draft: true }), []);
  assert.deepEqual(messages(run({ title: "", slug: "" }, "x", { draft: true })), ["title:शीर्षक जरूरी बा", "slug:slug में सिर्फ a-z, 0-9 आ -"]);
});
test("validate: every rule fails with its exact message", () => {
  const cases = [
    [{ title: "  " }, "title:शीर्षक जरूरी बा"],
    [{ title: "क".repeat(121) }, "title:120 अक्षर से कम राखीं"],
    [{ title_en: "" }, "title_en:Title is required"],
    [{ title_en: "x".repeat(121) }, "title_en:Keep it under 120 characters"],
    [{ slug: "Bad_Slug" }, "slug:slug में सिर्फ a-z, 0-9 आ -"],
    [{ slug: "ab" }, "slug:slug में सिर्फ a-z, 0-9 आ -"],
    [{ slug: "llm-kaise-bolela" }, "slug:ई slug पहिले से बा"],
    [{ date: "2026-13-01" }, "date:तारीख YYYY-MM-DD में"],
    [{ date: "2026-02-30" }, "date:तारीख YYYY-MM-DD में"],
    [{ date: "9 Oct" }, "date:तारीख YYYY-MM-DD में"],
    [{ category: "nope" }, "category:विषय चुनीं"],
    [{ tags: [] }, "tags:1 से 8 टैग"],
    [{ tags: "123456789".split("") }, "tags:1 से 8 टैग"],
    [{ tags: ["a,b"] }, "tags:टैग में , या [ ] ना चलेला"],
    [{ tags: ["[x]"] }, "tags:टैग में , या [ ] ना चलेला"],
    [{ tags: ["x".repeat(31)] }, "tags:टैग में , या [ ] ना चलेला"],
    [{ summary: "" }, "summary:सार जरूरी बा"],
    [{ summary: "क".repeat(301) }, "summary:सार 300 अक्षर से कम"],
    [{ summary_en: "" }, "summary_en:सार जरूरी बा"],
    [{ summary_en: "x".repeat(301) }, "summary_en:सार 300 अक्षर से कम"],
  ];
  for (const [patch, expected] of cases) {
    assert.deepEqual(messages(run(patch)), [expected], JSON.stringify(patch).slice(0, 60));
  }
  assert.equal(run({ instagram: "https://instagram.com/p/x" }).length, 1);
  assert.equal(run({ instagram: "https://www.instagram.com/p/x/" }).length, 0);
  assert.equal(run({ slug: "llm-kaise-bolela" }, BODY, { currentSlug: "llm-kaise-bolela" }).length, 0);
  assert.deepEqual(run({ summary: "line one\nline two" }), []);
});
test("validate: body rules", () => {
  const bodyCases = [
    [`# शीर्षक\n${BODY}`, "# (h1) मत लिखीं — h2 से शुरू करीं"],
    [`शीर्षक\n===\n\n${BODY}`, "शीर्षक खातिर ## लिखीं (=== / --- ना)"],
    [`${BODY}\n\nपैरा\n---\n`, "शीर्षक खातिर ## लिखीं (=== / --- ना)"],
    [`### छोट\n${BODY}`, "### से पहिले ## चाहीं"],
    [`## पहिला\n${BHO}`, "In English खंड जरूरी बा (अंत में)"],
    [`## In English\n${EN}\n## पहिला\n${BHO}`, "In English खंड जरूरी बा (अंत में)"],
    [`## पहिला\n${BHO}\n## In English\n${EN}\n## In English\n${EN}`, "In English खंड जरूरी बा (अंत में)"],
    [`## पहिला\nथोड़ा।\n## In English\n${EN}`, "कम से कम 50 शब्द"],
    [`## पहिला\n${BHO}\n## In English\nToo short.`, "In English में कम से कम 20 शब्द"],
  ];
  for (const [body, expected] of bodyCases) {
    const errs = run({}, body).filter((e) => e.field === "body");
    assert.deepEqual(errs.map((e) => e.message), [expected], body.slice(0, 30));
  }
  assert.deepEqual(hints({ body: `## एक\n${BHO}\n## In English\n${EN}` }), ["2 से कम ## खंड: ToC ना बनी"]);
  assert.deepEqual(hints({ body: BODY }), []);
});

/* ---------- preview ---------- */
test("preview: heading ids equal renderMarkdown(), in-english section, stylesheet, dark theme", () => {
  const body = `## पहिला खंड\n\nकुछ लिखाई [लिंक](/posts/x/) आ ![फोटो](/images/s/a.webp)\n\n## Section Two\n\n## पहिला खंड\n\n## In English\n\nEnglish text.`;
  const ids = (html) => [...html.matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]);
  const { body: main, inEnglish } = splitInEnglish(body);
  const expected = [...ids(renderMarkdown(main)), ...ids(`<h2 id="in-english-heading">`), ...ids(renderMarkdown(inEnglish))];
  const html = renderPreviewHtml({
    data: { title: "शीर्षक <b>", title_en: "Title" },
    body,
    Marked,
    MARKED_OPTIONS,
    createRenderer,
    splitInEnglish,
    resolveUrl: (h) => (h.startsWith("/") ? `/ai-batkahi/${h.slice(1)}` : h),
    stylesheetHref: "/ai-batkahi/styles.css",
    theme: "dark",
    categoryName: "समझ",
    minutes: 2,
    dateLabel: "9 अक्टूबर 2026",
    escapeHtml,
  });
  assert.deepEqual(ids(html), expected);
  assert.deepEqual(ids(html), ["section-1", "section-two", "section-3", "in-english-heading"]);
  assert.ok(html.startsWith('<!doctype html><html lang="bho" data-theme="dark">'));
  assert.ok(html.includes('<link rel="stylesheet" href="/ai-batkahi/styles.css">'));
  assert.ok(html.includes('<section class="in-english" lang="en">'));
  assert.ok(html.includes("<h1>शीर्षक &lt;b&gt;</h1>"));
  assert.ok(html.includes("समझ · 9 अक्टूबर 2026 · पढ़े में ~2 मिनट"));
  assert.ok(html.includes('src="/ai-batkahi/images/s/a.webp"'));
  assert.ok(html.includes('href="/ai-batkahi/posts/x/"'));
  const light = renderPreviewHtml({ data: {}, body: "hi", Marked, MARKED_OPTIONS, createRenderer, splitInEnglish, stylesheetHref: "s.css", escapeHtml });
  assert.ok(light.startsWith('<!doctype html><html lang="bho"><head>'));
  assert.ok(!light.includes("in-english"));
  assert.ok(light.includes("<h1>शीर्षक</h1>"));
});

/* ---------- serialize round trip (what publish() writes) ---------- */
test("publish payload: serialize + body parses back with the same keys", async () => {
  const { serialize } = await import("../src/lib/frontmatter.js");
  const text = serialize({ ...VALID, draft: true }) + "\n" + BODY.trim() + "\n";
  assert.ok(text.startsWith("---\ndraft: true\ntitle:"));
  const { data, body } = parse(text);
  assert.equal(data.draft, "true");
  assert.equal(data.title_en, VALID.title_en);
  assert.deepEqual(data.tags, VALID.tags);
  assert.equal(body.trim(), BODY.trim());
});

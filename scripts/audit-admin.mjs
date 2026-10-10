// Real-browser audit of dist/admin/ with GitHub fully mocked. Playwright for Node
// is NOT a dependency: it is loaded from PW_PATH (a playwright package directory).
//
// Every call to https://api.github.com and https://raw.githubusercontent.com is
// answered by an in-memory fake repo seeded from content/posts/*.md (CORS
// preflights included). No real token exists; the only token strings here are
// the documented fakes: ghp_FAKE_OK (push), ghp_FAKE_READONLY (push: false),
// ghp_FAKE_RATE (403 + x-ratelimit-remaining: 0) and ghp_FAKE_BAD (401).
// The real publish path against GitHub is therefore UNTESTED by this script.
//
// Usage:  npm run audit:admin        (serves dist/ itself on a free port >= 8081)
//         AUDIT_URL=http://127.0.0.1:8082 npm run audit:admin
//         node scripts/audit-admin.mjs lock editor   (subset of steps)
// Output: .agents/tasks/ui-v2/audit-admin-results.json and viewport-only
//         screenshots in .agents/tasks/ui-v2/shots-phase2/. Exit 1 on any failure.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { get } from "node:http";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import config from "../site.config.js";
import categories from "../content/categories.js";
import { renderMarkdown, splitInEnglish } from "../src/lib/markdown.js";
import { countWords } from "../src/lib/reading-time.js";
import { parse } from "../src/lib/frontmatter.js";
import { imageSize } from "../src/lib/image-size.js";
import { slugFromFilename } from "../src/lib/slugify.js";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || "playwright");

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = join(ROOT, ".agents", "tasks", "ui-v2");
const SHOTS = join(OUT, "shots-phase2");
mkdirSync(SHOTS, { recursive: true });

const { owner: OWNER, name: REPO, branch: BRANCH } = config.repo;
const API = "https://api.github.com";
const REPO_PATH = `/repos/${OWNER}/${REPO}`;
const TOKEN_OK = "ghp_FAKE_OK";
const TOKEN_READONLY = "ghp_FAKE_READONLY";
const TOKEN_RATE = "ghp_FAKE_RATE";
const TOKEN_BAD = "ghp_FAKE_BAD";
const FAKE_TOKENS = [TOKEN_OK, TOKEN_READONLY, TOKEN_RATE, TOKEN_BAD];
const TOKEN_KEY = "batkahi.admin.token";
const LIGHT_BG = "#FAF6EF";
const DARK_BG = "#15130F";
const WIDTHS = [320, 390, 820, 1440, 2560];
const THEMES = ["light", "dark"];
const POLL_MS = 10000;

const results = [];
function record(check, page, width, theme, ok, detail) {
  results.push({ check, page, width, theme, ok: !!ok, detail });
  if (!ok) console.log(`  FAIL ${check} ${page} ${width} ${theme}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
}

/* ---------- real content (expected values) ---------- */
const POSTS_DIR = join(ROOT, "content", "posts");
const REAL_POSTS = readdirSync(POSTS_DIR)
  .filter((f) => f.endsWith(".md"))
  .sort()
  .map((name) => {
    const text = readFileSync(join(POSTS_DIR, name), "utf8");
    const { data, body } = parse(text);
    return { name, text, data, body, slug: slugFromFilename(name) };
  });
const categoryName = (slug) => (categories.find((c) => c.slug === slug) || {}).name || slug;

/* ---------- server ---------- */
function freePort(start) {
  return new Promise((resolve) => {
    const tryPort = (p) => {
      const srv = createServer();
      srv.once("error", () => tryPort(p + 1));
      srv.listen(p, "127.0.0.1", () => srv.close(() => resolve(p)));
    };
    tryPort(start);
  });
}
function status(url) {
  return new Promise((resolve) => {
    const req = get(url, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on("error", () => resolve(0));
  });
}
async function startServer() {
  if (process.env.AUDIT_URL) return { origin: process.env.AUDIT_URL.replace(/\/$/, ""), child: null };
  const port = await freePort(8081);
  const child = spawn(process.execPath, [join(ROOT, "scripts", "serve.mjs")], {
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    if ((await status(origin + config.basePath)) === 200) return { origin, child };
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error("serve.mjs did not come up on " + origin);
}

/* ---------- fake GitHub ---------- */
const sha1 = (buf) => createHash("sha1").update(buf).digest("hex");
// GitHub wraps base64 content at 60 columns.
const b64 = (buf) => buf.toString("base64").replace(/(.{60})/g, "$1\n");
const PNG_1x1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

function makeFakeRepo() {
  const files = new Map();
  for (const p of REAL_POSTS) {
    const content = Buffer.from(p.text, "utf8");
    files.set(`content/posts/${p.name}`, { content, sha: sha1(content) });
  }
  return { files, images: [], commits: [], runs: [], puts: [], deletes: [], failNext: false, nextId: 100, requests: 0 };
}

function installMocks(ctx, fake) {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, X-GitHub-Api-Version",
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Expose-Headers": "x-ratelimit-remaining, x-ratelimit-reset",
  };
  const json = (route, status, body, headers = {}) =>
    route.fulfill({ status, headers: { ...CORS, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

  const newRun = (commitSha) => {
    const id = fake.nextId++;
    const run = {
      id,
      head_sha: commitSha,
      status: "queued",
      conclusion: null,
      html_url: `https://github.com/${OWNER}/${REPO}/actions/runs/${id}`,
      updated_at: new Date().toISOString(),
      fail: fake.failNext,
    };
    fake.failNext = false;
    fake.runs.push(run);
    return run;
  };
  // One state per call: queued -> in_progress -> completed (success | failure).
  const advance = (run) => {
    if (run.status === "queued") run.status = "in_progress";
    else if (run.status === "in_progress") {
      run.status = "completed";
      run.conclusion = run.fail ? "failure" : "success";
    }
    run.updated_at = new Date().toISOString();
  };
  const publicRun = ({ fail, ...run }) => run;
  const commit = (message, path, content) => {
    const sha = sha1(Buffer.concat([Buffer.from(message + path), content || Buffer.alloc(0), Buffer.from(String(fake.commits.length))]));
    const entry = { sha, message, path, decoded: /\.md$/.test(path) && content ? content.toString("utf8") : null };
    fake.commits.push(entry);
    if (!message.includes("[skip ci]")) newRun(sha);
    return sha;
  };

  const handler = (route, request) => {
    fake.requests++;
    const method = request.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(request.url());
    const token = (request.headers()["authorization"] || "").replace(/^Bearer\s+/i, "");
    if (token === TOKEN_RATE) {
      return json(route, 403, { message: "API rate limit exceeded" }, {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 600),
      });
    }
    if (token !== TOKEN_OK && token !== TOKEN_READONLY) return json(route, 401, { message: "Bad credentials" });
    const p = url.pathname;
    if (p === REPO_PATH) return json(route, 200, { full_name: `${OWNER}/${REPO}`, permissions: { push: token === TOKEN_OK, pull: true } });

    const m = p.match(new RegExp(`^${REPO_PATH}/contents/(.+)$`));
    if (m) {
      const path = decodeURIComponent(m[1]).replace(/\/$/, "");
      if (method === "GET") {
        const file = fake.files.get(path);
        if (file) return json(route, 200, { name: path.split("/").pop(), path, sha: file.sha, size: file.content.length, type: "file", encoding: "base64", content: b64(file.content) });
        const listing = [...fake.files.entries()]
          .filter(([k]) => k.startsWith(path + "/") && !k.slice(path.length + 1).includes("/"))
          .map(([k, v]) => ({ name: k.split("/").pop(), path: k, sha: v.sha, size: v.content.length, type: "file" }));
        if (listing.length) return json(route, 200, listing);
        return json(route, 404, { message: "Not Found" });
      }
      if (method === "PUT") {
        const body = request.postDataJSON();
        const existing = fake.files.get(path);
        const rec = { path, message: body.message, sha: body.sha, branch: body.branch, status: 0 };
        fake.puts.push(rec);
        if (existing && !body.sha) return json(route, (rec.status = 422), { message: '"sha" wasn\'t supplied' });
        if (existing && body.sha !== existing.sha) return json(route, (rec.status = 409), { message: `${path} does not match ${body.sha}` });
        const content = Buffer.from(String(body.content).replace(/\s+/g, ""), "base64");
        const newSha = sha1(content);
        fake.files.set(path, { content, sha: newSha });
        if (path.startsWith("content/images/")) fake.images.push(path);
        const commitSha = commit(body.message, path, content);
        rec.status = existing ? 200 : 201;
        return json(route, rec.status, { content: { path, sha: newSha }, commit: { sha: commitSha, message: body.message } });
      }
      if (method === "DELETE") {
        const body = request.postDataJSON();
        const existing = fake.files.get(path);
        const rec = { path, message: body.message, sha: body.sha, branch: body.branch, status: 0 };
        fake.deletes.push(rec);
        if (!existing) return json(route, (rec.status = 404), { message: "Not Found" });
        if (!body.sha) return json(route, (rec.status = 422), { message: '"sha" wasn\'t supplied' });
        if (body.sha !== existing.sha) return json(route, (rec.status = 409), { message: "sha mismatch" });
        fake.files.delete(path);
        const commitSha = commit(body.message, path, null);
        rec.status = 200;
        return json(route, 200, { content: null, commit: { sha: commitSha } });
      }
    }
    if (p === `${REPO_PATH}/actions/workflows/pages.yml/runs`) {
      const done = [...fake.runs].reverse().find((r) => r.status === "completed");
      const canned = {
        id: 1,
        head_sha: "0".repeat(40),
        status: "completed",
        conclusion: "success",
        html_url: `https://github.com/${OWNER}/${REPO}/actions/runs/1`,
        updated_at: new Date(Date.now() - 3 * 60000).toISOString(),
      };
      return json(route, 200, { total_count: 1, workflow_runs: [done ? publicRun(done) : canned] });
    }
    if (p === `${REPO_PATH}/actions/runs`) {
      const newest = fake.runs[fake.runs.length - 1];
      if (!newest) return json(route, 200, { total_count: 0, workflow_runs: [] });
      const snapshot = publicRun(newest);
      advance(newest);
      return json(route, 200, { total_count: 1, workflow_runs: [snapshot] });
    }
    return json(route, 404, { message: `unmocked ${method} ${p}` });
  };

  return Promise.all([
    ctx.route(`${API}/**`, handler),
    ctx.route("https://raw.githubusercontent.com/**", (route) =>
      route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "image/png" }, body: PNG_1x1 }),
    ),
  ]);
}

/* ---------- browser helpers ---------- */
let browser;
let BASE;
let ADMIN;

async function newCtx({ width = 1440, height = 900, theme = "light", token = null, fake = makeFakeRepo(), clock = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: "dark" });
  // Collected per context: CSP violations (in-page), page errors and console lines (Node side).
  // meta.dialog: "accept" (default) or "dismiss" for the native confirm()/beforeunload prompts.
  ctx.meta = { fake, errors: [], console: [], width, theme, label: `${width} ${theme}`, dialog: "accept" };
  await ctx.addInitScript(
    ({ theme, token, key }) => {
      window.__csp = [];
      document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`));
      try {
        if (theme === "dark") localStorage.setItem("theme", "dark");
        else localStorage.removeItem("theme");
        if (token) sessionStorage.setItem(key, token);
      } catch (e) {}
    },
    { theme, token, key: TOKEN_KEY },
  );
  await installMocks(ctx, fake);
  ctx.on("page", (page) => {
    page.on("pageerror", (err) => ctx.meta.errors.push(String((err && err.message) || err)));
    page.on("console", (msg) => ctx.meta.console.push(`${msg.type()}: ${msg.text()}`));
    page.on("dialog", (d) => (ctx.meta.dialog === "dismiss" ? d.dismiss() : d.accept()));
  });
  const page = await ctx.newPage();
  if (clock) await page.clock.install();
  return { ctx, page, fake };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
}
async function open(page, hash = "") {
  await page.goto(ADMIN + hash, { waitUntil: "load" });
  await settle(page);
}
// Same-document route change (hashchange) + a short settle.
async function go(page, hash) {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(400);
}
const csp = (page) => page.evaluate(() => window.__csp || []);
// Close a context and record its CSP / page-error / console-hygiene rows.
async function closeCtx(ctx, page, label) {
  const violations = await csp(page).catch(() => ["(page gone)"]);
  record("csp", label, ctx.meta.width, ctx.meta.theme, violations.length === 0, violations.length ? violations : "zero securitypolicyviolation");
  record("pageErrors", label, ctx.meta.width, ctx.meta.theme, ctx.meta.errors.length === 0, ctx.meta.errors.length ? ctx.meta.errors : "none");
  const leaks = ctx.meta.console.filter((l) => FAKE_TOKENS.some((t) => l.includes(t)));
  const url = page.url();
  record("tokenHygiene console/url", label, ctx.meta.width, ctx.meta.theme, leaks.length === 0 && !FAKE_TOKENS.some((t) => url.includes(t)), { leaks, url, consoleLines: ctx.meta.console.length });
  await ctx.close();
}
function pngSize(file) {
  const b = readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG: " + file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
async function shot(page, name, width, height, theme) {
  const file = `admin-${name}-${width}x${height}-${theme}.png`;
  const out = join(SHOTS, file);
  await settle(page);
  await page.screenshot({ path: out, fullPage: false });
  const size = pngSize(out);
  const live = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  record("S screenshot", name, width, theme, live.w === width && live.h === height && size.width === width && size.height === height && size.width <= 4000 && size.height <= 4000, { file: "shots-phase2/" + file, ...size });
}
const visibleView = (page) => page.evaluate(() => ({ lock: !document.getElementById("lock").hidden, dashboard: !document.getElementById("dashboard").hidden, editor: !document.getElementById("editor").hidden }));
const stepState = (page, i) => page.evaluate((i) => { const li = document.querySelectorAll("#pub-steps li")[i]; return { state: li.dataset.state, status: li.querySelector(".step-status").textContent }; }, i);
const waitStep = (page, i, state, timeout = 10000) => page.waitForFunction(([i, s]) => document.querySelectorAll("#pub-steps li")[i].dataset.state === s, [i, state], { timeout });
const activity = (page) => page.$$eval("#activity-list li", (l) => l.map((x) => x.textContent));

async function signIn(page, token, remember = false) {
  await page.fill("#token", token);
  await page.evaluate((on) => { document.getElementById("remember").checked = on; }, remember);
  await page.click("#signin-btn");
}
async function waitDashboard(page) {
  await page.waitForFunction(() => !document.getElementById("dashboard").hidden && document.getElementById("post-list").getAttribute("aria-busy") === "false" && document.getElementById("post-list").children.length > 0 && !document.getElementById("post-list").classList.contains("skeleton"), null, { timeout: 10000 });
}
async function waitEditor(page) {
  await page.waitForFunction(() => !document.getElementById("editor").hidden && document.getElementById("f-date").value !== "", null, { timeout: 10000 });
  await page.waitForTimeout(300);
}
// publish() reloads the listing before it resets the dialog steps, so a bare
// "step 1 done" wait could match the previous publish. Wait for the new commit first.
async function clickPublish(page, fake, selector = "#publish") {
  const before = fake.commits.length;
  await page.click(selector);
  const t0 = Date.now();
  while (fake.commits.length === before && Date.now() - t0 < 10000) await sleep(50);
  await waitStep(page, 0, "done");
}
async function addTags(page, tags) {
  for (const t of tags) {
    await page.fill("#f-tags", t);
    await page.press("#f-tags", "Enter");
  }
}

// Markdown fixture: two Bhojpuri-side headings incl. a Devanagari one, duplicate
// heading text, a link, and an In English section of 25 words.
const BHO = "ई एगो लंबा बतकही बा जे पचास शब्द से जादा होखे के चाहीं, एही से हम एके बात कई बेर कहत बानी। ";
const EN25 = "This is the English summary of the post and it has exactly twenty five words in it for the validator to accept it now.";
const FIXTURE_BODY = `परिचय के लाइन, [एगो लिंक](https://example.com/x) के साथे।\n\n## पहिला खंड\n\n${BHO.repeat(2)}\n\n## Second Part\n\n${BHO.repeat(2)}\n\n## पहिला खंड\n\n${BHO}\n\n## In English\n\n${EN25}`;
function expectedPreviewIds(body) {
  const { body: main, inEnglish } = splitInEnglish(body);
  const ids = (html) => [...html.matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]);
  return [...ids(renderMarkdown(main)), ...(inEnglish ? ["in-english-heading", ...ids(renderMarkdown(inEnglish))] : [])];
}
const NEW_POST = {
  title: "ड्राई-रन बतकही",
  title_en: "Dry run post",
  slug: "dry-run-post",
  category: "khabar",
  tags: ["dry-run", "परीक्षण"],
  summary: "ई एगो परीक्षण बतकही बा जे admin audit लिखेला।",
  summary_en: "A test post written by the admin audit.",
};
async function fillPost(page, post, body = FIXTURE_BODY) {
  await page.fill("#f-title", post.title);
  await page.fill("#f-title-en", post.title_en);
  await page.selectOption("#f-category", post.category);
  await addTags(page, post.tags);
  await page.fill("#f-summary", post.summary);
  await page.fill("#f-summary-en", post.summary_en);
  await page.fill("#f-body", body);
  await page.waitForTimeout(500); // preview debounce (300 ms)
}

/* ---------- WCAG contrast from computed "rgb(r, g, b)" strings ---------- */
function luminance(rgb) {
  const m = String(rgb).match(/\d+(\.\d+)?/g) || [0, 0, 0];
  const [r, g, b] = m.slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/* ---------- in-page evaluator for H (layout matrix) ---------- */
function layoutEval() {
  const de = document.documentElement;
  const editor = document.getElementById("editor");
  const out = { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, editorScroll: editor.scrollWidth, editorClient: editor.clientWidth };
  const visible = (el) => {
    if (!el || el.closest("[hidden]") || el.closest(".visually-hidden")) return false;
    if (!el.getClientRects().length) return false;
    return getComputedStyle(el).visibility !== "hidden";
  };
  const desc = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : "");
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  out.small = [];
  const seen = new Set();
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el || el.tagName === "SCRIPT" || el.tagName === "STYLE" || !visible(el) || seen.has(el)) continue;
    seen.add(el);
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) out.small.push({ el: desc(el), fs });
  }
  out.shortControls = [];
  out.unlabelled = [];
  out.fieldBorders = []; // non-text contrast (WCAG 1.4.11): field boundary vs its own background
  for (const el of document.querySelectorAll("a, button, input, select, textarea")) {
    if (!visible(el)) continue;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && !/^(checkbox|file)$/.test(el.type)) {
      const cs = getComputedStyle(el);
      out.fieldBorders.push({ el: desc(el), border: cs.borderTopColor, bg: cs.backgroundColor });
    }
    let r = el.getBoundingClientRect();
    // A checkbox's target is the box plus its <label for>: measure their union.
    if (el.tagName === "INPUT" && el.type === "checkbox") {
      const label = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
      if (label) {
        const l = label.getBoundingClientRect();
        r = { height: Math.max(r.bottom, l.bottom) - Math.min(r.top, l.top), width: Math.max(r.right, l.right) - Math.min(r.left, l.left) };
      }
    }
    if (r.height < 40) out.shortControls.push({ el: desc(el), h: Math.round(r.height * 10) / 10, w: Math.round(r.width) });
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
      const labelled = (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.getAttribute("aria-labelledby") || el.getAttribute("aria-label") || el.closest("label");
      if (!labelled) out.unlabelled.push(desc(el));
    }
  }
  return out;
}

/* ---------- checks ---------- */
async function lock() {
  const { ctx, page } = await newCtx({ width: 1440 });
  await open(page);
  const r = await page.evaluate((titles) => {
    const text = document.body.innerText;
    return {
      ...{ lock: !document.getElementById("lock").hidden, dashboard: document.getElementById("dashboard").hidden, editor: document.getElementById("editor").hidden, activity: document.getElementById("activity").hidden },
      signinEnabled: !document.getElementById("signin-btn").disabled,
      titlesLeaked: titles.filter((t) => text.includes(t)),
      bg: getComputedStyle(document.body).backgroundColor,
      dataTheme: document.documentElement.getAttribute("data-theme"),
      themeColor: document.querySelector('meta[name="theme-color"]').content,
      csp: window.__csp,
    };
  }, REAL_POSTS.map((p) => p.data.title));
  record("A lock", "admin", 1440, "light", r.lock && r.dashboard && r.editor && r.activity && r.signinEnabled && r.titlesLeaked.length === 0 && r.csp.length === 0 && ctx.meta.errors.length === 0, r);
  record("A lightDefault (OS dark)", "admin", 1440, "osdark-nochoice", r.dataTheme === null && r.bg === "rgb(250, 246, 239)" && r.themeColor === LIGHT_BG, { dataTheme: r.dataTheme, bg: r.bg, themeColor: r.themeColor });
  await closeCtx(ctx, page, "lock");
}

async function prepaintDark() {
  // 1) Full load with stored theme=dark under the admin CSP: the hashed pre-paint ran.
  const a = await newCtx({ width: 1440, theme: "dark" });
  await open(a.page);
  const r1 = await a.page.evaluate(() => ({
    dataTheme: document.documentElement.dataset.theme,
    themeColor: document.querySelector('meta[name="theme-color"]').content,
    bg: getComputedStyle(document.body).backgroundColor,
    csp: window.__csp,
  }));
  record("B prepaint-dark (full load)", "admin", 1440, "dark", r1.dataTheme === "dark" && r1.themeColor === DARK_BG && r1.bg === "rgb(21, 19, 15)" && r1.csp.length === 0, r1);
  await closeCtx(a.ctx, a.page, "prepaint-dark");
  // 2) main.js and admin.js aborted: the inline pre-paint alone must have set both.
  const b = await newCtx({ width: 1440, theme: "dark" });
  await b.ctx.route("**/main.js", (r) => r.abort());
  await b.ctx.route("**/admin.js", (r) => r.abort());
  await b.page.goto(ADMIN, { waitUntil: "load" });
  const r2 = await b.page.evaluate(() => ({
    dataTheme: document.documentElement.dataset.theme,
    themeColor: document.querySelector('meta[name="theme-color"]').content,
    signinStillDisabled: document.getElementById("signin-btn").disabled,
    csp: window.__csp,
  }));
  record("B prepaint-dark (scripts aborted)", "admin", 1440, "dark", r2.dataTheme === "dark" && r2.themeColor === DARK_BG && r2.signinStillDisabled && r2.csp.length === 0, r2);
  await b.ctx.close();
}

async function signInFlows() {
  const { ctx, page, fake } = await newCtx({ width: 1440 });
  await open(page);
  const errText = () => page.waitForFunction(() => { const e = document.getElementById("signin-error"); return !e.hidden && e.textContent.trim() ? e.textContent.trim() : null; }, null, { timeout: 5000 });
  const stored = () => page.evaluate((k) => ({ session: sessionStorage.getItem(k), local: localStorage.getItem(k) }), TOKEN_KEY);

  // C: three failure messages; the token never reaches the URL.
  for (const [token, expect, key] of [[TOKEN_BAD, "टोकन गलत", "401"], [TOKEN_READONLY, "अधिकार नइखे", "push:false"], [TOKEN_RATE, "rate limit", "403 rate-limit"]]) {
    await signIn(page, token);
    const text = await errText().then((h) => h.jsonValue());
    const s = await stored();
    const href = page.url();
    record(`C signin ${key}`, "admin", 1440, "light", text.includes(expect) && !href.includes(token) && s.session === null && s.local === null, { text, href, stored: s });
    await page.evaluate(() => { const e = document.getElementById("signin-error"); e.textContent = ""; e.hidden = true; });
  }

  // D: OK token, remember unchecked -> sessionStorage only.
  await signIn(page, TOKEN_OK, false);
  await waitDashboard(page);
  let s = await stored();
  let v = await visibleView(page);
  record("D signin ok session", "admin", 1440, "light", s.session === TOKEN_OK && s.local === null && v.dashboard && !v.lock && (await page.inputValue("#token")) === "", { stored: { session: s.session ? "(set)" : null, local: s.local ? "(set)" : null }, view: v });
  await page.click("#signout");
  await page.waitForTimeout(300);
  s = await stored();
  v = await visibleView(page);
  record("D signout clears", "admin", 1440, "light", s.session === null && s.local === null && v.lock && !v.dashboard, { stored: s, view: v });
  // remember checked -> localStorage only.
  await signIn(page, TOKEN_OK, true);
  await waitDashboard(page);
  s = await stored();
  record("D signin ok remember", "admin", 1440, "light", s.local === TOKEN_OK && s.session === null, { session: s.session ? "(set)" : null, local: s.local ? "(set)" : null });
  await page.click("#signout");
  await page.waitForTimeout(300);
  s = await stored();
  v = await visibleView(page);
  record("D signout clears (remember)", "admin", 1440, "light", s.session === null && s.local === null && v.lock, { stored: s, view: v });

  // E: hygiene after the whole flow.
  const outer = await page.evaluate(() => document.documentElement.outerHTML);
  const act = await activity(page);
  const leaks = {
    dom: FAKE_TOKENS.filter((t) => outer.includes(t)),
    activity: FAKE_TOKENS.filter((t) => act.some((l) => l.includes(t))),
    console: ctx.meta.console.filter((l) => FAKE_TOKENS.some((t) => l.includes(t))),
    url: FAKE_TOKENS.filter((t) => page.url().includes(t)),
  };
  record("E tokenHygiene", "admin", 1440, "light", Object.values(leaks).every((a) => a.length === 0), { ...leaks, activityLines: act.length, consoleLines: ctx.meta.console.length, requests: fake.requests });
  await closeCtx(ctx, page, "signin");
}

async function dashboard() {
  const { ctx, page, fake } = await newCtx({ width: 1440, token: TOKEN_OK });
  await open(page);
  await waitDashboard(page);
  const rows = await page.$$eval("#post-list > li", (lis) =>
    lis.map((li) => ({
      text: li.textContent,
      title: li.querySelector("strong") && li.querySelector("strong").textContent,
      titleEn: li.querySelector('span[lang="en"]') && li.querySelector('span[lang="en"]').textContent,
      state: li.querySelector(".state") && li.querySelector(".state").textContent,
      edit: li.querySelector('a[href^="#/edit/"]') && li.querySelector('a[href^="#/edit/"]').getAttribute("href"),
      view: li.querySelector('a[href^="http"]') && { href: li.querySelector('a[href^="http"]').href, rel: li.querySelector('a[href^="http"]').getAttribute("rel") },
      del: !!li.querySelector("button.danger"),
    })),
  );
  const expected = [...REAL_POSTS].reverse();
  const rowOk = rows.length === expected.length && rows.every((r, i) => {
    const p = expected[i];
    return r.title === p.data.title && r.titleEn === p.data.title_en && r.text.includes(categoryName(p.data.category)) && r.text.includes(p.data.date) && r.state === "प्रकाशित" && r.edit === `#/edit/${encodeURIComponent(p.name)}` && r.view && r.view.href === `${config.siteUrl}/posts/${p.slug}/` && r.view.rel === "noopener" && r.del;
  });
  const head = await page.evaluate(() => ({ count: document.getElementById("dash-count").textContent, deploy: document.getElementById("deploy-status").textContent, deployLink: (document.querySelector("#deploy-status a") || {}).href || null, activityVisible: !document.getElementById("activity").hidden }));
  record("F dashboard rows", "admin", 1440, "light", rowOk, { rows: rows.length, sample: rows[0], expectedFirst: expected[0] && { title: expected[0].data.title, slug: expected[0].slug } });
  record("F dashboard head", "admin", 1440, "light", head.count === `${REAL_POSTS.length} बतकही · 0 ड्राफ्ट` && head.deploy.trim().length > 0 && /आखिरी deploy/.test(head.deploy) && head.activityVisible, head);

  // G: typed-confirmation delete of the 6th (newest) post.
  const target = REAL_POSTS[REAL_POSTS.length - 1];
  const targetPath = `content/posts/${target.name}`;
  const originalSha = fake.files.get(targetPath).sha;
  await page.click(`#post-list li:has(a[href="#/edit/${target.name}"]) button.danger`);
  await page.waitForFunction(() => document.getElementById("confirm-delete").open, null, { timeout: 3000 });
  const g0 = await page.evaluate(() => ({ open: document.getElementById("confirm-delete").open, disabled: document.getElementById("del-go").disabled, text: document.getElementById("del-text").textContent }));
  await page.fill("#confirm-slug", "wrong");
  await page.waitForTimeout(100);
  const g1 = { disabled: await page.evaluate(() => document.getElementById("del-go").disabled), deletes: fake.deletes.length };
  await page.fill("#confirm-slug", target.slug);
  await page.waitForTimeout(100);
  const g2 = { disabled: await page.evaluate(() => document.getElementById("del-go").disabled) };
  await page.click("#del-go");
  await page.waitForFunction((n) => document.getElementById("post-list").getAttribute("aria-busy") === "false" && document.getElementById("post-list").children.length === n && !document.getElementById("post-list").classList.contains("skeleton"), REAL_POSTS.length - 1, { timeout: 10000 });
  const g3 = {
    rows: await page.$$eval("#post-list > li", (l) => l.length),
    fileGone: !fake.files.has(targetPath),
    deletes: fake.deletes.map((d) => ({ path: d.path, sha: d.sha === originalSha ? "(original sha)" : d.sha, message: d.message, status: d.status })),
    count: await page.textContent("#dash-count"),
    dialogOpen: await page.evaluate(() => document.getElementById("confirm-delete").open),
  };
  const gOk = g0.open && g0.disabled && g0.text.includes(target.slug) && g1.disabled && g1.deletes === 0 && !g2.disabled && g3.rows === REAL_POSTS.length - 1 && g3.fileGone && fake.deletes.length === 1 && fake.deletes[0].sha === originalSha && fake.deletes[0].path === targetPath && fake.deletes[0].message === `post: delete ${target.data.title_en}` && fake.deletes[0].status === 200 && g3.count === `${REAL_POSTS.length - 1} बतकही · 0 ड्राफ्ट` && !g3.dialogOpen;
  record("G delete", "admin", 1440, "light", gOk, { g0, g1, g2, g3 });
  await closeCtx(ctx, page, "dashboard");
}

async function editorLayout() {
  console.log("H editor layout: 5 widths x 2 themes");
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const { ctx, page } = await newCtx({ width, height: width < 600 ? 844 : 900, theme, token: TOKEN_OK });
      await open(page, "#/new");
      await waitEditor(page);
      await page.fill("#f-title", "शीर्षक");
      await addTags(page, ["ChatGPT"]);
      await page.fill("#f-body", FIXTURE_BODY);
      await page.waitForTimeout(500);
      const r = await page.evaluate(layoutEval);
      record("H overflow", "editor", width, theme, r.scrollWidth <= r.clientWidth && r.editorScroll <= r.editorClient, { scrollWidth: r.scrollWidth, clientWidth: r.clientWidth, editorScroll: r.editorScroll, editorClient: r.editorClient });
      record("H fontFloor", "editor", width, theme, r.small.length === 0, r.small.length ? r.small : "no text < 12px");
      record("H controls", "editor", width, theme, r.shortControls.length === 0, r.shortControls.length ? r.shortControls : "all visible a/button/input/select/textarea >= 40px");
      record("H labels", "editor", width, theme, r.unlabelled.length === 0, r.unlabelled.length ? r.unlabelled : "every input/select/textarea labelled");
      const borders = r.fieldBorders.map((f) => ({ ...f, ratio: Math.round(contrast(f.border, f.bg) * 100) / 100 }));
      const lowBorders = borders.filter((f) => f.ratio < 3);
      record("H fieldBorderContrast >= 3:1", "editor", width, theme, borders.length > 0 && lowBorders.length === 0, lowBorders.length ? lowBorders : { fields: borders.length, min: Math.min(...borders.map((f) => f.ratio)), sample: borders[0] });
      await closeCtx(ctx, page, "editor");
    }
  }
}

async function editorBehaviour() {
  const { ctx, page, fake } = await newCtx({ width: 1440, token: TOKEN_OK });
  await open(page, "#/new");
  await waitEditor(page);

  // I: slug from title_en; duplicate slug rejected.
  await page.fill("#f-title-en", NEW_POST.title_en);
  const slugAuto = await page.inputValue("#f-slug");
  await page.fill("#f-slug", REAL_POSTS[1].slug);
  await page.click("#publish");
  await page.waitForSelector("#errors li", { timeout: 5000 });
  const dupErrors = await page.$$eval("#errors li", (l) => l.map((x) => x.textContent));
  const slugFieldError = await page.evaluate(() => ({ hidden: document.getElementById("f-slug-error").hidden, text: document.getElementById("f-slug-error").textContent }));
  record("I slug", "editor", 1440, "light", slugAuto === NEW_POST.slug && dupErrors.includes("ई slug पहिले से बा") && !slugFieldError.hidden && slugFieldError.text === "ई slug पहिले से बा" && !(await page.evaluate(() => document.getElementById("publish-dialog").open)), { slugAuto, dupErrors, slugFieldError });

  // J: empty publish lists every required field and focuses the list.
  await page.fill("#f-title-en", "");
  await page.fill("#f-slug", "");
  await page.click("#publish");
  await page.waitForTimeout(500);
  const j = await page.evaluate(() => ({
    hrefs: [...document.querySelectorAll("#errors li a")].map((a) => a.getAttribute("href")),
    messages: [...document.querySelectorAll("#errors li")].map((li) => li.textContent),
    active: document.activeElement && document.activeElement.id,
    dialogOpen: document.getElementById("publish-dialog").open,
  }));
  const needed = ["#f-title", "#f-title-en", "#f-slug", "#f-tags", "#f-summary", "#f-summary-en", "#f-body"];
  record("J validation", "editor", 1440, "light", needed.every((h) => j.hrefs.includes(h)) && j.active === "errors" && !j.dialogOpen, j);

  // K: preview parity with renderMarkdown, stylesheet, theme mirroring, word count.
  await page.fill("#f-title", NEW_POST.title);
  await page.fill("#f-title-en", NEW_POST.title_en);
  await page.fill("#f-body", FIXTURE_BODY);
  await page.waitForFunction(() => { const d = document.getElementById("preview").contentDocument; return d && d.querySelectorAll("h2").length >= 3 && d.querySelector("h1") && d.querySelector("h1").textContent !== "शीर्षक"; }, null, { timeout: 5000 });
  const k = await page.evaluate(() => {
    const d = document.getElementById("preview").contentDocument;
    return {
      ids: [...d.querySelectorAll("h2")].map((h) => h.id),
      h1: d.querySelector("h1").textContent,
      stylesheet: [...d.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute("href")),
      bodyClass: d.body.className,
      lang: d.documentElement.lang,
      dataTheme: d.documentElement.getAttribute("data-theme"),
      link: d.querySelector(".prose a") && { href: d.querySelector(".prose a").href, rel: d.querySelector(".prose a").getAttribute("rel") },
      inEnglish: !!d.querySelector('section.in-english[lang="en"]'),
      wordCount: document.getElementById("word-count").textContent,
    };
  });
  const expectedIds = expectedPreviewIds(FIXTURE_BODY);
  const expectedWords = countWords(FIXTURE_BODY);
  record("K preview ids == renderMarkdown", "editor", 1440, "light", JSON.stringify(k.ids) === JSON.stringify(expectedIds) && k.h1 === NEW_POST.title && k.inEnglish, { ids: k.ids, expectedIds, h1: k.h1, inEnglish: k.inEnglish });
  record("K preview document", "editor", 1440, "light", k.stylesheet.includes(config.basePath + "styles.css") && k.bodyClass === "page-post" && k.lang === "bho" && k.dataTheme === null && k.link && k.link.rel === "noopener", { stylesheet: k.stylesheet, bodyClass: k.bodyClass, lang: k.lang, dataTheme: k.dataTheme, link: k.link });
  record("K wordCount == countWords", "editor", 1440, "light", k.wordCount === `${expectedWords} शब्द`, { shown: k.wordCount, expected: `${expectedWords} शब्द` });
  await page.click(".theme-toggle");
  await page.waitForFunction(() => { const d = document.getElementById("preview").contentDocument; return d && d.documentElement.getAttribute("data-theme") === "dark"; }, null, { timeout: 5000 }).catch(() => {});
  const kDark = await page.evaluate(() => ({ page: document.documentElement.getAttribute("data-theme"), iframe: document.getElementById("preview").contentDocument.documentElement.getAttribute("data-theme"), iframeBg: getComputedStyle(document.getElementById("preview").contentDocument.body).backgroundColor }));
  await page.click(".theme-toggle");
  await page.waitForFunction(() => { const d = document.getElementById("preview").contentDocument; return d && d.documentElement.getAttribute("data-theme") === null; }, null, { timeout: 5000 }).catch(() => {});
  const kLight = await page.evaluate(() => ({ page: document.documentElement.getAttribute("data-theme"), iframe: document.getElementById("preview").contentDocument.documentElement.getAttribute("data-theme") }));
  record("K preview follows theme", "editor", 1440, "light", kDark.page === "dark" && kDark.iframe === "dark" && kDark.iframeBg === "rgb(21, 19, 15)" && kLight.page === null && kLight.iframe === null, { dark: kDark, light: kLight });

  // L: autosave within 3.5 s, restore after reload.
  await page.fill("#f-slug", NEW_POST.slug);
  await page.waitForFunction(() => /सहेजल · \d\d:\d\d/.test(document.getElementById("save-state").textContent), null, { timeout: 3500 }).catch(() => {});
  const saveState = await page.textContent("#save-state");
  const savedKey = await page.evaluate(() => !!localStorage.getItem("batkahi.admin.draft.new"));
  await page.reload({ waitUntil: "load" });
  await settle(page);
  await waitEditor(page);
  const restoreVisible = await page.evaluate(() => ({ hash: location.hash, restore: !document.getElementById("restore").hidden, bodyBefore: document.getElementById("f-body").value.length }));
  await page.click("#restore-yes");
  await page.waitForTimeout(500);
  const restored = await page.evaluate(() => ({ body: document.getElementById("f-body").value, title: document.getElementById("f-title").value, titleEn: document.getElementById("f-title-en").value, slug: document.getElementById("f-slug").value, restoreHidden: document.getElementById("restore").hidden }));
  record("L autosave + restore", "editor", 1440, "light", /सहेजल/.test(saveState) && savedKey && restoreVisible.hash === "#/new" && restoreVisible.restore && restoreVisible.bodyBefore === 0 && restored.body === FIXTURE_BODY && restored.title === NEW_POST.title && restored.titleEn === NEW_POST.title_en && restored.slug === NEW_POST.slug && restored.restoreHidden, { saveState, savedKey, restoreVisible, restored: { ...restored, body: restored.body.length + " chars" } });

  // M: image pick -> resize -> PUT -> markdown inserted -> blob preview.
  const blank = await browser.newPage({ viewport: { width: 2000, height: 1200 } });
  await blank.setContent("<!doctype html><html><body></body></html>");
  const png = await blank.screenshot({ fullPage: false });
  await blank.close();
  const pngDims = imageSize(png);
  await page.evaluate(() => { const t = document.getElementById("f-body"); t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
  await page.setInputFiles("#f-image", { name: "photo test.png", mimeType: "image/png", buffer: png });
  await page.waitForFunction(() => document.getElementById("image-dialog").open, null, { timeout: 10000 });
  const imgInfo = await page.textContent("#image-info");
  await page.fill("#image-alt", "परीक्षण");
  await page.click('#image-dialog button[value="ok"]');
  await page.waitForFunction(() => /!\[परीक्षण\]\(\/images\//.test(document.getElementById("f-body").value), null, { timeout: 10000 });
  await page.waitForTimeout(700);
  const imgPath = fake.images[0];
  const imgPut = fake.puts.find((p) => p.path === imgPath);
  const imgCommit = fake.commits.find((c) => c.path === imgPath);
  const imgFile = imgPath && fake.files.get(imgPath);
  let decodedSize = null;
  try { decodedSize = imgFile && imageSize(imgFile.content); } catch (e) { decodedSize = { error: String(e.message) }; }
  const m = await page.evaluate(() => {
    const d = document.getElementById("preview").contentDocument;
    const img = d && d.querySelector("img");
    return { body: document.getElementById("f-body").value, previewImgSrc: img ? img.src : null, dialogOpen: document.getElementById("image-dialog").open };
  });
  const nameRe = /^content\/images\/dry-run-post\/(\d{8})-photo-test\.(webp|jpg)$/;
  const nm = imgPath && imgPath.match(nameRe);
  const ext = nm ? nm[2] : null;
  const mdRe = /!\[परीक्षण\]\(\/images\/dry-run-post\/\d{8}-photo-test\.(webp|jpg)\)/;
  // The line lands where the caret was (the end), not at offset 0 (Chromium
  // resets the caret when the alt dialog closes; the upload remembers it).
  const mInserted = (m.body.match(mdRe) || [null])[0];
  const mAtCaret = !!mInserted && m.body.trimEnd().endsWith(mInserted) && m.body.startsWith(FIXTURE_BODY);
  const mOk = pngDims.width === 2000 && pngDims.height === 1200 && /^1600×960, \d+ KB/.test(imgInfo) && !!nm && imgPut && imgPut.status === 201 && imgCommit && imgCommit.message.startsWith("image: ") && imgCommit.message.includes("[skip ci]") && imgCommit.message === `image: ${imgPath.split("/").pop()} for dry-run-post [skip ci]` && decodedSize && decodedSize.width === 1600 && decodedSize.height === 960 && mAtCaret && m.previewImgSrc && m.previewImgSrc.startsWith("blob:") && !m.dialogOpen && fake.runs.length === 0;
  record("M image", "editor", 1440, "light", mOk, { sourcePng: pngDims, imgInfo, imgPath, ext, bytes: imgFile && imgFile.content.length, decodedSize, message: imgCommit && imgCommit.message, inserted: mInserted, atCaret: mAtCaret, previewImgSrc: m.previewImgSrc && m.previewImgSrc.slice(0, 5), runsCreated: fake.runs.length });

  // M2: two files dropped at once are uploaded one after the other (one alt
  // dialog each, in order) -> two PUTs under content/images/<slug>/ and two
  // Markdown lines in the same order (pass 5: only the last file was uploaded).
  const imagesBefore = fake.images.length;
  const putsBeforeDrop = fake.puts.length;
  const activityBefore = (await activity(page)).filter((l) => l.includes("छवि अपलोड")).length;
  await page.evaluate(() => { const t = document.getElementById("f-body"); t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
  const dropData = await page.evaluateHandle((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "pehla.png", { type: "image/png" }));
    dt.items.add(new File([bytes], "dusra.png", { type: "image/png" }));
    return dt;
  }, PNG_1x1.toString("base64"));
  await page.dispatchEvent("#f-body", "drop", { dataTransfer: dropData });
  await page.waitForFunction(() => document.getElementById("image-dialog").open, null, { timeout: 10000 });
  const drop1Info = await page.textContent("#image-info");
  await page.fill("#image-alt", "पहिला");
  await page.click('#image-dialog button[value="ok"]');
  await page.waitForFunction(() => /!\[पहिला\]\(\/images\//.test(document.getElementById("f-body").value), null, { timeout: 10000 });
  // The second file's dialog opens only after the first upload has finished.
  await page.waitForFunction(() => document.getElementById("image-dialog").open, null, { timeout: 10000 });
  const drop2Info = await page.textContent("#image-info");
  await page.fill("#image-alt", "दूसरा");
  await page.click('#image-dialog button[value="ok"]');
  await page.waitForFunction(() => /!\[दूसरा\]\(\/images\//.test(document.getElementById("f-body").value), null, { timeout: 10000 });
  await page.waitForTimeout(500);
  const dropped = fake.images.slice(imagesBefore);
  const dropPuts = fake.puts.slice(putsBeforeDrop);
  const m2 = await page.evaluate(() => ({ body: document.getElementById("f-body").value, dialogOpen: document.getElementById("image-dialog").open }));
  const firstMd = m2.body.match(/!\[पहिला\]\((\/images\/dry-run-post\/\d{8}-pehla\.(webp|jpg))\)/);
  const secondMd = m2.body.match(/!\[दूसरा\]\((\/images\/dry-run-post\/\d{8}-dusra\.(webp|jpg))\)/);
  const uploads = (await activity(page)).filter((l) => l.includes("छवि अपलोड")).length - activityBefore;
  // Both lines sit at the end of the body (the caret was there when the drop
  // happened), first then second — not at offset 0, where Chromium puts the
  // caret when a modal dialog hands focus back to the textarea.
  const inOrderAtEnd = !!firstMd && !!secondMd && m2.body.indexOf(firstMd[0]) < m2.body.indexOf(secondMd[0]) && m2.body.indexOf(firstMd[0]) > m2.body.indexOf("## In English") && m2.body.trimEnd().endsWith(secondMd[0]);
  const m2Ok = dropped.length === 2 && /^content\/images\/dry-run-post\/\d{8}-pehla\.(webp|jpg)$/.test(dropped[0]) && /^content\/images\/dry-run-post\/\d{8}-dusra\.(webp|jpg)$/.test(dropped[1]) && dropPuts.length === 2 && dropPuts.every((p) => p.status === 201 && p.message.includes("[skip ci]")) && `content${firstMd[1]}` === dropped[0] && `content${secondMd[1]}` === dropped[1] && inOrderAtEnd && /^1×1, \d+ KB/.test(drop1Info) && /^1×1, \d+ KB/.test(drop2Info) && !m2.dialogOpen && uploads === 2 && fake.runs.length === 0;
  record("M2 multi-file drop: sequential uploads in order", "editor", 1440, "light", m2Ok, { dropped, puts: dropPuts.map((p) => ({ path: p.path, status: p.status })), inserted: [firstMd && firstMd[0], secondMd && secondMd[0]], inOrderAtEnd, bodyTail: m2.body.slice(-140), dialogInfos: [drop1Info, drop2Info], activityLines: uploads, runsCreated: fake.runs.length });

  // M3: an image is never committed under an invalid slug (pass 5: `My Slug`
  // produced PUT content/images/My Slug/…); the slug is checked before the resize.
  const putsBeforeBad = fake.puts.length;
  await page.fill("#f-slug", "My Slug");
  await page.setInputFiles("#f-image", { name: "bad.png", mimeType: "image/png", buffer: PNG_1x1 });
  await page.waitForTimeout(800);
  const m3 = await page.evaluate(() => ({
    slugError: { hidden: document.getElementById("f-slug-error").hidden, text: document.getElementById("f-slug-error").textContent },
    listed: [...document.querySelectorAll("#errors li")].map((li) => li.textContent),
    dialogOpen: document.getElementById("image-dialog").open,
    focused: document.activeElement && document.activeElement.id,
  }));
  record("M3 image upload rejects an invalid slug", "editor", 1440, "light", !m3.slugError.hidden && m3.slugError.text === "slug में सिर्फ a-z, 0-9 आ -" && m3.listed.includes("slug में सिर्फ a-z, 0-9 आ -") && !m3.dialogOpen && fake.puts.length === putsBeforeBad && m3.focused === "f-slug", { ...m3, newPuts: fake.puts.length - putsBeforeBad });
  await page.fill("#f-slug", NEW_POST.slug);

  // L2: autosave + restore for an EXISTING post (#/edit/<file>) across a reload,
  // and the dashboard -> edit path; the banner must not depend on fetch timing.
  const edited = REAL_POSTS[1]; // 02-llm-kaise-bolela.md
  const editKey = `batkahi.admin.draft.${edited.name}`;
  await page.evaluate(() => localStorage.removeItem("batkahi.admin.draft.new"));
  await go(page, "#/");
  await waitDashboard(page);
  await go(page, `#/edit/${edited.name}`);
  await page.waitForFunction(() => !document.getElementById("editor").hidden && document.getElementById("f-slug").value !== "", null, { timeout: 10000 });
  await page.waitForTimeout(300);
  const noBannerClean = await page.evaluate(() => document.getElementById("restore").hidden);
  const editedBody = edited.body.trim() + "\n\nनया पैराग्राफ जे सिर्फ local में बा।";
  await page.fill("#f-body", editedBody);
  await page.waitForFunction(() => /सहेजल · \d\d:\d\d/.test(document.getElementById("save-state").textContent), null, { timeout: 3500 }).catch(() => {});
  const l2Saved = await page.evaluate((k) => { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw).body.length : null; }, editKey);
  await page.reload({ waitUntil: "load" });
  await settle(page);
  await page.waitForFunction(() => !document.getElementById("editor").hidden && document.getElementById("f-slug").value !== "", null, { timeout: 10000 });
  await page.waitForTimeout(300);
  const l2Reload = await page.evaluate(() => ({ hash: location.hash, restore: !document.getElementById("restore").hidden, bodyIsRemote: document.getElementById("f-body").value.trim().length }));
  await page.click("#restore-yes");
  await page.waitForTimeout(300);
  const l2Restored = await page.evaluate(() => ({ body: document.getElementById("f-body").value, restoreHidden: document.getElementById("restore").hidden }));
  // Dashboard -> edit (the listing is re-fetched on the way) must show it as well.
  // Reached by a full load (beforeunload saves the restored edits): the in-page
  // `वापस` would run the unsaved-changes guard, whose "छोड़ दीं" drops the copy (row V).
  await open(page, "");
  await waitDashboard(page);
  const l2KeptAcrossLoad = await page.evaluate((k) => localStorage.getItem(k) !== null, editKey);
  await go(page, `#/edit/${edited.name}`);
  await page.waitForFunction(() => !document.getElementById("editor").hidden && document.getElementById("f-slug").value !== "", null, { timeout: 10000 });
  await page.waitForTimeout(300);
  const l2ViaDash = await page.evaluate(() => !document.getElementById("restore").hidden);
  await page.click("#restore-no");
  const l2Discarded = await page.evaluate((k) => ({ key: localStorage.getItem(k), hidden: document.getElementById("restore").hidden }), editKey);
  record("L autosave + restore (#/edit)", "editor", 1440, "light", noBannerClean && l2Saved === editedBody.length && l2Reload.hash === `#/edit/${edited.name}` && l2Reload.restore && l2Reload.bodyIsRemote === edited.body.trim().length && l2Restored.body === editedBody && l2Restored.restoreHidden && l2KeptAcrossLoad && l2ViaDash && l2Discarded.key === null && l2Discarded.hidden, { noBannerClean, savedChars: l2Saved, reload: l2Reload, restored: l2Restored.body === editedBody, keptAcrossLoad: l2KeptAcrossLoad, viaDashboard: l2ViaDash, discarded: l2Discarded });
  await closeCtx(ctx, page, "editor-behaviour");
}

async function dialogs() {
  // T: link dialog accepts a root-relative URL and can be cancelled with any value.
  const a = await newCtx({ width: 1440, token: TOKEN_OK });
  await open(a.page, "#/new");
  await waitEditor(a.page);
  await a.page.fill("#f-body", "देखीं ");
  await a.page.evaluate(() => { const t = document.getElementById("f-body"); t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
  await a.page.click('.toolbar [data-md="link"]');
  await a.page.waitForFunction(() => document.getElementById("link-dialog").open, null, { timeout: 3000 });
  await a.page.fill("#link-url", "/posts/llm-kaise-bolela/");
  await a.page.fill("#link-text", "x");
  await a.page.click('#link-dialog button[value="ok"]');
  await a.page.waitForTimeout(300);
  const t1 = await a.page.evaluate(() => ({ open: document.getElementById("link-dialog").open, body: document.getElementById("f-body").value }));
  await a.page.click('.toolbar [data-md="link"]');
  await a.page.waitForFunction(() => document.getElementById("link-dialog").open, null, { timeout: 3000 });
  await a.page.fill("#link-url", "not a url");
  await a.page.click('#link-dialog button[value="cancel"]');
  await a.page.waitForTimeout(300);
  const t2 = await a.page.evaluate(() => ({ open: document.getElementById("link-dialog").open, body: document.getElementById("f-body").value }));
  record("T link dialog root-relative + cancel", "editor", 1440, "light", !t1.open && t1.body === "देखीं [x](/posts/llm-kaise-bolela/)" && !t2.open && t2.body === t1.body, { afterInsert: t1, afterCancel: t2 });
  await closeCtx(a.ctx, a.page, "link-dialog");

  // U: Enter in the delete confirmation deletes once the slug matches, never before.
  const b = await newCtx({ width: 1440, token: TOKEN_OK });
  await open(b.page);
  await waitDashboard(b.page);
  const target = REAL_POSTS[REAL_POSTS.length - 1];
  const targetPath = `content/posts/${target.name}`;
  const originalSha = b.fake.files.get(targetPath).sha;
  await b.page.click(`#post-list li:has(a[href="#/edit/${target.name}"]) button.danger`);
  await b.page.waitForFunction(() => document.getElementById("confirm-delete").open, null, { timeout: 3000 });
  await b.page.fill("#confirm-slug", "wrong");
  await b.page.press("#confirm-slug", "Enter");
  await b.page.waitForTimeout(300);
  const u1 = { open: await b.page.evaluate(() => document.getElementById("confirm-delete").open), deletes: b.fake.deletes.length };
  await b.page.fill("#confirm-slug", target.slug);
  await b.page.press("#confirm-slug", "Enter");
  await b.page.waitForFunction((n) => !document.getElementById("confirm-delete").open && document.getElementById("post-list").getAttribute("aria-busy") === "false" && document.getElementById("post-list").children.length === n && !document.getElementById("post-list").classList.contains("skeleton"), REAL_POSTS.length - 1, { timeout: 10000 }).catch(() => {});
  const u2 = { open: await b.page.evaluate(() => document.getElementById("confirm-delete").open), returnValue: await b.page.evaluate(() => document.getElementById("confirm-delete").returnValue), deletes: b.fake.deletes.map((d) => ({ path: d.path, sha: d.sha === originalSha ? "(original sha)" : d.sha, status: d.status })), fileGone: !b.fake.files.has(targetPath), rows: await b.page.$$eval("#post-list > li", (l) => l.length) };
  // Cancel button closes without deleting.
  await b.page.click(`#post-list li button.danger`);
  await b.page.waitForFunction(() => document.getElementById("confirm-delete").open, null, { timeout: 3000 });
  await b.page.click("#del-cancel");
  await b.page.waitForTimeout(200);
  const u3 = { open: await b.page.evaluate(() => document.getElementById("confirm-delete").open), deletes: b.fake.deletes.length };
  record("U delete via Enter", "admin", 1440, "light", u1.open && u1.deletes === 0 && !u2.open && u2.returnValue === "ok" && u2.deletes.length === 1 && u2.deletes[0].path === targetPath && u2.deletes[0].sha === "(original sha)" && u2.deletes[0].status === 200 && u2.fileGone && u2.rows === REAL_POSTS.length - 1 && !u3.open && u3.deletes === 1, { wrongSlugEnter: u1, rightSlugEnter: u2, cancel: u3 });
  await closeCtx(b.ctx, b.page, "delete-dialog");

  // V: dismissing the unsaved-changes confirm ("stay") keeps every field, the
  // tags and the editor hash, on #/new and on #/edit/<file>.
  const snapshot = (page) => page.evaluate(() => ({
    hash: location.hash,
    editor: !document.getElementById("editor").hidden,
    fields: Object.fromEntries(["f-title", "f-title-en", "f-slug", "f-date", "f-summary", "f-summary-en", "f-instagram", "f-category", "f-body"].map((id) => [id, document.getElementById(id).value])),
    tags: [...document.querySelectorAll("#tag-list li span")].map((s) => s.textContent),
    draft: document.getElementById("f-draft").checked,
  }));
  const c = await newCtx({ width: 1440, token: TOKEN_OK });
  await open(c.page, "#/new");
  await waitEditor(c.page);
  await fillPost(c.page, NEW_POST);
  const vNewBefore = await snapshot(c.page);
  c.ctx.meta.dialog = "dismiss";
  await c.page.click("#back");
  await c.page.waitForTimeout(600);
  const vNewAfter = await snapshot(c.page);
  const vNewSaved = await c.page.evaluate(() => { const raw = localStorage.getItem("batkahi.admin.draft.new"); return raw ? JSON.parse(raw).data.title : null; });
  // Accepting afterwards must still leave (the guard did not get stuck) AND
  // discard the autosave: reopening #/new offers no restore banner.
  c.ctx.meta.dialog = "accept";
  await c.page.click("#back");
  await waitDashboard(c.page);
  const vNewLeft = await c.page.evaluate(() => ({ hash: location.hash, dashboard: !document.getElementById("dashboard").hidden, draftKey: localStorage.getItem("batkahi.admin.draft.new") }));
  await go(c.page, "#/new");
  await waitEditor(c.page);
  const vNewReopen = await c.page.evaluate(() => ({ restoreHidden: document.getElementById("restore").hidden, title: document.getElementById("f-title").value }));
  const newKept = JSON.stringify(vNewBefore) === JSON.stringify(vNewAfter) && vNewBefore.hash === "#/new" && vNewAfter.editor && vNewBefore.fields["f-title"] === NEW_POST.title && vNewBefore.tags.length === NEW_POST.tags.length;
  // #/edit/<file>: change a field, then stay.
  const editedPost = REAL_POSTS[1];
  await go(c.page, `#/edit/${editedPost.name}`);
  await c.page.waitForFunction(() => !document.getElementById("editor").hidden && document.getElementById("f-slug").value !== "", null, { timeout: 10000 });
  await c.page.waitForTimeout(300);
  const editedSummary = editedPost.data.summary + " (रुकल)";
  await c.page.fill("#f-summary", editedSummary);
  await addTags(c.page, ["नया-टैग"]);
  const vEditBefore = await snapshot(c.page);
  c.ctx.meta.dialog = "dismiss";
  await c.page.click("#back");
  await c.page.waitForTimeout(600);
  const vEditAfter = await snapshot(c.page);
  c.ctx.meta.dialog = "accept";
  const editKept = JSON.stringify(vEditBefore) === JSON.stringify(vEditAfter) && vEditBefore.hash === `#/edit/${editedPost.name}` && vEditAfter.editor && vEditAfter.fields["f-summary"] === editedSummary && vEditAfter.tags.includes("नया-टैग");
  // Accept on #/edit: the autosave of that file is gone and reopening it shows the
  // committed summary with no restore banner.
  await c.page.click("#back");
  await waitDashboard(c.page);
  const vEditLeft = await c.page.evaluate((name) => ({ hash: location.hash, draftKey: localStorage.getItem(`batkahi.admin.draft.${name}`) }), editedPost.name);
  await go(c.page, `#/edit/${editedPost.name}`);
  await c.page.waitForFunction(() => !document.getElementById("editor").hidden && document.getElementById("f-slug").value !== "", null, { timeout: 10000 });
  await c.page.waitForTimeout(300);
  const vEditReopen = await c.page.evaluate(() => ({ restoreHidden: document.getElementById("restore").hidden, summary: document.getElementById("f-summary").value }));
  const newDiscarded = vNewLeft.draftKey === null && vNewReopen.restoreHidden && vNewReopen.title === "";
  const editDiscarded = vEditLeft.hash === "#/" && vEditLeft.draftKey === null && vEditReopen.restoreHidden && vEditReopen.summary === editedPost.data.summary;
  record("V unsaved guard: stay keeps edits, discard drops the autosave", "editor", 1440, "light", newKept && vNewSaved === NEW_POST.title && vNewLeft.hash === "#/" && vNewLeft.dashboard && newDiscarded && editKept && editDiscarded, { new: { before: { ...vNewBefore, fields: Object.keys(vNewBefore.fields).length + " fields" }, unchanged: JSON.stringify(vNewBefore) === JSON.stringify(vNewAfter), autosavedTitle: vNewSaved, thenLeft: vNewLeft, reopened: vNewReopen }, edit: { hash: vEditAfter.hash, unchanged: JSON.stringify(vEditBefore) === JSON.stringify(vEditAfter), summary: vEditAfter.fields["f-summary"] === editedSummary, tags: vEditAfter.tags, thenLeft: vEditLeft, reopened: vEditReopen } });
  await closeCtx(c.ctx, c.page, "unsaved-guard");
}

// Bodies the dist tests reject must be rejected in the UI before the commit
// (pass 5: a `## -> ####` jump and a relative link both committed and then
// failed CI). Also: images known from the repository listing, links to drafts,
// the sign-out autosave flush and external images in the preview.
async function validatorParity() {
  const errorsShown = (page) => page.evaluate(() => ({
    listed: [...document.querySelectorAll("#errors li")].map((li) => li.textContent),
    bodyError: { hidden: document.getElementById("f-body-error").hidden, text: document.getElementById("f-body-error").textContent },
    dialogOpen: document.getElementById("publish-dialog").open,
  }));
  // Click publish and wait for either the error list or a new commit. The list
  // is emptied first: publish() awaits the listing before it re-renders it.
  const tryPublish = async (page, fake, body) => {
    await page.fill("#f-body", body);
    await page.evaluate(() => document.getElementById("errors").replaceChildren());
    const commitsBefore = fake.commits.length;
    await page.click("#publish");
    const t0 = Date.now();
    while (Date.now() - t0 < 10000) {
      if (fake.commits.length > commitsBefore) break;
      if (await page.evaluate(() => document.querySelectorAll("#errors li").length > 0)) break;
      await sleep(100);
    }
    await page.waitForTimeout(200);
    return { ...(await errorsShown(page)), committed: fake.commits.length - commitsBefore };
  };
  const PARITY_POST = { ...NEW_POST, title: "समता के जाँच", title_en: "Parity post", slug: "parity-post", category: "samajh" };
  const BHO2 = BHO.repeat(2);
  const EN2 = `${EN25} ${EN25}`;
  const withMiddle = (middle) => `परिचय।\n\n## पहिला खंड\n\n${BHO2}\n\n${middle}\n\n## दूसरा खंड\n\n${BHO2}\n\n## In English\n\n${EN2}`;

  // W: a new post — depth jump, relative link, unknown slug, missing image,
  // category without posts, raw HTML: each rejected with its Bhojpuri message
  // and no commit; then a body with links the site resolves is committed.
  const a = await newCtx({ width: 1440, token: TOKEN_OK });
  await a.ctx.route("https://example.com/**", (route) => route.fulfill({ status: 200, headers: { "Content-Type": "image/png" }, body: PNG_1x1 }));
  await open(a.page, "#/new");
  await waitEditor(a.page);
  await fillPost(a.page, PARITY_POST);
  await a.page.evaluate(() => { const t = document.getElementById("f-body"); t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
  await a.page.setInputFiles("#f-image", { name: "pic.png", mimeType: "image/png", buffer: PNG_1x1 });
  await a.page.waitForFunction(() => document.getElementById("image-dialog").open, null, { timeout: 10000 });
  await a.page.fill("#image-alt", "चित्र");
  await a.page.click('#image-dialog button[value="ok"]');
  await a.page.waitForFunction(() => /!\[चित्र\]\(\/images\/parity-post\//.test(document.getElementById("f-body").value), null, { timeout: 10000 });
  const uploadedMd = (await a.page.inputValue("#f-body")).match(/!\[चित्र\]\(\/images\/parity-post\/[^)]+\)/)[0];
  const cases = [
    ["## -> ####", withMiddle("#### चार"), "## के बाद #### नइखे चलेला — ### लगाईं"],
    ["#### under In English", `${withMiddle("")}\n\n#### Four\n\n${EN2}`, "## के बाद #### नइखे चलेला — ### लगाईं"],
    ["relative link", withMiddle("[x](about/)"), "लिंक / से शुरू करीं (जइसे /posts/<slug>/) या पूरा https:// URL दीं: about/"],
    ["unknown slug", withMiddle("[x](/posts/typo/)"), "ई लिंक साइट पर नइखे मिलत: /posts/typo/ — मौजूद बतकही के /posts/<slug>/, विषय के /category/<slug>/ या पूरा https:// URL दीं"],
    ["missing image", withMiddle("![x](/images/parity-post/missing.webp)"), "ई छवि साइट पर नइखे मिलत: /images/parity-post/missing.webp — छवि बटन से अपलोड करीं"],
    ["category without posts", withMiddle("[x](/category/khabar/)"), "ई लिंक साइट पर नइखे मिलत: /category/khabar/ — मौजूद बतकही के /posts/<slug>/, विषय के /category/<slug>/ या पूरा https:// URL दीं"],
    ["raw HTML", withMiddle('<a href="about/">x</a>'), "HTML टैग <a> मत लिखीं — ओकर Markdown रूप बरतीं"],
  ];
  const wResults = [];
  for (const [label, body, message] of cases) {
    const r = await tryPublish(a.page, a.fake, body);
    wResults.push({ label, ok: r.listed.includes(message) && !r.bodyError.hidden && r.bodyError.text === message && !r.dialogOpen && r.committed === 0, listed: r.listed, committed: r.committed });
  }
  record("W validator parity: CI-failing bodies rejected before the commit", "editor", 1440, "light", wResults.every((r) => r.ok), wResults);
  // W2: links the site resolves (an existing post with and without fragment, a
  // fixed page, this post's own slug, the category this post makes active, the
  // image uploaded above, an external link, ## -> ### -> ####) are committed.
  await a.page.selectOption("#f-category", "khabar");
  const good = withMiddle(`[a](/posts/${REAL_POSTS[1].slug}/) [b](/posts/${REAL_POSTS[1].slug}/#x) [c](/about/) [d](/posts/parity-post/) [e](/category/khabar/) [f](https://example.com/x)\n\n### तीन\n\n#### चार\n\n${uploadedMd}`);
  const w2 = await tryPublish(a.page, a.fake, good);
  const w2Commit = a.fake.commits[a.fake.commits.length - 1];
  const w2Parsed = w2.committed === 1 && w2Commit.decoded ? parse(w2Commit.decoded) : null;
  record("W2 validator parity: resolvable links are committed", "editor", 1440, "light", w2.committed === 1 && w2.listed.length === 0 && w2.dialogOpen && w2Commit.path === "content/posts/07-parity-post.md" && w2Commit.message === "post: Parity post" && !!w2Parsed && w2Parsed.body.trim() === good.trim() && w2Parsed.data.category === "khabar", { committed: w2.committed, listed: w2.listed, path: w2Commit && w2Commit.path, message: w2Commit && w2Commit.message, bodyUnchanged: !!w2Parsed && w2Parsed.body.trim() === good.trim() });
  await a.page.click("#pub-close");
  // X: an external image renders in the preview (CSP img-src https:), like on the site.
  await a.page.fill("#f-body", `${withMiddle("![बाहरी](https://example.com/a.png)")}`);
  await a.page.waitForFunction(() => { const d = document.getElementById("preview").contentDocument; const img = d && d.querySelector('img[src="https://example.com/a.png"]'); return img && img.complete; }, null, { timeout: 5000 }).catch(() => {});
  const x = await a.page.evaluate(() => {
    const d = document.getElementById("preview").contentDocument;
    const img = d && d.querySelector('img[src="https://example.com/a.png"]');
    return { found: !!img, complete: img ? img.complete : null, naturalWidth: img ? img.naturalWidth : null, cspImg: (window.__csp || []).filter((v) => v.startsWith("img-src")) };
  });
  record("X preview shows external https images", "editor", 1440, "light", x.found && x.complete && x.naturalWidth === 1 && x.cspImg.length === 0, x);
  await closeCtx(a.ctx, a.page, "validator-parity");

  // Y: an existing post — an image already in the repository (listed via the
  // Contents API, not uploaded this session) is accepted, one that is not is
  // rejected, and a link to a draft (no page) is rejected.
  const b = await newCtx({ width: 1440, token: TOKEN_OK });
  const target = REAL_POSTS[1]; // 02-llm-kaise-bolela.md
  b.fake.files.set(`content/images/${target.slug}/purana.webp`, { content: PNG_1x1, sha: sha1(PNG_1x1) });
  const draftText = `---\ndraft: true\ntitle: ड्राफ्ट\ntitle_en: Draft x\ndate: 2026-10-09\ncategory: samajh\ntags: [x]\nsummary: s\nsummary_en: s\n---\n\nबाद में।\n`;
  b.fake.files.set("content/posts/09-draft-x.md", { content: Buffer.from(draftText, "utf8"), sha: sha1(Buffer.from(draftText, "utf8")) });
  await open(b.page, `#/edit/${target.name}`);
  await b.page.waitForFunction(() => !document.getElementById("editor").hidden && document.getElementById("f-slug").value !== "", null, { timeout: 10000 });
  await b.page.waitForTimeout(300);
  const base = target.body.trim();
  const yMissing = await tryPublish(b.page, b.fake, `${base}\n\n![x](/images/${target.slug}/nahi.webp)\n`);
  const yDraft = await tryPublish(b.page, b.fake, `${base}\n\n[x](/posts/draft-x/)\n`);
  // The image goes into the Bhojpuri part (before In English), like an author would place it.
  const yGoodBody = base.replace(/\n## In English/, `\n![पुरान](/images/${target.slug}/purana.webp)\n\n## In English`);
  const yGood = await tryPublish(b.page, b.fake, yGoodBody);
  const yCommit = b.fake.commits[b.fake.commits.length - 1];
  const yPut = b.fake.puts[b.fake.puts.length - 1];
  const yOk = yMissing.committed === 0 && yMissing.listed.includes(`ई छवि साइट पर नइखे मिलत: /images/${target.slug}/nahi.webp — छवि बटन से अपलोड करीं`) && yDraft.committed === 0 && yDraft.listed.some((l) => l.startsWith("ई लिंक साइट पर नइखे मिलत: /posts/draft-x/")) && yGood.committed === 1 && yGood.listed.length === 0 && yCommit.path === `content/posts/${target.name}` && yPut.status === 200 && parse(yCommit.decoded).body.trim() === yGoodBody.trim();
  record("Y validator parity: repository images and draft links", "editor", 1440, "light", yOk, { missing: { committed: yMissing.committed, listed: yMissing.listed }, draft: { committed: yDraft.committed, listed: yDraft.listed }, good: { committed: yGood.committed, listed: yGood.listed, path: yCommit && yCommit.path, status: yPut && yPut.status } });
  await b.page.click("#pub-close");
  await closeCtx(b.ctx, b.page, "validator-parity-edit");

  // Z: signing out within 3 s of an edit keeps it (autosave flushed) and the
  // next session offers it back. #signout sits in the dashboard header, which
  // is hidden while the editor is open, so the button is invoked from script.
  const c = await newCtx({ width: 1440, token: TOKEN_OK });
  await open(c.page, "#/new");
  await waitEditor(c.page);
  await c.page.fill("#f-title", "अधूरा शीर्षक");
  await c.page.evaluate(() => document.getElementById("signout").click());
  await c.page.waitForFunction(() => !document.getElementById("lock").hidden, null, { timeout: 3000 });
  const zSaved = await c.page.evaluate(() => { const raw = localStorage.getItem("batkahi.admin.draft.new"); return raw ? JSON.parse(raw).data.title : null; });
  const zStores = await c.page.evaluate((k) => ({ session: sessionStorage.getItem(k), local: localStorage.getItem(k) }), TOKEN_KEY);
  await signIn(c.page, TOKEN_OK);
  await waitDashboard(c.page);
  await go(c.page, "#/new");
  await waitEditor(c.page);
  const zBanner = await c.page.evaluate(() => !document.getElementById("restore").hidden);
  await c.page.click("#restore-yes");
  await c.page.waitForTimeout(300);
  const zTitle = await c.page.inputValue("#f-title");
  record("Z sign-out flushes the autosave", "editor", 1440, "light", zSaved === "अधूरा शीर्षक" && zStores.session === null && zStores.local === null && zBanner && zTitle === "अधूरा शीर्षक", { savedTitle: zSaved, tokenCleared: zStores, bannerAfterSignIn: zBanner, restoredTitle: zTitle });
  await closeCtx(c.ctx, c.page, "signout-flush");
}

async function publishFlows() {
  // Polling runs every 10 s; with Playwright's clock we fast-forward instead of waiting.
  const { ctx, page, fake } = await newCtx({ width: 1440, token: TOKEN_OK, clock: true });
  const hasClock = typeof page.clock.runFor === "function";
  const advance = async () => { if (hasClock) await page.clock.runFor(POLL_MS + 500); else await sleep(POLL_MS + 500); };
  await open(page, "#/new");
  await waitEditor(page);
  const dateValue = await page.inputValue("#f-date");

  // N: publish a new post, follow the run to success.
  await fillPost(page, NEW_POST);
  await clickPublish(page, fake);
  const n1 = { step1: await stepState(page, 0), pubFile: await page.textContent("#pub-file"), commit: fake.commits[fake.commits.length - 1] };
  const nParsed = n1.commit && n1.commit.decoded ? parse(n1.commit.decoded) : null;
  const nData = nParsed && nParsed.data;
  const dataOk = nData && nData.title === NEW_POST.title && nData.title_en === NEW_POST.title_en && nData.date === dateValue && nData.category === NEW_POST.category && JSON.stringify(nData.tags) === JSON.stringify(NEW_POST.tags) && nData.summary === NEW_POST.summary && nData.summary_en === NEW_POST.summary_en && !("draft" in nData) && nParsed.body.trim() === FIXTURE_BODY.trim();
  record("N publish commit", "publish", 1440, "light", n1.commit && n1.commit.path === "content/posts/07-dry-run-post.md" && n1.commit.message === `post: ${NEW_POST.title_en}` && n1.pubFile === "content/posts/07-dry-run-post.md" && dataOk && fake.puts[fake.puts.length - 1].sha === undefined, { pubFile: n1.pubFile, path: n1.commit && n1.commit.path, message: n1.commit && n1.commit.message, data: nData, step1: n1.step1, putSha: fake.puts[fake.puts.length - 1].sha });
  const seq = [];
  await page.waitForFunction(() => document.querySelectorAll("#pub-steps li")[1].querySelector(".step-status").textContent === "कतार में", null, { timeout: 5000 }).catch(() => {});
  seq.push(await stepState(page, 1));
  await advance();
  await page.waitForFunction(() => document.querySelectorAll("#pub-steps li")[1].querySelector(".step-status").textContent === "चलत बा", null, { timeout: 5000 }).catch(() => {});
  seq.push(await stepState(page, 1));
  await advance();
  await waitStep(page, 2, "done", 5000).catch(() => {});
  seq.push(await stepState(page, 1));
  const nEnd = await page.evaluate(() => ({
    step3: { state: document.querySelectorAll("#pub-steps li")[2].dataset.state, status: document.querySelectorAll("#pub-steps li")[2].querySelector(".step-status").textContent },
    result: document.getElementById("pub-result").textContent,
    live: { hidden: document.getElementById("live-link").hidden, href: document.getElementById("live-link").href },
    run: { hidden: document.getElementById("run-link").hidden, href: document.getElementById("run-link").href },
    copyVisible: !document.getElementById("copy-live").hidden,
    slugLocked: document.getElementById("f-slug").readOnly,
    autosaveCleared: !localStorage.getItem("batkahi.admin.draft.new"),
  }));
  const act = await activity(page);
  const nOk = seq[0].status === "कतार में" && seq[0].state === "running" && seq[1].status === "चलत बा" && seq[2].state === "done" && seq[2].status === "सफल" && nEnd.step3.state === "done" && nEnd.result === "लाइव बा" && !nEnd.live.hidden && nEnd.live.href === `${config.siteUrl}/posts/${NEW_POST.slug}/` && !nEnd.run.hidden && nEnd.run.href === fake.runs[0].html_url && nEnd.copyVisible && nEnd.slugLocked && nEnd.autosaveCleared && ["deploy: कतार में", "deploy: चलत बा", "deploy: सफल"].every((s) => act.some((l) => l.includes(s)));
  record("N publish poll -> live", "publish", 1440, "light", nOk, { seq, ...nEnd, clock: hasClock ? "page.clock.runFor" : "real time", activity: act.slice(0, 6) });
  await page.click("#pub-close");

  // O: failure path.
  await go(page, "#/");
  await waitDashboard(page);
  await go(page, "#/new");
  await waitEditor(page);
  await fillPost(page, { ...NEW_POST, title: "ड्राई-रन दू", title_en: "Dry run post two", slug: "dry-run-post-two" });
  fake.failNext = true;
  await clickPublish(page, fake);
  const oCommit = fake.commits[fake.commits.length - 1];
  await advance();
  await advance();
  await waitStep(page, 1, "failed", 5000).catch(() => {});
  const o = await page.evaluate(() => ({
    step2: { state: document.querySelectorAll("#pub-steps li")[1].dataset.state, status: document.querySelectorAll("#pub-steps li")[1].querySelector(".step-status").textContent },
    step3: document.querySelectorAll("#pub-steps li")[2].dataset.state,
    result: document.getElementById("pub-result").textContent,
    live: document.getElementById("live-link").hidden,
    run: { hidden: document.getElementById("run-link").hidden, href: document.getElementById("run-link").href },
  }));
  const oRun = fake.runs[fake.runs.length - 1];
  record("O publish failure", "publish", 1440, "light", oCommit.path === "content/posts/08-dry-run-post-two.md" && o.step2.state === "failed" && o.step2.status === "असफल (failure)" && o.step3 === "pending" && o.result === "CI असफल — run देखीं, ठीक क के फेर प्रकाशित करीं" && o.live && !o.run.hidden && o.run.href === oRun.html_url && oRun.conclusion === "failure", { path: oCommit.path, ...o, runUrl: oRun.html_url });
  await page.click("#pub-close");

  // P: the draft checkbox decides what the PRIMARY button commits: ticked +
  // "प्रकाशित करीं" (which then reads "ड्राफ्ट सहेजीं") -> draft: true first,
  // [skip ci], no run; the separate draft button is hidden meanwhile.
  const draftUi = () => page.evaluate(() => ({
    checked: document.getElementById("f-draft").checked,
    primary: document.getElementById("publish").textContent,
    draftBtnHidden: document.getElementById("save-draft").hidden,
  }));
  const dialogState = () => page.evaluate(() => ({
    steps: [...document.querySelectorAll("#pub-steps li")].map((li) => ({ state: li.dataset.state, status: li.querySelector(".step-status").textContent })),
    result: document.getElementById("pub-result").textContent,
    pubFile: document.getElementById("pub-file").textContent,
  }));
  await go(page, "#/");
  await waitDashboard(page);
  await go(page, "#/new");
  await waitEditor(page);
  const runsBefore = fake.runs.length;
  await page.fill("#f-title", "ड्राई-रन ड्राफ्ट");
  await page.fill("#f-title-en", "Dry run draft");
  const pBefore = await draftUi();
  await page.check("#f-draft");
  const pTicked = await draftUi();
  await clickPublish(page, fake, "#publish");
  await page.waitForTimeout(300);
  const pCommit = fake.commits[fake.commits.length - 1];
  const p = await dialogState();
  const pAfter = await draftUi();
  const pUiOk = !pBefore.checked && pBefore.primary === "प्रकाशित करीं" && !pBefore.draftBtnHidden && pTicked.checked && pTicked.primary === "ड्राफ्ट सहेजीं" && pTicked.draftBtnHidden && pAfter.checked && pAfter.primary === "ड्राफ्ट सहेजीं";
  record("P draft: box ticked + primary button", "publish", 1440, "light", pUiOk && pCommit.path === "content/posts/09-dry-run-draft.md" && pCommit.message === "draft: Dry run draft [skip ci]" && pCommit.decoded.startsWith("---\ndraft: true\n") && fake.runs.length === runsBefore && p.steps[1].status === "deploy नइखे (ड्राफ्ट)" && p.steps[2].status === "deploy नइखे (ड्राफ्ट)" && p.result === "ड्राफ्ट सहेजल गइल (साइट पर ना देखाई)", { path: pCommit.path, message: pCommit.message, head: pCommit.decoded.slice(0, 40), runsCreated: fake.runs.length - runsBefore, ui: { before: pBefore, ticked: pTicked, after: pAfter }, ...p });
  await page.click("#pub-close");

  // P2: box unticked + "ड्राफ्ट सहेजीं" button -> draft: true too, and the form
  // then mirrors the committed file (box ticked, primary reads "ड्राफ्ट सहेजीं").
  await go(page, "#/");
  await waitDashboard(page);
  await go(page, "#/new");
  await waitEditor(page);
  await page.fill("#f-title", "ड्राई-रन ड्राफ्ट दू");
  await page.fill("#f-title-en", "Dry run draft two");
  const p2Before = await draftUi();
  await clickPublish(page, fake, "#save-draft");
  await page.waitForTimeout(300);
  const p2Commit = fake.commits[fake.commits.length - 1];
  const p2 = await dialogState();
  const p2After = await draftUi();
  record("P2 draft: button with box unticked", "publish", 1440, "light", !p2Before.checked && p2Before.primary === "प्रकाशित करीं" && !p2Before.draftBtnHidden && p2Commit.path === "content/posts/10-dry-run-draft-two.md" && p2Commit.message === "draft: Dry run draft two [skip ci]" && p2Commit.decoded.startsWith("---\ndraft: true\n") && fake.runs.length === runsBefore && p2After.checked && p2After.primary === "ड्राफ्ट सहेजीं" && p2After.draftBtnHidden && p2.result === "ड्राफ्ट सहेजल गइल (साइट पर ना देखाई)", { path: p2Commit.path, message: p2Commit.message, head: p2Commit.decoded.slice(0, 40), runsCreated: fake.runs.length - runsBefore, ui: { before: p2Before, after: p2After }, result: p2.result });
  await page.click("#pub-close");

  // P3: publish an opened draft: the box arrives ticked from the file; unticking
  // it + the primary button commits WITHOUT a draft key (PUT with the draft's sha,
  // `post:` message, a run starts) and the box stays cleared afterwards.
  const draftPath = "content/posts/09-dry-run-draft.md";
  const draftShaBefore = fake.files.get(draftPath).sha;
  await go(page, "#/");
  await waitDashboard(page);
  await go(page, "#/edit/09-dry-run-draft.md");
  await page.waitForFunction(() => !document.getElementById("editor").hidden && document.getElementById("f-slug").value === "dry-run-draft", null, { timeout: 10000 });
  await page.waitForTimeout(500);
  const p3Opened = await draftUi();
  await fillPost(page, { ...NEW_POST, title: "ड्राई-रन ड्राफ्ट", title_en: "Dry run draft" });
  await page.uncheck("#f-draft");
  const p3Unticked = await draftUi();
  const p3RunsBefore = fake.runs.length;
  await clickPublish(page, fake, "#publish");
  const p3Put = fake.puts[fake.puts.length - 1];
  const p3Commit = fake.commits[fake.commits.length - 1];
  const p3Parsed = parse(p3Commit.decoded);
  const p3After = await draftUi();
  record("P3 publish an opened draft", "publish", 1440, "light", p3Opened.checked && p3Opened.primary === "ड्राफ्ट सहेजीं" && p3Opened.draftBtnHidden && !p3Unticked.checked && p3Unticked.primary === "प्रकाशित करीं" && !p3Unticked.draftBtnHidden && p3Put.path === draftPath && p3Put.sha === draftShaBefore && p3Put.status === 200 && p3Commit.message === "post: Dry run draft" && !("draft" in p3Parsed.data) && p3Parsed.data.title_en === "Dry run draft" && fake.runs.length === p3RunsBefore + 1 && !p3After.checked && p3After.primary === "प्रकाशित करीं" && !p3After.draftBtnHidden, { put: { path: p3Put.path, shaMatchesDraft: p3Put.sha === draftShaBefore, status: p3Put.status }, message: p3Commit.message, keys: Object.keys(p3Parsed.data), runsCreated: fake.runs.length - p3RunsBefore, ui: { opened: p3Opened, unticked: p3Unticked, after: p3After } });
  await page.click("#pub-close");

  // Q: update an existing post -> PUT with the previous sha, body unchanged.
  const target = REAL_POSTS[1]; // 02-llm-kaise-bolela.md
  const targetPath = `content/posts/${target.name}`;
  const shaBefore = fake.files.get(targetPath).sha;
  await go(page, "#/");
  await waitDashboard(page);
  await go(page, `#/edit/${target.name}`);
  await page.waitForFunction(() => !document.getElementById("editor").hidden && document.getElementById("f-slug").value !== "", null, { timeout: 10000 });
  await page.waitForTimeout(500);
  const q0 = await page.evaluate(() => ({
    heading: document.getElementById("editor-heading").textContent,
    slug: document.getElementById("f-slug").value,
    readOnly: document.getElementById("f-slug").readOnly,
    title: document.getElementById("f-title").value,
    titleEn: document.getElementById("f-title-en").value,
    date: document.getElementById("f-date").value,
    category: document.getElementById("f-category").value,
    tags: [...document.querySelectorAll("#tag-list li span")].map((s) => s.textContent),
    summary: document.getElementById("f-summary").value,
    summaryEn: document.getElementById("f-summary-en").value,
    body: document.getElementById("f-body").value,
  }));
  const populated = q0.slug === target.slug && q0.readOnly && q0.heading === `संपादन: ${target.data.title}` && q0.title === target.data.title && q0.titleEn === target.data.title_en && q0.date === target.data.date && q0.category === target.data.category && JSON.stringify(q0.tags) === JSON.stringify(target.data.tags) && q0.summary === target.data.summary && q0.summaryEn === target.data.summary_en && q0.body.trim() === target.body.trim();
  const newSummary = target.data.summary + " (सुधार)";
  await page.fill("#f-summary", newSummary);
  await clickPublish(page, fake);
  const qPut = fake.puts[fake.puts.length - 1];
  const qCommit = fake.commits[fake.commits.length - 1];
  const qParsed = parse(qCommit.decoded);
  const sameExceptSummary = Object.keys(target.data).every((k) => k === "summary" || JSON.stringify(qParsed.data[k]) === JSON.stringify(target.data[k])) && (qParsed.data.instagram || "") === (target.data.instagram || "");
  record("Q update", "publish", 1440, "light", populated && qPut.path === targetPath && qPut.sha === shaBefore && qPut.status === 200 && qCommit.message === `post: ${target.data.title_en}` && qParsed.data.summary === newSummary && sameExceptSummary && qParsed.body.trim() === target.body.trim() && !("draft" in qParsed.data), { populated, q0: { ...q0, body: q0.body.length + " chars" }, put: { path: qPut.path, shaMatchesPrevious: qPut.sha === shaBefore, status: qPut.status }, message: qCommit.message, summary: qParsed.data.summary, bodyUnchanged: qParsed.body.trim() === target.body.trim() });
  await page.click("#pub-close");

  // R: stale sha -> 409 -> confirm OK -> fresh sha -> second PUT succeeds.
  const mutated = Buffer.from(target.text + "\n<!-- changed elsewhere -->\n", "utf8");
  fake.files.set(targetPath, { content: mutated, sha: sha1(mutated) });
  const putsBefore = fake.puts.length;
  await page.fill("#f-summary", newSummary + " 2");
  await clickPublish(page, fake);
  const rPuts = fake.puts.slice(putsBefore).filter((x) => x.path === targetPath);
  const rState = await stepState(page, 0);
  record("R stale sha 409 -> retry", "publish", 1440, "light", rPuts.length === 2 && rPuts[0].status === 409 && rPuts[0].sha !== sha1(mutated) && rPuts[1].status === 200 && rPuts[1].sha === sha1(mutated) && rState.state === "done" && fake.files.get(targetPath).sha !== sha1(mutated), { puts: rPuts.map((x) => ({ status: x.status, sha: x.sha === sha1(mutated) ? "(fresh sha)" : "(stale sha)" })), step1: rState });
  await page.click("#pub-close");
  await closeCtx(ctx, page, "publish");
}

async function screenshots() {
  console.log("S screenshots: lock/dashboard/editor x 2 viewports x 2 themes");
  for (const theme of THEMES) {
    for (const [width, height] of [[390, 844], [1440, 900]]) {
      const a = await newCtx({ width, height, theme });
      await open(a.page);
      await shot(a.page, "lock", width, height, theme);
      await closeCtx(a.ctx, a.page, "shot-lock");
      const b = await newCtx({ width, height, theme, token: TOKEN_OK });
      await open(b.page);
      await waitDashboard(b.page);
      await shot(b.page, "dashboard", width, height, theme);
      await go(b.page, "#/new");
      await waitEditor(b.page);
      await fillPost(b.page, NEW_POST);
      if (width < 1024) await b.page.click("#preview-toggle");
      await b.page.evaluate(() => scrollTo(0, 0));
      await b.page.waitForTimeout(500);
      await shot(b.page, "editor", width, height, theme);
      await closeCtx(b.ctx, b.page, "shot-editor");
    }
  }
}

/* ---------- main ---------- */
const server = await startServer();
BASE = server.origin + config.basePath;
ADMIN = BASE + "admin/";
console.log("Auditing " + ADMIN + " (GitHub mocked; real publish path UNTESTED)");
browser = await chromium.launch({ headless: true });
const STEPS = { lock, prepaintDark, signInFlows, dashboard, editorLayout, editorBehaviour, dialogs, validatorParity, publishFlows, screenshots };
const only = process.argv.slice(2);
try {
  for (const [name, fn] of Object.entries(STEPS)) {
    if (only.length && !only.includes(name)) continue;
    const t0 = Date.now();
    let timer;
    await Promise.race([
      fn(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timed out after 300 s")), 300000); }),
    ])
      .catch((err) => record("ERROR " + name, "-", 0, "-", false, String((err && err.stack) || err)))
      .finally(() => clearTimeout(timer));
    console.log(`  ${name} done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
} finally {
  await browser.close();
  if (server.child) server.child.kill();
}

writeFileSync(join(OUT, "audit-admin-results.json"), JSON.stringify({ base: ADMIN, date: new Date().toISOString(), note: "GitHub fully mocked; the real publish path is UNTESTED (no token exists).", results }, null, 2));

const summary = new Map();
for (const r of results) {
  const s = summary.get(r.check) || { check: r.check, rows: 0, failed: 0 };
  s.rows++;
  if (!r.ok) s.failed++;
  summary.set(r.check, s);
}
console.log("\ncheck".padEnd(36) + "rows".padStart(6) + "failed".padStart(8));
for (const s of summary.values()) console.log(s.check.padEnd(35) + String(s.rows).padStart(6) + String(s.failed).padStart(8));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length} rows, ${failed} failed -> ${join(OUT, "audit-admin-results.json")}`);
process.exit(failed ? 1 : 0);

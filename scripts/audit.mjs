// Real-browser audit of dist/ (design.md Part 8 matrix + the browser-verifiable
// "Prove by" lines of design-review.md). Playwright for Node is NOT a dependency:
// it is loaded from PW_PATH (a playwright package directory).
//
// Usage:  npm run audit            (serves dist/ itself on a free port >= 8081)
//         AUDIT_URL=http://127.0.0.1:8082 npm run audit   (use a running server)
// Output: .agents/tasks/ui-v2/audit-results.json and viewport-only screenshots in
//         .agents/tasks/ui-v2/shots-phase1/. Exit code 1 when any row is not ok.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { get } from "node:http";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import config from "../site.config.js";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || "playwright");

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = join(ROOT, ".agents", "tasks", "ui-v2");
const SHOTS = join(OUT, "shots-phase1");
mkdirSync(SHOTS, { recursive: true });

const PAGES = [
  { key: "home", path: "" },
  { key: "posts", path: "posts/" },
  { key: "category", path: "category/samajh/" },
  { key: "post", path: "posts/llm-kaise-bolela/" },
  { key: "about", path: "about/" },
  { key: "404", path: "404.html" },
];
const byKey = (k) => PAGES.find((p) => p.key === k);
const WIDTHS = [320, 360, 390, 820, 1024, 1440, 1920, 2560];
const THEMES = ["light", "dark"];
const SHOT_VIEWPORTS = [
  [390, 844],
  [820, 1180],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
];
const LIGHT_BG = "#FAF6EF";
const DARK_BG = "#15130F";

const results = [];
function record(check, page, width, theme, ok, detail) {
  results.push({ check, page, width, theme, ok: !!ok, detail });
  if (!ok) console.log(`  FAIL ${check} ${page} ${width} ${theme}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
}

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

/* ---------- helpers ---------- */
let browser;
let BASE;
const pageErrors = [];

async function newCtx({
  width,
  height = 900,
  theme = "light",
  reducedMotion = "no-preference",
  colorScheme = "light",
  js = true,
  blockFonts = false,
  userAgent,
  shortcutsOff = false,
} = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme,
    reducedMotion,
    javaScriptEnabled: js,
    userAgent,
  });
  // Dark = the stored explicit choice; the OS preference is never followed.
  if (theme === "dark") await ctx.addInitScript(() => { try { localStorage.setItem("theme", "dark"); } catch (e) {} });
  if (shortcutsOff) await ctx.addInitScript(() => { try { localStorage.setItem("shortcuts", "off"); } catch (e) {} });
  if (blockFonts) await ctx.route("**/*.woff2", (r) => r.abort());
  ctx.on("page", (page) => {
    page.on("pageerror", (err) => pageErrors.push({ url: page.url(), message: String(err && err.message || err) }));
  });
  return ctx;
}
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
}
async function open(page, pagePath) {
  await page.goto(BASE + pagePath, { waitUntil: "load" });
  await settle(page);
}
function pngSize(file) {
  const b = readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG: " + file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
const within = (v, target, tol) => Math.abs(v - target) <= tol;

/* ---------- in-page evaluators (serialised by Playwright) ---------- */
// A overflow, B fontFloor, C body/h1 sizes, D controls, E contrast.
function matrixEval(grainAlpha) {
  const de = document.documentElement;
  const out = {};
  out.scrollWidth = de.scrollWidth;
  out.clientWidth = de.clientWidth;
  out.bodyFs = parseFloat(getComputedStyle(document.body).fontSize);
  const h1 = document.querySelector("h1");
  out.h1Fs = h1 ? parseFloat(getComputedStyle(h1).fontSize) : null;

  const visible = (el) => {
    if (!el || el.closest("[hidden]")) return false;
    if (!el.getClientRects().length) return false;
    return getComputedStyle(el).visibility !== "hidden";
  };
  const desc = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : "") + (el.id ? "#" + el.id : "");

  // Elements that own text (text nodes with non-blank content).
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textOwners = new Set();
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (el && el.tagName !== "SCRIPT" && el.tagName !== "STYLE" && visible(el)) textOwners.add(el);
  }

  // B: font floor
  out.small = [];
  for (const el of textOwners) {
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) out.small.push({ el: desc(el), fs });
  }

  // D: controls (every visible a/button outside .prose)
  out.shortControls = [];
  for (const el of document.querySelectorAll("a, button")) {
    if (el.closest(".prose") || !visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const bad = r.height < 40 || (el.classList.contains("icon-btn") && r.width < 40);
    if (bad) out.shortControls.push({ el: desc(el), h: Math.round(r.height * 10) / 10, w: Math.round(r.width) });
  }

  // E: contrast with the grain worst case composited over the effective background.
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const effectiveBg = (el, pseudo) => {
    // Composite from <html> down to the element (and its pseudo), then the grain.
    const chain = [];
    for (let e = el; e; e = e.parentElement) chain.unshift(e);
    let bg = { r: 250, g: 246, b: 239, a: 1 };
    let first = true;
    for (const e of chain) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (!c || c.a === 0) continue;
      bg = first ? { ...c, a: 1 } : over(c, bg);
      first = false;
    }
    if (pseudo) {
      const c = parse(getComputedStyle(el, pseudo).backgroundColor);
      if (c && c.a > 0) bg = over(c, bg);
    }
    return over({ r: 128, g: 128, b: 128, a: grainAlpha }, bg);
  };
  const pairs = [];
  const consider = (el, pseudo, label) => {
    const cs = getComputedStyle(el, pseudo || null);
    const fg0 = parse(cs.color);
    if (!fg0) return;
    const bg = effectiveBg(el, pseudo);
    const fg = fg0.a < 1 ? over(fg0, bg) : fg0;
    const fs = parseFloat(cs.fontSize);
    const need = fs >= 24 ? 3 : 4.5;
    const r = ratio(fg, bg);
    pairs.push({ el: label, fs, fg: hex(fg), bg: hex(bg), ratio: Math.round(r * 100) / 100, need, ok: r >= need });
  };
  for (const el of textOwners) consider(el, null, desc(el));
  for (const el of document.body.querySelectorAll("*")) {
    if (!visible(el)) continue;
    for (const pseudo of ["::before", "::after"]) {
      const content = getComputedStyle(el, pseudo).content;
      if (!content || content === "none" || content === "normal" || content === '""' || content === "''") continue;
      consider(el, pseudo, desc(el) + pseudo);
    }
  }
  pairs.sort((a, b) => a.ratio / a.need - b.ratio / b.need);
  out.contrastWorst = pairs[0] || null;
  out.contrastFailures = pairs.filter((p) => !p.ok).slice(0, 8);
  out.contrastCount = pairs.length;
  return out;
}

/* ---------- checks ---------- */
async function matrix() {
  console.log("A-E matrix: 6 pages x 8 widths x 2 themes");
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const ctx = await newCtx({ width, theme });
      const page = await ctx.newPage();
      for (const p of PAGES) {
        const errBefore = pageErrors.length;
        await open(page, p.path);
        const r = await page.evaluate(matrixEval, 14 / 255);
        record("A overflow", p.key, width, theme, r.scrollWidth <= r.clientWidth, `scrollWidth ${r.scrollWidth} clientWidth ${r.clientWidth}`);
        record("B fontFloor", p.key, width, theme, r.small.length === 0, r.small.length ? r.small : "no text < 12px");
        if (width === 390) record("C typeScale", p.key, width, theme, r.bodyFs >= 17 && r.bodyFs <= 18.5, `body ${r.bodyFs}px`);
        if (width === 1440) record("C typeScale", p.key, width, theme, r.bodyFs >= 19 && r.bodyFs <= 21, `body ${r.bodyFs}px`);
        if (width >= 1920) record("C typeScale", p.key, width, theme, Math.round(r.bodyFs) >= 21 && Math.round(r.bodyFs) <= 22, `body ${r.bodyFs}px`);
        if (width === 2560 && p.key === "post") record("C typeScale", p.key, width, theme, r.h1Fs <= 70, `post h1 ${r.h1Fs}px`);
        record("D controls", p.key, width, theme, r.shortControls.length === 0, r.shortControls.length ? r.shortControls : "all visible a/button >= 40px");
        record("E contrast", p.key, width, theme, r.contrastFailures.length === 0, { worst: r.contrastWorst, failures: r.contrastFailures, pairs: r.contrastCount });
        const errs = pageErrors.slice(errBefore);
        record("pageErrors", p.key, width, theme, errs.length === 0, errs.length ? errs : "none");
      }
      await ctx.close();
    }
  }
}

async function focus() {
  const ctx = await newCtx({ width: 1440 });
  const page = await ctx.newPage();
  await open(page, "");
  await page.evaluate(() => document.body.focus());
  const seen = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    seen.push(await page.evaluate(() => {
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return { el: el.tagName.toLowerCase() + "." + el.className, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth };
    }));
  }
  const ok = seen.every((s) => s.outlineStyle !== "none" && s.outlineWidth !== "0px");
  record("F focus", "home", 1440, "light", ok, seen);
  await ctx.close();
}

async function lightDefault() {
  const ctx = await newCtx({ width: 1440, colorScheme: "dark" });
  const page = await ctx.newPage();
  for (const p of PAGES) {
    await open(page, p.path);
    const r = await page.evaluate(() => ({
      dataTheme: document.documentElement.getAttribute("data-theme"),
      bg: getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),
      schemeMeta: document.querySelector('meta[name="color-scheme"]').content,
      themeColors: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content),
      osPrefersDark: matchMedia("(prefers-color-scheme: dark)").matches,
    }));
    const ok = r.dataTheme === null && r.bg === LIGHT_BG && r.schemeMeta === "light" && r.themeColors.length === 1 && r.themeColors[0] === LIGHT_BG && r.osPrefersDark === true;
    record("G lightDefault", p.key, 1440, "osdark-nochoice", ok, r);
  }
  await ctx.close();
}

async function darkPersists() {
  const ctx = await newCtx({ width: 1440, theme: "dark" });
  const page = await ctx.newPage();
  await open(page, "");
  const seq = [];
  seq.push({ at: "home", dataTheme: await page.evaluate(() => document.documentElement.getAttribute("data-theme")) });
  await page.click('.post-item-title a[href$="/posts/llm-kaise-bolela/"]');
  await page.waitForURL(/\/posts\/llm-kaise-bolela\/$/);
  await settle(page);
  seq.push({ at: "post", dataTheme: await page.evaluate(() => document.documentElement.getAttribute("data-theme")) });
  await page.click('.site-nav .nav-link[href$="/about/"]');
  await page.waitForURL(/\/about\/$/);
  await settle(page);
  seq.push({ at: "about", dataTheme: await page.evaluate(() => document.documentElement.getAttribute("data-theme")) });
  record("H darkPersists", "home>post>about", 1440, "dark", seq.every((s) => s.dataTheme === "dark"), seq);
  await ctx.close();

  // Pre-paint: with main.js aborted the inline script alone must have set both.
  const ctx2 = await newCtx({ width: 1440, theme: "dark" });
  await ctx2.route("**/main.js", (r) => r.abort());
  const page2 = await ctx2.newPage();
  await page2.goto(BASE, { waitUntil: "load" });
  const r = await page2.evaluate(() => ({
    themeColor: document.querySelector('meta[name="theme-color"]').content,
    dataTheme: document.documentElement.getAttribute("data-theme"),
    mainJsRan: !!document.querySelector(".theme-toggle") && !document.querySelector(".theme-toggle").disabled,
  }));
  record("H prepaint", "home (main.js aborted)", 1440, "dark", r.themeColor === DARK_BG && r.dataTheme === "dark" && !r.mainJsRan, r);
  await ctx2.close();
}

async function reducedMotion() {
  for (const key of ["home", "post"]) {
    const ctx = await newCtx({ width: 1440, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await open(page, byKey(key).path);
    const probe = () => page.evaluate(() => ({
      animations: document.getAnimations().length,
      word: document.querySelector(".slot-item[data-on] .slot-word") ? document.querySelector(".slot-item[data-on] .slot-word").textContent : null,
      progressDisplay: document.querySelector(".progress") ? getComputedStyle(document.querySelector(".progress")).display : null,
    }));
    const a = await probe();
    await page.waitForTimeout(4000);
    const b = await probe();
    let ok = a.animations === 0 && b.animations === 0;
    if (key === "home") ok = ok && a.word === b.word;
    if (key === "post") ok = ok && b.progressDisplay === "none";
    record("I reducedMotion", key, 1440, "reduce", ok, { after: a, after4s: b });
    await ctx.close();
  }
}

async function noJs() {
  for (const key of ["home", "posts", "post"]) {
    const ctx = await newCtx({ width: 1440, js: false });
    const page = await ctx.newPage();
    await open(page, byKey(key).path);
    // Page timers never fire with scripts disabled, so step the scroll from Node.
    const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (let y = 0; y <= max; y += 600) {
      await page.evaluate((yy) => scrollTo(0, yy), y);
      await page.waitForTimeout(60);
    }
    await page.evaluate((yy) => scrollTo(0, yy), max);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const reveal = [...document.querySelectorAll(".reveal")].map((el) => getComputedStyle(el).opacity);
      const slot = document.querySelector(".slot-item[data-on]");
      const toggle = document.querySelector(".theme-toggle");
      const share = document.querySelector(".share");
      const toc = document.querySelector("details.toc-wrap");
      const search = document.querySelector(".search-btn");
      return {
        reveals: reveal.length,
        revealAllOpaque: reveal.every((o) => o === "1"),
        slotVisible: slot ? getComputedStyle(slot).visibility : "n/a",
        toggleDisabled: toggle ? toggle.disabled : null,
        shareHidden: share ? share.hidden : "n/a",
        tocOpen: toc ? toc.open : "n/a",
        searchIsLink: !!search && search.tagName === "A" && /\/posts\/$/.test(search.getAttribute("href")),
      };
    });
    let ok = r.revealAllOpaque && r.toggleDisabled === true && r.searchIsLink;
    if (key === "home") ok = ok && r.slotVisible === "visible";
    if (key === "post") ok = ok && r.shareHidden === true && r.tocOpen === true;
    record("J noJs", key, 1440, "light", ok, r);
    await ctx.close();
  }
}

async function fontsBlocked() {
  for (const width of [320, 390, 820, 1440]) {
    const ctx = await newCtx({ width, blockFonts: true });
    const page = await ctx.newPage();
    for (const key of ["home", "post"]) {
      await page.goto(BASE + byKey(key).path, { waitUntil: "load" });
      await page.waitForTimeout(800);
      const r = await page.evaluate(() => {
        const de = document.documentElement;
        const h1 = document.querySelector("h1");
        const container = h1.closest(".container") || document.querySelector("main");
        const hr = h1.getBoundingClientRect();
        const cr = container.getBoundingClientRect();
        return {
          scrollWidth: de.scrollWidth,
          clientWidth: de.clientWidth,
          h1Right: hr.right,
          containerRight: cr.right,
          overflowWrap: getComputedStyle(h1).overflowWrap,
          fontsLoaded: [...document.fonts].filter((f) => f.status === "loaded").length,
        };
      });
      const ok = r.scrollWidth <= r.clientWidth && r.h1Right <= r.containerRight + 1 && r.overflowWrap === "anywhere";
      record("K fontsBlocked", key, width, "light", ok, r);
    }
    await ctx.close();
  }
}

async function header() {
  for (const width of [320, 360, 390]) {
    const ctx = await newCtx({ width, height: 844 });
    const page = await ctx.newPage();
    await open(page, "");
    const r = await page.evaluate(() => {
      const header = document.querySelector("header.site-header");
      const masthead = header.querySelector(".masthead").getBoundingClientRect();
      const nav = header.querySelector(".site-nav").getBoundingClientRect();
      const tools = header.querySelector(".tools").getBoundingClientRect();
      const controls = [...header.querySelectorAll("a, button")].map((el) => {
        const b = el.getBoundingClientRect();
        return { el: el.className, w: Math.round(b.width), h: Math.round(b.height) };
      });
      return {
        offsetHeight: header.offsetHeight,
        headerH: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")),
        mastheadTop: masthead.top, mastheadBottom: masthead.bottom,
        toolsTop: tools.top, navTop: nav.top,
        controls,
        twoRows: nav.top >= masthead.bottom - 2 && Math.abs(tools.top - masthead.top) < masthead.height,
      };
    });
    const ok = within(r.offsetHeight, r.headerH, 4) && r.twoRows && r.controls.every((c) => c.w >= 44 && c.h >= 44);
    record("L header", "home", width, "light", ok, r);
    await ctx.close();
  }
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const ctx = await newCtx({ width, height });
    const page = await ctx.newPage();
    await open(page, "");
    const r = await page.evaluate(() => ({
      heroBottom: document.querySelector(".hero").getBoundingClientRect().bottom,
      innerHeight,
      scrollY,
    }));
    record("L hero", "home", width, "light", within(r.heroBottom, r.innerHeight, 4), r);
    await ctx.close();
  }
}

async function fluidContainer() {
  for (const width of [1440, 1920, 2560]) {
    const ctx = await newCtx({ width, height: 900 });
    const page = await ctx.newPage();
    for (const key of ["home", "posts", "post", "about"]) {
      await open(page, byKey(key).path);
      const r = await page.evaluate(() => {
        const main = document.querySelector("main");
        const mainBox = main.classList.contains("container") ? main : main.querySelector(".hero") || main.querySelector(".container");
        const boxes = { headerInner: document.querySelector(".header-inner"), main: mainBox, footerInner: document.querySelector(".footer-inner") };
        const out = {};
        for (const [k, el] of Object.entries(boxes)) {
          const b = el.getBoundingClientRect();
          out[k] = { left: Math.round(b.left), right: Math.round(b.right), width: Math.round(b.width), frac: Math.round((b.width / innerWidth) * 1000) / 1000, rightBand: Math.round(((innerWidth - b.right) / innerWidth) * 1000) / 1000 };
        }
        return out;
      });
      const min = width >= 1920 ? 0.88 : 0.85;
      const ok = Object.values(r).every((b) => b.frac >= min && b.left >= 0 && b.rightBand <= 0.08);
      record("M fluidContainer", key, width, "light", ok, r);
    }
    await ctx.close();
  }
}

async function rail() {
  for (const width of [1600, 1920, 2560]) {
    const ctx = await newCtx({ width, height: 1080 });
    const page = await ctx.newPage();
    await open(page, byKey("post").path);
    const r = await page.evaluate(() => {
      const rail = document.querySelector(".post-rail").getBoundingClientRect();
      const body = document.querySelector(".post-body").getBoundingClientRect();
      const toc = document.querySelector(".toc-wrap");
      const t = toc.getBoundingClientRect();
      const railFirst = document.querySelector(".post-rail").firstElementChild;
      return {
        gap: Math.round((rail.left - body.right) * 10) / 10,
        // Both rails hug the reading column by the same column-gap.
        tocGap: Math.round((body.left - t.right) * 10) / 10,
        railRightFrac: Math.round((rail.right / innerWidth) * 1000) / 1000,
        tocLeftFrac: Math.round((t.left / innerWidth) * 1000) / 1000,
        tocPosition: getComputedStyle(toc).position,
        railPosition: getComputedStyle(document.querySelector(".post-rail")).position,
        railFirst: railFirst.className,
        metaLines: (document.body.innerText.match(/पढ़े में ~\d+ मिनट/g) || []).length,
      };
    });
    const ok = r.gap >= 46 && r.gap <= 66 && Math.abs(r.tocGap - r.gap) <= 2 && r.railRightFrac <= 0.92 && r.tocLeftFrac >= 0.08 &&
      r.tocPosition === "sticky" && r.railFirst === "rail-en" && r.metaLines === 1;
    record("N rail", "post", width, "light", ok, r);
    await ctx.close();
  }
  const ctx = await newCtx({ width: 1280, height: 620 });
  const page = await ctx.newPage();
  await open(page, byKey("post").path);
  const r = await page.evaluate(async () => {
    scrollTo(0, 600); // pin the sticky rail at top: 2rem
    await new Promise((r) => setTimeout(r, 100));
    const toc = document.querySelector(".toc-wrap");
    const links = toc.querySelectorAll(".toc a");
    const last = links[links.length - 1];
    last.scrollIntoView({ block: "nearest" });
    await new Promise((r) => setTimeout(r, 100));
    const w = toc.getBoundingClientRect();
    const l = last.getBoundingClientRect();
    return {
      overflowY: getComputedStyle(toc).overflowY,
      wrapTop: Math.round(w.top), wrapBottom: Math.round(w.bottom), innerHeight,
      scrollHeight: toc.scrollHeight, clientHeight: toc.clientHeight, scrollTop: toc.scrollTop,
      lastTop: Math.round(l.top), lastBottom: Math.round(l.bottom), links: links.length,
    };
  });
  const ok = r.overflowY === "auto" && r.lastTop >= r.wrapTop - 1 && r.lastBottom <= r.wrapBottom + 1 && r.lastBottom <= r.innerHeight + 1;
  record("N tocScrollBox", "post", 1280, "light", ok, r);
  await ctx.close();
}

async function slot() {
  const ctx = await newCtx({ width: 1440 });
  const page = await ctx.newPage();
  await open(page, "");
  const word = () => page.evaluate(() => document.querySelector(".slot-item[data-on] .slot-word").textContent);
  const ariaLabel = await page.evaluate(() => document.querySelector(".slot").ariaLabel);
  const named = await page.getByRole("button", { name: /अटकल/ }).count();
  const w0 = await word();
  await page.waitForTimeout(3800);
  const w1 = await word();
  await page.hover(".slot");
  await page.waitForTimeout(3800);
  const w2 = await word();
  await page.click(".slot");
  const w3 = await word();
  const widths = await page.evaluate(() => {
    const slot = document.querySelector(".slot").getBoundingClientRect().width;
    const widest = Math.max(...[...document.querySelectorAll(".slot-item")].map((i) => i.getBoundingClientRect().width));
    return { slot, widest };
  });
  const r = { ariaLabel, named, w0, w1, w2, w3, advanced: w0 !== w1, heldOnHover: w1 === w2, clickAdvanced: w3 !== w2, ...widths };
  const ok = ariaLabel === null && named === 1 && r.advanced && r.heldOnHover && r.clickAdvanced && widths.slot >= widths.widest;
  record("O slot", "home", 1440, "light", ok, r);

  // Theme toggle: label flips, attribute set/removed, storage follows.
  await page.mouse.move(0, 0);
  const t0 = await page.evaluate(() => ({ label: document.querySelector(".theme-toggle").getAttribute("aria-label"), theme: document.documentElement.getAttribute("data-theme"), stored: localStorage.getItem("theme") }));
  await page.click(".theme-toggle");
  const t1 = await page.evaluate(() => ({ label: document.querySelector(".theme-toggle").getAttribute("aria-label"), theme: document.documentElement.getAttribute("data-theme"), stored: localStorage.getItem("theme"), themeColor: document.querySelector('meta[name="theme-color"]').content }));
  await page.click(".theme-toggle");
  const t2 = await page.evaluate(() => ({ label: document.querySelector(".theme-toggle").getAttribute("aria-label"), theme: document.documentElement.getAttribute("data-theme"), stored: localStorage.getItem("theme") }));
  const tok = t0.label === "अन्हार थीम करीं" && t0.theme === null && t1.label === "अंजोर थीम करीं" && t1.theme === "dark" && t1.stored === "dark" && t1.themeColor === DARK_BG && t2.label === "अन्हार थीम करीं" && t2.theme === null && t2.stored === "light";
  record("O themeToggle", "home", 1440, "light", tok, { t0, t1, t2 });

  const kbdHere = await page.evaluate(() => document.querySelector(".search-btn .kbd").textContent);
  const nameHere = await page.getByRole("link", { name: "खोजीं", exact: true }).count();
  await ctx.close();

  const mac = await newCtx({ width: 1440, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" });
  const mp = await mac.newPage();
  await open(mp, "");
  const kbdMac = await mp.evaluate(() => ({ kbd: document.querySelector(".search-btn .kbd").textContent, platform: (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform }));
  const nameMac = await mp.getByRole("link", { name: "खोजीं", exact: true }).count();
  await mac.close();
  record("O searchKbd", "home", 1440, "light", kbdHere === "Ctrl K" && nameHere === 1 && kbdMac.kbd === "\u2318 K" && nameMac === 1, { kbdHere, nameHere, kbdMac, nameMac });
}

async function palette() {
  const ctx = await newCtx({ width: 1440 });
  const page = await ctx.newPage();
  await open(page, "");
  const isOpen = () => page.evaluate(() => document.querySelector("dialog.palette").open);
  await page.keyboard.press("Control+k");
  const opened = await isOpen();
  await page.waitForSelector(".palette-results li[data-post]", { timeout: 5000 });
  await page.screenshot({ path: join(SHOTS, "palette-1440x900-light.png"), fullPage: false });
  await page.keyboard.press("ArrowDown");
  const active = await page.evaluate(() => {
    const id = document.querySelector("#palette-input").getAttribute("aria-activedescendant");
    const el = id ? document.getElementById(id) : null;
    return { id, role: el && el.getAttribute("role"), tag: el && el.tagName, href: el && el.href, selected: el && el.getAttribute("aria-selected"), status: document.querySelector(".palette-status").textContent };
  });
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => u.href === active.href, { timeout: 5000 }).catch(() => {});
  const afterEnter = page.url();
  const arrowOk = opened && active.role === "option" && active.tag === "A" && afterEnter === active.href;
  record("P palette arrow/enter", "home", 1440, "light", arrowOk, { opened, active, afterEnter });

  await open(page, "");
  await page.keyboard.press("Control+k");
  const reopened = await isOpen();
  await page.keyboard.press("Escape");
  const esc = await page.evaluate(() => ({ open: document.querySelector("dialog.palette").open, active: document.activeElement.className }));
  record("P palette escape", "home", 1440, "light", reopened && !esc.open && /search-btn/.test(esc.active), { reopened, esc });

  await page.keyboard.press("g");
  await page.keyboard.press("p");
  await page.waitForURL(/\/posts\/$/, { timeout: 5000 }).catch(() => {});
  const chordUrl = page.url();
  record("P chord g p", "home", 1440, "light", /\/posts\/$/.test(chordUrl), { chordUrl });

  await open(page, "");
  await page.keyboard.press("/");
  const slashOpen = await isOpen();
  record("P slash opens", "home", 1440, "light", slashOpen, { slashOpen });
  await ctx.close();

  const off = await newCtx({ width: 1440, shortcutsOff: true });
  const op = await off.newPage();
  await open(op, "");
  const url0 = op.url();
  await op.keyboard.press("/");
  const o1 = await op.evaluate(() => document.querySelector("dialog.palette").open);
  await op.keyboard.press("g");
  await op.keyboard.press("h");
  await op.waitForTimeout(600);
  const o2 = await op.evaluate(() => document.querySelector("dialog.palette").open);
  const url1 = op.url();
  await op.keyboard.press("Control+k");
  const o3 = await op.evaluate(() => ({ open: document.querySelector("dialog.palette").open, pressed: document.querySelector(".shortcuts-toggle").getAttribute("aria-pressed") }));
  record("P shortcuts off", "home", 1440, "light", !o1 && !o2 && url1 === url0 && o3.open && o3.pressed === "false", { slashOpened: o1, chordOpened: o2, url0, url1, ctrlK: o3 });
  await off.close();

  // Dark palette shot for finding 21 (flat scrim, no shadow).
  const dark = await newCtx({ width: 1440, theme: "dark" });
  const dp = await dark.newPage();
  await open(dp, "");
  await dp.keyboard.press("Control+k");
  await dp.waitForSelector(".palette-results li[data-post]", { timeout: 5000 });
  const backdrop = await dp.evaluate(() => getComputedStyle(document.querySelector(".palette"), "::backdrop").backgroundColor);
  await dp.screenshot({ path: join(SHOTS, "palette-1440x900-dark.png"), fullPage: false });
  record("P palette dark shot", "home", 1440, "dark", backdrop === "rgba(0, 0, 0, 0.6)", { backdrop, shot: "shots-phase1/palette-1440x900-dark.png" });
  await dark.close();
}

async function postBehaviours() {
  const ctx = await newCtx({ width: 1440 });
  const page = await ctx.newPage();
  await open(page, byKey("post").path);
  const toc = await page.evaluate(async () => {
    const h2s = document.querySelectorAll(".prose h2");
    const third = h2s[2];
    scrollBy(0, third.getBoundingClientRect().top - innerHeight * 0.2);
    await new Promise((r) => setTimeout(r, 300));
    const current = [...document.querySelectorAll('.toc a[aria-current="true"]')].map((a) => a.getAttribute("href"));
    return { thirdId: third.id, thirdTop: Math.round(third.getBoundingClientRect().top), current };
  });
  record("Q tocActive", "post", 1440, "light", toc.current.length === 1 && toc.current[0] === "#" + toc.thirdId, toc);

  const progress = await page.evaluate(async () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo(0, max * 0.5);
    await new Promise((r) => setTimeout(r, 300));
    const tr = getComputedStyle(document.querySelector(".progress-bar")).transform;
    const m = tr.match(/matrix\(([^,]+),/);
    return { transform: tr, scaleX: m ? parseFloat(m[1]) : null, scrollY };
  });
  record("Q progressBar", "post", 1440, "light", progress.scaleX !== null && progress.scaleX > 0.3, progress);

  // View-transition name handoff: the pageswap listener registered here runs after
  // main.js's (added later), reads the clicked title's inline name and parks it in
  // localStorage, which survives the cross-document navigation.
  await open(page, "");
  const support = await page.evaluate(() => ({ onpageswap: "onpageswap" in window, navigation: "navigation" in window, restName: document.querySelector(".post-item-title a").style.viewTransitionName }));
  const href = await page.evaluate(() => {
    localStorage.removeItem("__vt");
    addEventListener("pageswap", (e) => {
      const a = document.querySelector(".post-item-title a");
      localStorage.setItem("__vt", JSON.stringify({ hasTransition: !!e.viewTransition, name: a.style.viewTransitionName }));
    });
    return document.querySelector(".post-item-title a").href;
  });
  await page.click(".post-item-title a");
  await page.waitForURL(href);
  await settle(page);
  const vt = await page.evaluate(() => {
    const raw = localStorage.getItem("__vt");
    localStorage.removeItem("__vt");
    return { swap: raw ? JSON.parse(raw) : null, h1Name: getComputedStyle(document.querySelector(".post-header h1")).viewTransitionName };
  });
  const observed = vt.swap && vt.swap.hasTransition && vt.swap.name === "post-title";
  const ok = observed && vt.h1Name === "post-title" && support.restName === "";
  record("Q viewTransition", "home>post", 1440, "light", ok, { ...support, ...vt, note: observed ? "pageswap name observed via localStorage" : "pageswap unobservable; fallback asserted h1 name + rest" });
  await ctx.close();
}

async function print() {
  const ctx = await newCtx({ width: 1440 });
  const page = await ctx.newPage();
  await open(page, byKey("posts").path);
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const ops = [...document.querySelectorAll(".reveal")].map((el) => getComputedStyle(el).opacity);
    return { reveals: ops.length, allOpaque: ops.every((o) => o === "1"), tools: getComputedStyle(document.querySelector(".tools")).display };
  });
  const out = join(SHOTS, "posts-print-1440x900.png");
  await page.screenshot({ path: out, fullPage: false });
  record("R print", "posts", 1440, "print", r.allOpaque && r.tools === "none", { ...r, shot: "shots-phase1/posts-print-1440x900.png" });
  await ctx.close();
}

async function screenshots() {
  console.log("S screenshots: 6 pages x 6 viewports x 2 themes");
  for (const theme of THEMES) {
    for (const [width, height] of SHOT_VIEWPORTS) {
      const ctx = await newCtx({ width, height, theme });
      const page = await ctx.newPage();
      for (const p of PAGES) {
        await open(page, p.path);
        const live = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
        const file = `${p.key}-${width}x${height}-${theme}.png`;
        const out = join(SHOTS, file);
        await page.screenshot({ path: out, fullPage: false });
        const size = pngSize(out);
        record("S screenshot", p.key, width, theme, live.w === width && live.h === height && size.width === width && size.height === height, { file: "shots-phase1/" + file, ...size });
      }
      await ctx.close();
    }
  }
}

/* ---------- main ---------- */
const server = await startServer();
BASE = server.origin + config.basePath;
console.log("Auditing " + BASE);
browser = await chromium.launch({ headless: true });
const STEPS = { matrix, focus, lightDefault, darkPersists, reducedMotion, noJs, fontsBlocked, header, fluidContainer, rail, slot, palette, postBehaviours, print, screenshots };
const only = process.argv.slice(2); // optional: run a subset, e.g. `node scripts/audit.mjs slot palette`
try {
  for (const [name, fn] of Object.entries(STEPS)) {
    if (only.length && !only.includes(name)) continue;
    const t0 = Date.now();
    // A hung check must not stall the run: fail the step and move on.
    let timer;
    await Promise.race([
      fn(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timed out after 300 s")), 300000); }),
    ])
      .catch((err) => record("ERROR " + name, "-", 0, "-", false, String(err && err.stack || err)))
      .finally(() => clearTimeout(timer));
    console.log(`  ${name} done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
} finally {
  await browser.close();
  if (server.child) server.child.kill();
}

writeFileSync(join(OUT, "audit-results.json"), JSON.stringify({ base: BASE, date: new Date().toISOString(), results }, null, 2));

const summary = new Map();
for (const r of results) {
  const s = summary.get(r.check) || { check: r.check, rows: 0, failed: 0 };
  s.rows++;
  if (!r.ok) s.failed++;
  summary.set(r.check, s);
}
console.log("\ncheck".padEnd(28) + "rows".padStart(6) + "failed".padStart(8));
for (const s of summary.values()) console.log(s.check.padEnd(27) + String(s.rows).padStart(6) + String(s.failed).padStart(8));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length} rows, ${failed} failed -> ${join(OUT, "audit-results.json")}`);
process.exit(failed ? 1 : 0);

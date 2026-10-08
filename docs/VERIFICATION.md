# v2 Phase 1 — LIVE, 2026-10-08

`feat/ui-v2` was fast-forwarded into `main` at `8d4a456` and deployed by `.github/workflows/pages.yml` (run 37799557793: `npm ci` → `npm test` → `npm run build` → Pages, success). Verified against https://sudish007.github.io/ai-batkahi/ in fresh headless Microsoft Edge contexts (Playwright for Python).

## What changed since the local section below

The six review NITs from `review-phase1.json` were folded in before the merge (commit `8d4a456`): bento last-row fill rules at 1600–2199 px (`span 3` / `span 2`) and ≥ 2200 px (`span 4` / `3` / `2`); the sticky ToC uses `margin-top: 7.5rem` instead of `padding-top` so its stuck position matches the right rail (`top: 2rem`); a 4 s `reveal-safety` keyframe makes the IntersectionObserver reveal fail-open if `main.js` never runs; `Ctrl/⌘+K` matches with Caps Lock on (`ev.key.toLowerCase()`); the `⌘ K` chip is hidden under `@media (hover: none)`; README names the audit scope (six representative pages). After the fold: `npm test` 87 / 0, `npm run audit` 658 rows / 0 failed, `styles.css` 39 062 B, `main.js` 25 977 B.

## Live URLs (fresh context, 1280×800)

| Page | URL | Result |
| --- | --- | --- |
| Home | https://sudish007.github.io/ai-batkahi/ | 200, `AI Batkahi · AI के बतकही, आपन भाषा में`, h1 `एआई बतकही — AI Batkahi` |
| All posts | https://sudish007.github.io/ai-batkahi/posts/ | 200, `सब बतकही · AI Batkahi` |
| Post | https://sudish007.github.io/ai-batkahi/posts/llm-kaise-bolela/ | 200, `ChatGPT जइसन AI कइसे बोलेला? · AI Batkahi` |
| Category | https://sudish007.github.io/ai-batkahi/category/samajh/ | 200, `समझ · AI Batkahi` |
| About | https://sudish007.github.io/ai-batkahi/about/ | 200, `हमरा बारे में · AI Batkahi` |
| 404 | https://sudish007.github.io/ai-batkahi/does-not-exist-xyz/ | 404, custom page `पन्ना नइखे मिलल · AI Batkahi` |
| Atom feed | https://sudish007.github.io/ai-batkahi/feed.xml | 200, `application/xml`, 6 entries |
| Sitemap | https://sudish007.github.io/ai-batkahi/sitemap.xml | 200, `application/xml`, 12 `<loc>`, all under `/ai-batkahi/` |
| Search index | https://sudish007.github.io/ai-batkahi/search.json | 200, `application/json`, `{v: 1, posts: [...]}` with 6 posts |

The deployed `styles.css` and `main.js` contain the NIT changes (`reveal-safety`, `hover: none`, `nth-child(4n + 2)`, `toLowerCase() === "k"`).

## 320 px overflow (live)

`scrollWidth <= clientWidth` at 320×640 on all 13 live HTML pages (home, posts, about, 3 categories, 6 posts) plus the 404 URL: every page reports 320 / 320 → pass.

## Light default under OS dark (live)

Fresh context with `color_scheme="dark"` and empty storage on home and the post: `data-theme` null, `--bg` `#FAF6EF`, body background `rgb(250, 246, 239)`, `meta[color-scheme]` `light`, one `meta[theme-color]` `#FAF6EF`, `matchMedia('(prefers-color-scheme: dark)')` true, `localStorage.length` 0 → renders light.

## Lighthouse 13.5.0 (mobile preset, headless Edge, live URLs)

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT | FCP | LCP element |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 96 | 100 | 100 | 100 | **2.62 s** | 0 | 50 ms | 1.6 s | `h1#site-title` |
| Post (llm-kaise-bolela) | 97 | 100 | 100 | 100 | 2.35 s | 0 | 150 ms | 1.0 s | lede paragraph (`.prose > p`) |

Honest reading: the home LCP of 2.62 s is **above the 2.5 s target** (the post is under it at 2.35 s). The cause is the one documented below for the local run: the Lighthouse simulation counts the six preloaded `font-display: optional` woff2 files (≈ 251 KB) before the hero paint; the owner decision to keep that strategy (zero CLS) stands. Single run each; Lighthouse lab numbers vary by ~0.1 s between runs.

## Screenshots (live, viewport-only, ≤ 1920 px per side)

Committed under `docs/screenshots/`, captured from the deployed site:

- `home-1440x900-light.png` (1440×900)
- `home-1440x900-dark.png` (1440×900, stored `theme=dark`)
- `home-390x844.png` (390×844)
- `post-1440x900.png` (1440×900, `posts/llm-kaise-bolela/`)
- `about-1440x900.png` (1440×900)
- `home-1920x1080-light.png` (1920×1080)
- `posts-1920x1080-light.png` (1920×1080, three-column card grid)
- `post-1920x1080-light.png` (1920×1080, ToC rail + right rail)
- `home-2560x1440-light.png` (2560×1440 viewport at `device_scale_factor` 0.75 → 1920×1080 PNG; container at ~92 % of the viewport)

---

# v2 Phase 1 — local (pre-merge), 2026-10-08

Measured on `dist/` built with Node 24.16 (`engines.node >=22.2`) from branch `feat/ui-v2` and served by `scripts/serve.mjs` (gzip, like Pages) at `http://127.0.0.1:8082/ai-batkahi/`.

## Tests and audit

- `npm test`: 87 pass / 0 fail (unit + dist suites; builds first).
- `npm run audit` (`scripts/audit.mjs`, Chromium via Playwright for Node): **658 rows, 0 failed**. Matrix of 6 pages × 8 widths (320–2560) × light/dark for overflow, 12 px floor, fluid body size, ≥ 40 px controls, AA contrast with the grain composited (worst pair 6.43:1 light / 6.65:1 dark) and zero page errors; plus focus visibility, light default under an OS dark preference, stored-dark persistence and pre-paint `theme-color`, zero animations under reduced motion, content without JavaScript, fonts blocked, two-row mobile header, hero at the fold, container ≥ 92 % of the viewport at 1440/1920/2560, post rail geometry, kinetic slot, theme toggle, `⌘ K` on Mac, palette keyboard flow, chords and the shortcut switch, ToC active state, reading progress, view-transition title handoff, print, and 72 viewport screenshots.
- Seventh-post / first-खबर dry run: adding `content/posts/07-tmp-khabar.md` → 7 posts, 4 categories, `category/khabar/` page, filter chip and home pillar, 86 tests green; removing it → 85 green, tree clean.

## Budgets (build output)

| asset | bytes | budget |
| --- | --- | --- |
| `styles.css` | 38 145 B (37.3 KB) | ≤ 60 KB |
| `main.js` | 25 655 B (25.1 KB) | ≤ 60 KB |
| largest page HTML + CSS + JS (`posts/chhot-shahar-se-ai-career/`) | 86 818 B (84.8 KB) | ≤ 150 KB |
| fonts (6 woff2, `font-display: optional`, preloaded) | 251 292 B (245.4 KB) | ≤ 500 KB |

## Lighthouse 13.5.0 (mobile preset, headless Edge, local gzip server)

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT | LCP element |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 96 | 100 | 100 | 100 | 2.73 s | 0 | 13–20 ms | `h1#site-title` |
| Post (llm-kaise-bolela) | 96 | 100 | 100 | 100 | 2.73 s | 0 | 42 ms | lede paragraph (same paint as the h1) |

The 2.73 s LCP misses the 2.5 s target: observed LCP is ~0.4 s, but Lighthouse's simulation puts the six preloaded `optional` fonts (251 KB) in the LCP dependency graph because they finish before the hero paints on the local server. Removing the preloads or `text-wrap` did not move the number. A follow-up measurement (same server, Lighthouse 13.5.0) of the proposed "preload only the two Devanagari 400 faces, load the other four with `font-display: swap`" strategy gave home **2.57 s** / post **2.71 s** — still above 2.5 s — and CLS **0.0004** / **0.0029** from the four swapped faces; with the other four kept `optional` (no preload) 2.57 s / 2.71 s and CLS 0 / 0.0005. Only a build with just the two Devanagari 400 faces reaches 1.97 s on both pages (CLS 0). Owner decision: keep the current strategy (six preloads, `font-display: optional`, zero CLS) — the typography is the product and a lab-only gain of ~0.17 s is not worth a visible reflow or system Latin/bold on first view. The LCP figures are measured with the Lighthouse 13.5 mobile simulation; the six optional woff2 fonts (≈ 251 KB) are counted before the hero paint; real devices cache them after the first page. Experiment table: `.agents/tasks/ui-v2/verification-phase1.md` §0.4. On the post page at the mobile viewport the collapsed ToC brings the lede into the first screen, so it, not the two-line h1, is the largest text element; both paint in the same frame. Full detail, per-check tables and screenshot list: `.agents/tasks/ui-v2/verification-phase1.md` (local artifact, not committed).

---

# Live verification — 2026-10-08 (v1)

Verified against the deployed GitHub Pages site in a fresh headless Microsoft Edge context (Playwright, `device_scale_factor=1`, `reduced_motion="reduce"`), after the `Deploy to GitHub Pages` workflow run for commit `b5dff4f` finished.

## URLs

| Page | URL | Result |
| --- | --- | --- |
| Home | https://sudish007.github.io/ai-batkahi/ | 200, `<title>` = `AI Batkahi · AI के बतकही, आपन भाषा में` |
| All posts | https://sudish007.github.io/ai-batkahi/posts/ | 200 |
| Post | https://sudish007.github.io/ai-batkahi/posts/machine-learning-ka-hola/ | 200, title `मशीन लर्निंग का होला? · AI Batkahi` |
| Category | https://sudish007.github.io/ai-batkahi/category/samajh/ | 200, title `समझ · AI Batkahi` |
| About | https://sudish007.github.io/ai-batkahi/about/ | 200, title `हमरा बारे में · AI Batkahi` |
| 404 | https://sudish007.github.io/ai-batkahi/does-not-exist | 404 with custom page `पन्ना नइखे मिलल · AI Batkahi`, link back home present |
| Atom feed | https://sudish007.github.io/ai-batkahi/feed.xml | 200, `application/xml`, 72 544 B |
| Sitemap | https://sudish007.github.io/ai-batkahi/sitemap.xml | 200, `application/xml`, 1 600 B |
| robots.txt | https://sudish007.github.io/ai-batkahi/robots.txt | 200, `text/plain`, 84 B (see note below) |

Click-through performed in one browser session: home → post (`machine-learning-ka-hola`) → category (`samajh`) → about → 404 → feed.xml → sitemap.xml. No JavaScript page errors; the only console error is the expected 404 status on the not-found URL.

Repository: https://github.com/Sudish007/ai-batkahi — `gh repo view --json visibility` → `PUBLIC`.

## 320 px overflow

`document.documentElement.scrollWidth <= clientWidth` asserted at a 320×700 viewport on all 13 live HTML pages (home, posts index, about, 404, 3 category pages, 6 posts). Every page reports `scrollWidth 320 / clientWidth 320` → pass.

## Lighthouse (13.5.0, mobile preset, headless Edge, live URLs)

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT | Total transfer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 100 | 100 | 100 | 100 | 1.2 s | 0.008 | 10 ms | 262 379 B |
| Post (machine-learning-ka-hola) | 100 | 100 | 100 | 100 | 1.1 s | 0.038 | 20 ms | 199 063 B |

## Payload (home page, transfer size over the wire / decoded)

| Asset | Transfer | Decoded |
| --- | --- | --- |
| `index.html` | 3 531 B | 10 325 B |
| `styles.css` | 3 765 B | 16 081 B |
| `main.js` | 1 911 B | 4 971 B |
| `favicon.svg` | 499 B | 503 B |
| Fonts (6 woff2 files, below) | 252 673 B | 251 292 B |
| **Total** | **≈ 262 KB** | **≈ 283 KB** |

Post page loads 4 font files (no 700-weight needed): total transfer 199 063 B, decoded 224 490 B, of which fonts 186 704 B.

## Font bytes (woff2, self-hosted, `font-display: swap`)

| File | Bytes |
| --- | --- |
| `tiro-devanagari-hindi-devanagari-400-normal.woff2` | 98 828 |
| `tiro-devanagari-hindi-latin-400-normal.woff2` | 26 948 |
| `noto-sans-devanagari-devanagari-400-normal.woff2` | 50 416 |
| `noto-sans-devanagari-devanagari-700-normal.woff2` | 53 984 |
| `noto-sans-devanagari-latin-400-normal.woff2` | 10 512 |
| `noto-sans-devanagari-latin-700-normal.woff2` | 10 604 |
| **Total** | **251 292 B (≈ 245 KB)** |

The 700-weight files are only requested on pages that render bold Noto text (home, posts index).

## Screenshots

Viewport-only captures of the live site, committed under `docs/screenshots/`:

- `home-1440x900-light.png` (1440×900)
- `home-1440x900-dark.png` (1440×900, `prefers-color-scheme: dark`)
- `home-390x844.png` (390×844)
- `post-1440x900.png` (1440×900, `posts/machine-learning-ka-hola/`)
- `about-1440x900.png` (1440×900)

## Notes

- `robots.txt` is served at `/ai-batkahi/robots.txt`, but crawlers only read `https://sudish007.github.io/robots.txt` (the user-site root), so it is not consulted on the project-pages URL. It becomes effective after moving to a custom domain with `basePath: "/"`.
- GitHub Pages source was set to "GitHub Actions" via `POST /repos/Sudish007/ai-batkahi/pages` with `build_type=workflow` before the first push.

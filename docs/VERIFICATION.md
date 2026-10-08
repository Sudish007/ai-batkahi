# Live verification — 2026-10-08

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

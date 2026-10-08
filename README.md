# AI Batkahi

Static blog for [@batkahi](https://www.instagram.com/batkahi/): AI, machine learning and data science explained in standard Bhojpuri. Every post is one "बतकही" (conversation). Published at https://sudish007.github.io/ai-batkahi/ via GitHub Pages.

> The Bhojpuri copy on this site is a first draft. The owner should review every post before promoting the site or any individual post.

## Stack

- Node >= 20, plain ESM, no framework, no bundler. `src/build.js` renders Markdown + JS template literals into `dist/`.
- Dependencies are exact-pinned: `marked` (Markdown), `@fontsource/tiro-devanagari-hindi` and `@fontsource/noto-sans-devanagari` (self-hosted fonts), `fast-xml-parser` (dev, XML well-formedness tests).
- Everything else is hand-written: front-matter parser, slugify, reading time, Atom feed, sitemap, category pages, theme toggle, client-side filter, share buttons.

## Commands

```
npm install          # or npm ci (lockfile is committed)
npm run build        # -> dist/
npm test             # builds, then runs node --test (unit + dist checks)
npm run serve        # serves dist/ at http://127.0.0.1:4173/ai-batkahi/
npm run check-links  # verifies every external link in dist/ returns 200
```

## Adding a post

1. Create `content/posts/NN-slug.md`. The URL slug is the filename minus the `NN-` prefix and `.md`.
2. Front matter (all keys except `instagram` are required):

   ```
   ---
   title: भोजपुरी शीर्षक
   title_en: English title
   date: 2026-10-08
   category: samajh
   tags: [tag one, tag two, tag three]
   summary: एक-दू वाक्य भोजपुरी में।
   summary_en: One or two sentences in English (used for meta description).
   instagram:
   ---
   ```

   Leave `instagram:` empty unless there is a specific reel; when set, the post links that reel instead of the profile.
3. Body: 500–900 Bhojpuri words, `##` sections only, ending with `## एक लाइन में` (one-line takeaway) and a final `## In English` section (60–100 words). The build moves the "In English" section into its own `lang="en"` block.
4. Categories live in `content/categories.js` (समझ `samajh`, औजार `aujaar`, रास्ता `raasta`, खबर `khabar`). A category with zero posts is hidden from nav, filters, sitemap and gets no page automatically.
5. Reading time is computed from the real word count at 180 wpm. Never hard-code it.

Internal links inside Markdown may be written root-relative (`/posts/other-slug/`); the build prefixes `basePath`.

## Fonts

Self-hosted from the fontsource packages. The build copies only these six files into `dist/fonts/` (Devanagari + Latin subsets, ~245 KB total):

- `tiro-devanagari-hindi-devanagari-400-normal.woff2`, `tiro-devanagari-hindi-latin-400-normal.woff2` (headings)
- `noto-sans-devanagari-{devanagari,latin}-{400,700}-normal.woff2` (body and UI)

`public/styles.css` declares the `@font-face` rules with `unicode-range` and `font-display: swap`. Font URLs use the `__BASE__` token which the build replaces with `basePath`.

## Brand images

`public/favicon.svg` is hand-written. `public/favicon.ico`, `public/apple-touch-icon.png` and `public/og-default.png` are rendered from `assets/brand/*.html` by `scripts/render-brand.py` (requires Python with Playwright and Microsoft Edge) and committed, so CI stays Node-only. Re-run the script after changing the templates:

```
python scripts/render-brand.py
```

## Moving to a custom domain later

1. In `site.config.js` set `siteUrl` to `https://your-domain.example` and `basePath` to `/`.
2. Add `public/CNAME` containing the bare domain.
3. Rebuild and push. Every internal link, the feed and the sitemap derive from those two values.

## Deploy

`.github/workflows/pages.yml` builds and tests on every push to `main` (and on manual dispatch) and deploys `dist/` to GitHub Pages. Set the repository's Pages source to "GitHub Actions".

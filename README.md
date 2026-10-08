# AI Batkahi

Static blog for [@batkahi](https://www.instagram.com/batkahi/): AI, machine learning and data science explained in standard Bhojpuri. Every post is one "बतकही" (conversation). Published at https://sudish007.github.io/ai-batkahi/ via GitHub Pages.

> The Bhojpuri copy on this site is a first draft. The owner should review every post before promoting the site or any individual post.

## Stack

- Node >= 22.2 (`zlib.crc32` for the grain tile), plain ESM, no framework, no bundler. `src/build.js` renders Markdown + JS template literals into `dist/`.
- Dependencies are exact-pinned: `marked` (Markdown), `@fontsource/tiro-devanagari-hindi` and `@fontsource/noto-sans-devanagari` (self-hosted fonts), `fast-xml-parser` (dev, XML well-formedness tests).
- Everything else is hand-written: front-matter parser, slugify, reading time, Atom feed, sitemap, category pages, search index, theme toggle, command palette, client-side filter, share buttons.
- Build budgets (the build fails when exceeded): `styles.css` <= 60 KB, `main.js` <= 60 KB, every page's HTML + CSS + JS <= 150 KB, fonts <= 500 KB.

## Commands

```
npm install          # or npm ci (lockfile is committed)
npm run build        # -> dist/
npm test             # builds, then runs node --test (unit + dist checks)
npm run serve        # serves dist/ at http://127.0.0.1:4173/ai-batkahi/ (gzip like Pages)
npm run audit        # real-browser audit of dist/ (needs PW_PATH, see below)
npm run check-links  # verifies every external link in dist/ returns 200
```

### Browser audit

`npm run audit` serves `dist/` on a free port, drives Chromium through Playwright and checks every page at eight widths in both themes: no horizontal overflow, no text under 12 px, body size on the fluid scale, every control >= 40 px, AA contrast with the paper grain composited in, visible focus, light default under an OS dark preference, stored-dark persistence and pre-paint `theme-color`, zero animations under reduced motion, content without JavaScript, fonts blocked, header geometry, hero at the fold, fluid container use, post rail geometry, the kinetic slot, the palette and shortcuts, ToC active state, reading progress, the view-transition title handoff, print, and viewport screenshots. Results go to `.agents/tasks/ui-v2/audit-results.json` and `.agents/tasks/ui-v2/shots-phase1/`; the exit code is 1 when any row fails. Playwright for Node is not a dependency: set `PW_PATH` to a Playwright package directory (for example the one inside a global `@playwright/cli` install) with Chromium downloaded. `AUDIT_URL` points the audit at an already running server; extra arguments run a subset of checks (`node scripts/audit.mjs slot palette`).

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

   Leave `instagram:` empty unless there is a specific reel; when set, the post links that reel instead of the profile. Add `draft: true` to keep a post out of the build entirely (no page, no feed, no search entry; the build logs `skip draft: <file>`).
3. Body: 500–900 Bhojpuri words, `##` sections only, ending with `## एक लाइन में` (one-line takeaway) and a final `## In English` section (60–100 words). The build moves the "In English" section into its own `lang="en"` block. Posts with two or more `##` sections get a table of contents (a `<details>` on phones, a sticky rail from 1200 px); duplicate heading texts get unique `-2`, `-3` ids.
4. Markdown `>` is reserved for pull-quotes: one sentence lifted from the body, set large in Tiro with an accent bar. Do not use it for asides or citations.
5. Categories live in `content/categories.js` (समझ `samajh`, औजार `aujaar`, रास्ता `raasta`, खबर `khabar`). A category with zero posts is hidden from nav, filters, sitemap and gets no page automatically; the About page lists it as plain text labelled "अबहीं पोस्ट नइखे". The first post in a new category creates its page, filter chip and home pillar cell with no other change.
6. Reading time is computed from the real word count at 180 wpm. Never hard-code it.
7. Related posts on a post page are the other posts sharing at least one tag (up to three, most shared tags first); tags are the only input, so reuse tag spellings exactly.

Internal links inside Markdown may be written root-relative (`/posts/other-slug/`); the build prefixes `basePath`.

## Home hero words

`heroWords` in `site.config.js` is the list of `{ word, gloss }` pairs for the kinetic slot under the masthead ("AI के शब्द, आपन बोली में"). Every pair is in the HTML; the first is visible without JavaScript and stays put under `prefers-reduced-motion: reduce`. With motion allowed the slot advances every 3.5 s, pauses on hover/focus and advances on click.

## Search and shortcuts

The build writes `dist/search.json` (`{ v: 1, posts: [...] }`, newest first, summaries capped at 240 characters). The header search link opens a command palette (`Ctrl K`, `⌘ K` on Apple devices, or `/`) that fetches the index on first open and ranks title, English title, category/tags and summary matches; without JavaScript the link goes to `posts/`. The `g h` / `g p` / `g a` chords jump to home, all posts and About. Single-key shortcuts (`/` and the chords) can be switched off with the button in the palette footer (stored as `localStorage.shortcuts = "off"`); `Ctrl K` always works.

## Fonts

Self-hosted from the fontsource packages. The build copies only these six files into `dist/fonts/` (Devanagari + Latin subsets, ~245 KB total):

- `tiro-devanagari-hindi-devanagari-400-normal.woff2`, `tiro-devanagari-hindi-latin-400-normal.woff2` (headings)
- `noto-sans-devanagari-{devanagari,latin}-{400,700}-normal.woff2` (body and UI)

`public/styles.css` declares the `@font-face` rules with `unicode-range` and `font-display: optional`; `src/templates/layout.js` emits six `<link rel="preload" as="font">` hints (one per file) on every page, so a first visit either gets the fonts in time or renders in the system fallback without a later swap. Font URLs use the `__BASE__` token which the build replaces with `basePath`.

## Paper grain

`public/grain.png` is the 256 px tile the body background repeats (mid-grey speckle at <= 12/255 alpha, so it darkens the light paper and lightens the dark one). It is generated deterministically and committed; a test asserts byte equality with the generator. Regenerate after changing the defaults in `scripts/make-grain.mjs`:

```
node scripts/make-grain.mjs public/grain.png
```

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

Live verification results (Lighthouse, payload, screenshots) are in [`docs/VERIFICATION.md`](docs/VERIFICATION.md).

## Owner to-do

Things only the owner can do; nothing here has been done or verified by the build:

1. Create or claim the Instagram account **@batkahi** and confirm the handle is actually available. The site links to `https://www.instagram.com/batkahi/` but the handle's availability has not been verified.
2. Review the Bhojpuri copy of the 6 posts in `content/posts/` (they are first drafts).
3. Decide on and buy the domain (`batkahi.ai` and `batkahi.in` were unregistered on 2026-10-05), then set `siteUrl` and `basePath` in `site.config.js` and add `public/CNAME` as described in "Moving to a custom domain later".
4. Put the live URL (https://sudish007.github.io/ai-batkahi/ or the custom domain) in the Instagram bio.

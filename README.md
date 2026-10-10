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
npm run audit:admin  # real-browser audit of dist/admin/ with GitHub mocked (needs PW_PATH)
npm run dryrun       # adds a temporary 7th post + draft + image, runs npm test, cleans up
npm run check-links  # verifies every external link in dist/ returns 200
```

### Browser audit

`npm run audit` serves `dist/` on a free port, drives Chromium through Playwright and checks seven representative pages (one per template, plus the admin lock screen) at eight widths in both themes: no horizontal overflow, no text under 12 px, body size on the fluid scale, every control >= 40 px, AA contrast with the paper grain composited in, visible focus, light default under an OS dark preference, stored-dark persistence and pre-paint `theme-color`, zero animations under reduced motion, content without JavaScript, fonts blocked, header geometry, hero at the fold, fluid container use, post rail geometry, the kinetic slot, the palette and shortcuts, ToC active state, reading progress, the view-transition title handoff, print, and viewport screenshots. Results go to `.agents/tasks/ui-v2/audit-results.json` and `.agents/tasks/ui-v2/shots-phase1/`; the exit code is 1 when any row fails. Playwright for Node is not a dependency: set `PW_PATH` to a Playwright package directory (for example the one inside a global `@playwright/cli` install) with Chromium downloaded. `AUDIT_URL` points the audit at an already running server; extra arguments run a subset of checks (`node scripts/audit.mjs slot palette`).

## Adding a post

Either write the file by hand as below, or use the browser admin at `/admin/` (see "Admin"), which writes exactly the same file through the GitHub API.

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

Images live in `content/images/<slug>/<file>` (the build copies the directory to `dist/images/`) and are referenced root-relative in Markdown as `![alt](/images/<slug>/<file>)`. The build reads the PNG/JPEG/WebP header and adds `width`/`height` to the `<img>` so the layout does not shift; an image it cannot read is still copied but logged as a warning.

## Home hero words

`heroWords` in `site.config.js` is the list of `{ word, gloss }` pairs for the kinetic slot under the masthead ("AI के शब्द, आपन बोली में"). Every pair is in the HTML; the first is visible without JavaScript and stays put under `prefers-reduced-motion: reduce`. With motion allowed the slot advances every 3.5 s, pauses on hover/focus and advances on click.

## Search and shortcuts

The build writes `dist/search.json` (`{ v: 1, posts: [...] }`, newest first, summaries capped at 240 characters). The header search link opens a command palette (`Ctrl K`, `⌘ K` on Apple devices, or `/`) that fetches the index on first open and ranks title, English title, category/tags and summary matches; without JavaScript the link goes to `posts/`. The `g h` / `g p` / `g a` chords jump to home, all posts and About. Single-key shortcuts (`/` and the chords) can be switched off with the button in the palette footer (stored as `localStorage.shortcuts = "off"`); `Ctrl K` always works.

## Admin (`/admin/`)

A static page built into `dist/admin/` and served at https://sudish007.github.io/ai-batkahi/admin/. It is not linked from the site, carries `<meta name="robots" content="noindex">`, is excluded from the sitemap, feed and search index, and `robots.txt` has `Disallow: /ai-batkahi/admin/`. There is no server: the page talks to `api.github.com` directly from the owner's browser with a personal access token and commits to this repository, which the normal Pages workflow then builds and deploys.

### Lock screen and token

Without a token the page shows only the sign-in form plus the instructions below (no post data is loaded). Create a **fine-grained** personal access token exactly like this (the lock screen repeats these steps):

1. Open https://github.com/settings/personal-access-tokens/new.
2. Token name `ai-batkahi admin`; Expiration 90 days or less.
3. Repository access → **Only select repositories** → `Sudish007/ai-batkahi`.
4. Repository permissions: **Contents → Read and write**; **Actions → Read-only**. Nothing else.
5. Generate the token, copy it, paste it into the field and sign in. Sign-in makes one call, `GET /repos/Sudish007/ai-batkahi`, and requires `permissions.push` to be true; a token without push access is rejected and not stored.

Where the token lives: in `sessionStorage` by default (gone when the tab closes). Only when "ई डिवाइस पर याद राखीं" is ticked does it go to `localStorage` instead. "साइन आउट" removes it from both. It is sent only in the `Authorization` header to `api.github.com`; it is never put in a URL, a commit, the activity log or the console.

Shared-origin caveat: `sudish007.github.io` is one origin for all of the owner's project sites (this one, `bhojverse-site`, …), so any page under that origin could read a remembered token from `localStorage`. Keep "remember" off on shared machines, sign out when done, and revoke the token at https://github.com/settings/tokens if in doubt.

### What it does

- Dashboard: every file in `content/posts/`, newest first, with title, English title, date, category, published/draft state, Edit, a "देखीं" link to the live post, Delete (typed slug confirmation), and the result of the last Pages run.
- Editor: all front-matter fields with the same validation rules as the build (required keys, slug `a-z0-9-`, 1–8 tags, summaries ≤ 300 characters, `##` sections only, a trailing `## In English`, 50+ Bhojpuri words, 20+ English words); tag chips; a text-labelled Markdown toolbar; live word count and reading time; a live preview rendered in a sandboxed iframe by the **same** marked build and renderer that `src/build.js` uses (`src/lib/markdown-core.js` is copied verbatim into `dist/admin/lib/`), styled by the site's own `styles.css`; autosave to `localStorage` after 3 s of inactivity with a restore banner after a reload.
- Validation mirrors what `npm test` rejects after a commit (the Pages workflow runs the suite on every push, so a body the tests reject would fail the deploy): no `#` or setext h1, heading levels one step at a time (`## → ### → ####`, also after `## In English`), exactly one trailing `## In English`, internal links root-relative and pointing at an existing post, category page, fixed page or committed image (`/posts/<slug>/`, `/category/<slug>/`, `/`, `/posts/`, `/about/`, `/feed.xml`, `/images/…`; drafts have no page), otherwise a full `https://` URL, no raw `<a>`/`<img>`/`<hN>`/`<svg>`/`<script>` tags, and none of the words the page tests ban in titles and summaries. Every rule is decided from the Markdown lexer's tokens (fenced code is never a heading or a link). `tests/validate-parity.test.js` checks every `content/posts/*.md` passes and keeps one CI-failing fixture per rule.
- Images: pick, drop or paste one or more files → resized in the browser to ≤ 1600 px on the long side → WebP (JPEG where the browser cannot encode WebP) → committed to `content/images/<slug>/<yyyymmdd>-<name>.webp` → `![alt](/images/<slug>/<name>)` inserted at the caret. Several files are uploaded one after another, each with its own alt prompt, in order. Alt text is required unless the image is marked decorative; the slug must already be valid.
- Publish / update / draft / delete go through the GitHub Contents API (`PUT`/`DELETE /repos/…/contents/<path>` with the file's `sha` for updates and deletes; a `409` because the file changed elsewhere offers reload or overwrite). After a publish the page polls the latest Actions run for the commit every 10 s and shows queued → running → success with the live URL, or failure with a link to the run.

Commit messages: `post: <title_en>` (publish and update), `draft: <title_en> [skip ci]`, `image: <file> for <slug> [skip ci]`, `post: delete <title_en>`. Drafts and images do not trigger a deploy; publishing, updating and deleting do. The "ड्राफ्ट (साइट पर ना देखाई)" checkbox decides the committed state: while it is ticked the primary button reads "ड्राफ्ट सहेजीं" and commits `draft: true`; the separate "ड्राफ्ट सहेजीं" button (shown when the box is off) saves a draft and ticks the box; unticking the box on an opened draft and pressing "प्रकाशित करीं" publishes it.

### Limitations

- Publishing takes about a minute: GitHub Actions has to build the site.
- Runs only in the owner's browser; one author; no comments, analytics or multi-user features.
- Browsers: Chromium/Edge 120+, Firefox 120+, Safari 17+ (`<dialog>`, ES modules, `TextEncoder`).
- The `robots.txt` Disallow only takes effect on a custom domain: on a project site crawlers read `https://sudish007.github.io/robots.txt`, not this one. The `noindex` meta on the page itself still applies.

### Budgets and tests

- The build fails when `admin.js` + `admin/lib/*.js` exceed 80 KB (the build log prints the current figure as `admin js (admin.js + lib)`). The marked copy (`admin/vendor/marked.esm.js`, 46 345 B) is shipped alongside and reported separately in the build log.
- `npm test` covers the admin libraries (`tests/admin-lib.test.js`), validator/CI parity (`tests/validate-parity.test.js`) and the built page (`tests/dist-admin.test.js`: CSP hash, noindex, labels, byte-identical lib copies, budget); `tests/css-floor.test.js` and `tests/motion-gating.test.js` also scan `admin.css`.
- `npm run audit:admin` drives the built admin in Chromium with **every GitHub call mocked** (`page.route` on `https://api.github.com/**` and `https://raw.githubusercontent.com/**`): lock screen, CSP silence, sign-in errors (401, no push, rate limit), token storage and hygiene, dashboard, delete, editor layout at 320–2560 px in both themes, preview parity with the build's renderer, autosave, the unsaved-changes guard, image upload (single file, two files dropped at once, invalid slug), validator parity (CI-failing bodies rejected with their Bhojpuri messages, resolvable links committed, repository images, draft links), external images in the preview, sign-out autosave flush, publish/draft/update, stale-sha retry and run polling. Results: `.agents/tasks/ui-v2/audit-admin-results.json` and `shots-phase2/`. The only token strings in the repository are the fake values `ghp_FAKE_OK`, `ghp_FAKE_READONLY`, `ghp_FAKE_RATE` and `ghp_FAKE_BAD`.
- `npm run dryrun` proves that a 7th post in the empty `khabar` category, a draft and an image keep `npm test` green, then removes them.

**The real publish path has NOT been exercised: no GitHub token exists in this environment, so every browser test ran against mocks. The first real publish should be a throwaway draft.**

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
5. Create the token and publish the first post through the admin, which is live at https://sudish007.github.io/ai-batkahi/admin/ (the lock screen repeats these steps). Its real publish path is **UNTESTED** until that first real post: every browser test so far ran against a mocked GitHub API.
   1. Open https://github.com/settings/personal-access-tokens/new.
   2. Token name: `ai-batkahi admin`. Resource owner: `Sudish007`. Expiration: pick one; when it expires the admin shows an auth error on sign-in ("टोकन गलत बा या खतम हो गइल"), so make a new token then.
   3. Repository access: **Only select repositories** → `Sudish007/ai-batkahi`.
   4. Repository permissions: **Contents = Read and write**, **Actions = Read-only** (Metadata is added automatically). Nothing else.
   5. Generate token, copy it, paste it into the field at https://sudish007.github.io/ai-batkahi/admin/ and sign in.
   - Tick "ई डिवाइस पर याद राखीं" only on your own device. If the device is lost, revoke the token at https://github.com/settings/tokens.
   - Publish the first post with the "ड्राफ्ट (साइट पर ना देखाई)" box ticked: that commits the file with `draft: true` and `[skip ci]`, so the pipeline is exercised without a deploy and nothing appears on the site. Open the post again, untick the box and press "प्रकाशित करीं" to publish it for real.
   - If an Actions run fails after publishing, the admin shows the run link in the publish dialog ("CI असफल — run देखीं"): fix the post in the admin and publish again.

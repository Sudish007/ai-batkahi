# Phase 2 — admin (live 2026-10-10)

`feat/admin` (9 commits, `22f593f..260e5ef`) was fast-forwarded into `main` at `260e5ef` and pushed on 2026-10-10; Pages run [38046126949](https://github.com/Sudish007/ai-batkahi/actions/runs/38046126949) (`npm ci` → `npm test` → `npm run build` → deploy) succeeded. The admin is live at https://sudish007.github.io/ai-batkahi/admin/. Live checks were run from fresh headless Microsoft Edge 155 contexts (Playwright for Python 1.55, `viewport` as stated, `device_scale_factor` 1, `reduced_motion: reduce`, no stored state); the script lives outside the repository (scratch), its 44 rows all passed.

**Real GitHub publish: still UNTESTED. No token exists in this environment; in the live session below every request to `https://api.github.com` was answered by an in-memory fake (`page.route`) built from the six real `content/posts/*.md`, with the documented fake token `ghp_FAKE_OK`. Nothing was committed to GitHub by the admin.**

## Pre-merge gates (run on `feat/admin` at `260e5ef`, working tree clean before and after)

| Gate | Result |
| --- | --- |
| `npm test` | 209 tests, 209 pass, 0 fail (1.39 s after the build) |
| `npm run build` | `admin js (admin.js + lib)` 74 374 B of 81 920; `admin/vendor/marked.esm.js` 46 345 B; `admin/admin.css` 7 465 B; `admin/index.html` 22 604 B; `styles.css` 39 062 B; `main.js` 25 977 B; largest page `posts/chhot-shahar-se-ai-career/index.html` 22 810 B |
| `npm run dryrun` | exit 0; 6 posts / 3 active categories → 7 / 4 during the run (211 tests pass) → 6 / 3; `git status --porcelain` empty afterwards |
| `npm run audit:admin` | 194 rows, 0 failed (one run in this step; 30 contexts, mocked GitHub) |
| `npm run audit` | 759 rows, 0 failed (7 pages incl. `admin/`) |
| `git grep -n -E "ghp_\|github_pat_"` | only `ghp_FAKE_OK`, `ghp_FAKE_READONLY`, `ghp_FAKE_RATE`, `ghp_FAKE_BAD` in `scripts/audit-admin.mjs` / `tests/admin-lib.test.js`, plus prose in `README.md` and this file |

## Live URLs checked

| URL | Result |
| --- | --- |
| https://sudish007.github.io/ai-batkahi/admin/ | 200, `संपादक · AI Batkahi`, `<html lang="bho">`, `<meta name="robots" content="noindex">`, CSP meta present (`default-src 'self'; connect-src 'self' https://api.github.com https://sudish007.github.io; …`) |
| https://sudish007.github.io/ai-batkahi/ | 200, `AI Batkahi · AI के बतकही, आपन भाषा में` |
| https://sudish007.github.io/ai-batkahi/posts/ | 200, `सब बतकही · AI Batkahi` |
| https://sudish007.github.io/ai-batkahi/posts/llm-kaise-bolela/ | 200, `ChatGPT जइसन AI कइसे बोलेला? · AI Batkahi` |
| https://sudish007.github.io/ai-batkahi/category/samajh/ | 200, `समझ · AI Batkahi` |
| https://sudish007.github.io/ai-batkahi/about/ | 200, `हमरा बारे में · AI Batkahi` |
| https://sudish007.github.io/ai-batkahi/does-not-exist-xyz/ | HTTP 404, custom page `पन्ना नइखे मिलल · AI Batkahi` |
| https://sudish007.github.io/ai-batkahi/robots.txt | 200, `User-agent: *` / `Allow: /` / `Disallow: /ai-batkahi/admin/` / `Sitemap: …/sitemap.xml` (113 B) |
| `sitemap.xml` (1 600 B), `feed.xml` (37 816 B), `search.json` (4 356 B) | 200 each; the string `admin` occurs 0 times in each |

Zero page errors in every context; the only console error in the whole run was the 404 URL's own `Failed to load resource … 404`.

### Lock screen without a token

Fresh context, no storage: `#lock` visible with the password-type token field, the "ई डिवाइस पर याद राखीं" checkbox, the five-step help list (link to `github.com/settings/personal-access-tokens/new`), the "सुरक्षा के बात" and "सीमा" sections; `#dashboard`, `#editor` and `#activity` carry `hidden`, `#post-list` has 0 children, every editor field is empty, none of the six post titles occurs in `document.body.innerText`; the sign-in button was enabled by JS. Opening `/admin/#/new` and `/admin/#/edit/02-llm-kaise-bolela.md` directly shows the same lock screen (editor hidden, fields empty). **0 requests** were made to `api.github.com` without a token. No console or page errors.

### Admin absent from the public surface

Home, `/posts/`, `/posts/llm-kaise-bolela/`, `/about/`: no `href` containing `admin` among 32 / 29 / 27 / 20 links, the string `/admin` occurs 0 times in the served HTML (footer and command-palette markup included). `sitemap.xml`, `feed.xml`, `search.json`: 0 mentions. `robots.txt` has `Disallow: /ai-batkahi/admin/`. (As noted in the README, the Disallow only matters on a custom domain; the `noindex` meta applies today.)

### No regression on public pages

`document.documentElement.scrollWidth <= clientWidth` at 320×640 on all 14 live HTML pages (home, `/posts/`, `/about/`, 3 categories, 6 posts, the 404 URL and `/admin/` lock screen) in light (no storage, `data-theme` null) and dark (stored `theme=dark`, `data-theme="dark"`): every page 320 / 320. OS-dark emulation (`color_scheme: dark`) with empty storage on `/`, the post and `/admin/`: `data-theme` null, body `rgb(250, 246, 239)`, one `meta[name=theme-color]` `#FAF6EF`, `localStorage.length` 0 → light.

### Mocked sign-in against the live bundle (1440×900, light)

`ghp_FAKE_OK` typed into the live lock screen → `GET /repos/Sudish007/ai-batkahi` (fake: `permissions.push` true) → `GET …/contents/content/posts` → six `GET …/contents/content/posts/<file>` → `GET …/actions/workflows/pages.yml/runs` → dashboard with the six real posts newest-first (title, `title_en`, `2026-10-08 · <category> · प्रकाशित`, `संपादन` → `#/edit/<file>`, `देखीं` → `https://sudish007.github.io/ai-batkahi/posts/<slug>/`), `6 बतकही · 0 ड्राफ्ट`, deploy strip `आखिरी deploy (साइट बनावल): सफल · 3 मिनट पहिले run (Actions चलाव)`; token in `sessionStorage` only, field cleared, not in the URL. `संपादन` on `02-llm-kaise-bolela.md` → heading `संपादन: ChatGPT जइसन AI कइसे बोलेला?`, every field equal to the file (slug `llm-kaise-bolela` read-only, date `2026-10-08`, category `samajh`, tags `LLM, ChatGPT, भाषा मॉडल, अनुमान`, body 4 461 chars, `893 शब्द`); the preview iframe (`srcdoc`, `lang="bho"`, `body.page-post`) loaded the LIVE `https://sudish007.github.io/ai-batkahi/styles.css` (`link.sheet` non-null, body `rgb(250, 246, 239)`, h1 in Tiro Devanagari Hindi) and rendered h2 ids `section-1 … section-6, in-english-heading` — the same ids the deployed post page carries — with 18 paragraphs and the `section.in-english[lang=en]`. `प्रकाशित करीं` on the unchanged post → **0 validation errors**, publish dialog for `content/posts/02-llm-kaise-bolela.md`, one `PUT` to the fake with the file's previous sha, `branch: main`, message `post: How does an AI like ChatGPT talk?`, decoded body byte-equal to the file after trim → step 1 `commit daabe7a` (fake sha) → `GET …/actions/runs` (fake: completed/success for that sha) → step 2 `सफल`, step 3 `https://sudish007.github.io/ai-batkahi/posts/llm-kaise-bolela/`, `लाइव बा`. 12 requests in the session, all answered by the fake, none unmocked; the fake token never appeared in the DOM, console, URL or activity log; 0 page errors, 0 console errors.

## Live bytes (identity encoding, equal to `dist/`)

| Asset | Bytes |
| --- | --- |
| `admin/` (`index.html`) | 22 604 |
| `admin/admin.js` | 40 768 |
| `admin/lib/*.js` (13 files) | 33 606 (→ admin JS budget line 74 374 of 81 920) |
| `admin/vendor/marked.esm.js` | 46 345 |
| `admin/admin.css` | 7 465 |
| `styles.css` / `main.js` | 39 062 / 25 977 (admin page measure 22 604 + 39 062 + 25 977 = 87 643 of 153 600) |
| `robots.txt` | 113 |

## Screenshots (live, viewport-only, light, `docs/screenshots/`)

Captured from the deployed `/admin/`; the dashboard and editor shots come from the mocked session above (fake GitHub API, fake token `ghp_FAKE_OK`, no real token exists):

- `admin-lock-390x844.png` (390×844, 144 175 B) — lock screen, no token
- `admin-lock-1440x900.png` (1440×900, 228 593 B) — lock screen, no token
- `admin-dashboard-1440x900.png` (1440×900, 250 438 B) — six real posts listed from the fake
- `admin-editor-1440x900.png` (1440×900, 227 286 B) — `02-llm-kaise-bolela.md` open; the fields grid is above the fold, the body and preview panes below it at this height

Each was inspected: Devanagari matras intact, no overflow, controls aligned; nothing needed fixing.

## Not verified

- A real publish, update, delete or image commit against GitHub (no token exists; the Contents API, its `sha` handling and the `409` path were exercised only against the fake).
- Real Actions-run polling after a commit (the fake returned `completed/success` on the first poll; queued → in_progress timing, the 10-minute cap and a real failure were seen only in the local audit's fake).
- Token expiry / revocation behaviour against the real API (401 mapping was tested against the fake only).
- Firefox and Safari; the old-browser notice; `QuotaExceededError`; the image-overwrite `confirm`.

The deploy of this docs commit itself is recorded in the final step report (commit hash and run id), not here.

---

# v2 Phase 2 — admin (local, 2026-10-09)

Branch `feat/admin`, built with Node 24.16 and served by `scripts/serve.mjs` (gzip) on `127.0.0.1`; Chromium driven by Playwright 1.64 loaded from `PW_PATH`. Merged into `main` and deployed on 2026-10-10 (see the live section above).

**Real GitHub publish: UNTESTED — no token exists; every GitHub call in the audit is mocked. First real use should be a throwaway draft.**

## Gates

| Gate | Result |
| --- | --- |
| `npm test` | Pass 5: 209 tests, 209 pass, 0 fail (~1.7 s; builds first; `tests/validate-parity.test.js` adds 44). Pass 4: 165 / 165 / 0 |
| `npm run dryrun` | exit 0 — before `6 posts, 3 active categories` → during `7 posts, 4 active categories` (`skip draft: 98-dry-run-draft.md`, `Building 7 posts, 4 active categories`, `posts/dry-run-khabar/index.html` 12 249 B, `width="1" height="1"` on the fixture img, 166 tests pass) → after `6 posts, 3 active categories`, then a final `npm run build` so `dist/` holds the six real posts again; `git status --porcelain content/` empty, `content/images/dry-run/` and `dist/posts/dry-run-khabar/` gone |
| `npm run audit:admin` | Pass 5: 194 rows, 0 failed in 2 of 2 full runs (30 contexts; rows M2 / M3 / W / W2 / X / Y / Z added). Pass 4: 178 rows, 0 failed in 2 of 2 full runs (rows P / P2 / P3 replace P). Earlier: 176 rows, 0 failed in 4 of 4 consecutive full runs, plus 4 of 4 `publishFlows`-only runs (9 rows each). Review pass 2 had found this gate red about one run in four: the `#publish-dialog` `close` handler evicted the just-published post from the cache while `loadDashboard` was rendering it; the dashboard now renders from the entries its own fetch pool returned and the handler only stops the poll. Rows added since pass 1: restore on `#/edit`, link dialog, delete via Enter, field-border contrast × 10, unsaved-changes guard "stay" + "discard" (V). Pass 3: 176 rows, 0 failed in 2 of 2 full runs |
| `npm run audit` | 759 rows, 0 failed; PAGES now has 7 entries incl. `admin/` (101 admin rows across A overflow, B fontFloor, C typeScale, D controls, E contrast, pageErrors, G lightDefault, S screenshot) |
| `git grep -n "ghp_\|github_pat_"` | only the four fake tokens (`scripts/audit-admin.mjs`, `tests/admin-lib.test.js`, `README.md`) |

## Build sizes

| Artifact | Bytes |
| --- | --- |
| `admin/admin.js` | 40 768 (pass 4: 37 333) |
| `admin/lib/*.js` (13 files: 5 verbatim copies of `src/lib`, 8 admin libs) | 33 606 (pass 4: 28 461; `validate.js` 11 475) |
| admin JS budget line (`admin.js + lib`) | 74 374 of 81 920 |
| `admin/admin.css` | 7 465 |
| `admin/vendor/marked.esm.js` (reported separately, excluded from the budget) | 46 345 |
| `admin/index.html` | 22 604 |
| `admin/index.html` + `styles.css` (39 062) + `main.js` (25 977), the per-page budget measure | 87 643 of 153 600 (largest page: `posts/chhot-shahar-se-ai-career/` 22 810 → 87 849) |

CSP as shipped in `dist/admin/index.html` (pass 5: `img-src` is `https:` so the srcdoc preview, which inherits the policy, shows external images the build renders; raw.githubusercontent.com is covered by it):

```
default-src 'self'; connect-src 'self' https://api.github.com https://sudish007.github.io; img-src 'self' data: blob: https:; style-src 'self'; script-src 'self' 'sha256-ZWI26U6xbtgBkmqXWvoCBFJ5F7/NirY+iNzgFas29nc='; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'
```

(`sha256-…` is the hash of the layout's inline pre-paint script, recomputed by `tests/dist-admin.test.js`, which also asserts that the meta precedes the script it hashes — a meta CSP governs only what is parsed after it.) Zero `securitypolicyviolation` events and zero page errors were observed in all 30 audit contexts.

## `npm run audit:admin` — checks A–Z (P split into P / P2 / P3 in pass 4; M2 / M3 / W / W2 / X / Y / Z added in pass 5)

GitHub mock: `page.route("https://api.github.com/**")` (CORS preflights answered with 204 + `Access-Control-Allow-*`, `Access-Control-Expose-Headers: x-ratelimit-remaining, x-ratelimit-reset`) over an in-memory repo seeded from the six real `content/posts/*.md` (sha1 shas, 60-column base64 like GitHub); `raw.githubusercontent.com` returns a 1×1 PNG. Tokens: `ghp_FAKE_OK` (push), `ghp_FAKE_READONLY` (push false), `ghp_FAKE_RATE` (403 + `x-ratelimit-remaining: 0`), anything else 401.

| Check | Result |
| --- | --- |
| A lock | lock visible; dashboard/editor/activity hidden; none of the six titles in `body.innerText`; sign-in button enabled by JS; 0 CSP violations, 0 page errors; light under OS dark (`rgb(250, 246, 239)`, `theme-color #FAF6EF`) |
| B prepaint-dark | stored `theme=dark` → `data-theme="dark"`, `theme-color #15130F`, body `rgb(21, 19, 15)` on full load; same with `main.js` and `admin.js` aborted (inline hashed script alone), 0 CSP violations |
| C sign-in errors | 401 → `टोकन गलत बा या खतम हो गइल`; push:false → `एह repo पर लिखे के अधिकार नइखे`; rate limit → `GitHub rate limit — HH:MM पर फेर कोशिश करीं`; nothing stored; token never in `location.href` |
| D storage | OK unchecked → `sessionStorage` only, input cleared; sign-out → both empty + lock; OK + remember → `localStorage` only; sign-out → both empty |
| E hygiene | `ghp_FAKE_*` absent from `documentElement.outerHTML`, the activity log (4 lines), console (2 lines) and the URL after 21 mocked requests |
| F dashboard | 6 rows newest-first with title / title_en / date / category name from the real front matter, `प्रकाशित` chips, `देखीं` → `https://sudish007.github.io/ai-batkahi/posts/<slug>/` with `rel="noopener"`; `6 बतकही · 0 ड्राफ्ट`; deploy strip `आखिरी deploy (साइट बनावल): सफल · 3 मिनट पहिले` + run link |
| G delete | dialog for `06-data-ka-hola.md`; `wrong` keeps `#del-go` disabled and sends nothing; `data-ka-hola` enables; DELETE carried the original sha and `post: delete What is data, and why does AI need so much of it?`; file gone from the fake; 5 rows, `5 बतकही · 0 ड्राफ्ट` |
| H editor layout | 320/390/820/1440/2560 × light/dark: `scrollWidth <= clientWidth` on `<html>` and `#editor`; no text < 12 px; every visible a/button/input/select/textarea ≥ 40 px (checkbox measured as box ∪ `<label for>`); every input/select/textarea labelled; every text field's border vs its own background ≥ 3:1 (WCAG 1.4.11 — `--ink-muted` on `--bg`, 6.8:1 light / 7.0:1 dark; the earlier `--rule` border was 1.4:1). Found and fixed: the draft checkbox's target was 28–36 px → `.check label` now `min-height: var(--control)` |
| I slug | `Dry run post` → `dry-run-post`; existing `llm-kaise-bolela` + publish → `ई slug पहिले से बा` in `#errors` and `#f-slug-error`, dialog not opened |
| J validation | empty publish lists `#f-title #f-title-en #f-slug #f-tags #f-summary #f-summary-en #f-body`; focus on `#errors` |
| K preview | iframe `h2` ids `["section-1","second-part","section-3","in-english-heading"]` = Node `renderMarkdown()` + In English; `link[rel=stylesheet]` `/ai-batkahi/styles.css`, `body.page-post`, `lang="bho"`, external link `rel="noopener"`; header toggle → iframe `data-theme="dark"` (`rgb(21, 19, 15)`) and back; `#word-count` `149 शब्द` = `countWords()` |
| L autosave | `सहेजल · HH:MM` within 3.5 s under `batkahi.admin.draft.new`; reload → `#/new` shows the restore banner with empty fields; `वापस लाईं` restores body (697 chars), title, title_en, slug. For an existing post (`#/edit/02-llm-kaise-bolela.md`): no banner on a clean open; an edited body is saved under `batkahi.admin.draft.02-llm-kaise-bolela.md`; after `page.reload()` the form holds the remote body and the banner is visible; `वापस लाईं` restores the edit; the dashboard → edit path shows it too; `हटाईं` removes the key (the banner no longer depends on listing fetch time — it shows whenever the local copy differs from the loaded file) |
| T link dialog | `/posts/llm-kaise-bolela/` + `x` → `[x](/posts/llm-kaise-bolela/)` inserted at the caret (form `novalidate`, so root-relative links pass); `रद्द` closes the dialog with an invalid value and leaves the body unchanged |
| U delete via Enter | Enter in `#confirm-slug` with `wrong` → dialog stays open, 0 DELETE; with the right slug → DELETE with the original sha (200), `returnValue="ok"`, dialog closed, 5 rows; `रद्द` (`type="button"`) closes without deleting |
| V unsaved guard | `#/new` filled (title, title_en, category, 2 tags, summaries, body) → `वापस` → native `confirm` dismissed → hash still `#/new`, editor visible, all 9 fields, the tags and the draft box byte-equal to before, autosave written; accepting the next `वापस` reaches `#/` with the dashboard, `batkahi.admin.draft.new` is gone and reopening `#/new` shows an empty form with no restore banner. `#/edit/02-llm-kaise-bolela.md` with an edited summary and an added tag → dismissed → hash and every field unchanged (before the fix, the guard's `location.hash = …` fired `hashchange` → `openEditor()` → `fillForm()` and wiped the form; it now uses `history.replaceState`); accepted → that file's autosave key is gone and reopening shows the committed summary, no banner (pass 3: "छोड़ दीं" used to leave the copy behind and the next open offered the discarded edits back) |
| M image | 2000×1200 PNG (Chromium screenshot) → dialog `1600×960, 3 KB` → alt `परीक्षण` → PUT `content/images/dry-run-post/20261010-photo-test.webp` (3 274 B, `imageSize()` 1600×960) with `image: 20261010-photo-test.webp for dry-run-post [skip ci]`, no run created; `![परीक्षण](/images/dry-run-post/20261010-photo-test.webp)` inserted **at the caret (end of the body)** — pass 5 found that Chromium resets the textarea caret to 0 when the modal alt dialog closes, so the upload now remembers the selection before the dialog; preview `<img src>` is `blob:`. Chromium produced **WebP** |
| M2 multi-file drop | `DataTransfer` with `pehla.png` + `dusra.png` (1×1 PNGs) dispatched as `drop` on `#f-body` → alt dialog for the first (`1×1, 1 KB`), alt `पहिला` → PUT 201 `content/images/dry-run-post/20261010-pehla.webp` → only then the second dialog → alt `दूसरा` → PUT 201 `…-dusra.webp`; both `[skip ci]`, 0 runs; body ends `![पहिला](…pehla.webp)\n![दूसरा](…dusra.webp)` in that order after the M line; two `छवि अपलोड` activity lines; dialog closed (pass 5 MEDIUM: only the last file used to be uploaded) |
| M3 invalid slug | `#f-slug` = `My Slug` + a picked file → `slug में सिर्फ a-z, 0-9 आ -` on `#f-slug-error` and in `#errors`, focus on `#f-slug`, no dialog, 0 PUTs (pass 5 NIT: `PUT content/images/My Slug/…` used to happen) |
| N publish | PUT `content/posts/07-dry-run-post.md`, `post: Dry run post`, no sha; decoded file parses to the typed title/title_en/date/category `khabar`/tags/summary/summary_en, no `draft`, body unchanged; step 2 `कतार में` → `चलत बा` → `सफल`, step 3 live `https://sudish007.github.io/ai-batkahi/posts/dry-run-post/`, `#pub-result` `लाइव बा`, copy button, slug locked, autosave key removed. The 10 s polling was fast-forwarded with `page.clock.install()` + `page.clock.runFor(10500)` (available in Playwright 1.64); no real-time waiting |
| O failure | `failNext` → `08-dry-run-post-two.md`; step 2 `failed` / `असफल (failure)`, step 3 pending, `CI असफल — run देखीं, ठीक क के फेर प्रकाशित करीं`, run link = the run's `html_url`, no live link |
| P draft: box ticked + primary button | `#/new`, title + title_en only; before ticking: box off, primary `प्रकाशित करीं`, `#save-draft` visible; after `check("#f-draft")`: primary reads `ड्राफ्ट सहेजीं`, `#save-draft` hidden; click `#publish` → `09-dry-run-draft.md`, `draft: Dry run draft [skip ci]`, file starts `---\ndraft: true\n`, 0 runs created, steps 2–3 `deploy नइखे (ड्राफ्ट)`, `ड्राफ्ट सहेजल गइल (साइट पर ना देखाई)`; box still ticked afterwards (pass 4: this path used to commit a live post) |
| P2 draft: button with box unticked | `#/new`, box off, click `#save-draft` → `10-dry-run-draft-two.md`, `draft: Dry run draft two [skip ci]`, `draft: true` first, 0 runs; afterwards the form mirrors the file: box ticked, primary `ड्राफ्ट सहेजीं`, `#save-draft` hidden |
| P3 publish an opened draft | `#/edit/09-dry-run-draft.md` arrives with the box ticked / primary `ड्राफ्ट सहेजीं` / `#save-draft` hidden; fields filled, `uncheck("#f-draft")` → primary `प्रकाशित करीं`, `#save-draft` visible; `#publish` → PUT on the draft's path with the draft's sha (200), `post: Dry run draft`, decoded front matter has no `draft` key, exactly one run created, box stays cleared (pass 4: the box used to stay ticked after publishing a draft) |
| Q update | `#/edit/02-llm-kaise-bolela.md`: slug `readOnly`, heading `संपादन: ChatGPT जइसन AI कइसे बोलेला?`, all fields = the real file; summary changed → PUT with the previous sha (200), `post: How does an AI like ChatGPT talk?`, decoded front matter equal except summary, body byte-equal after trim |
| R stale sha | fake file mutated → PUT 409 → native `confirm` accepted → GET fresh sha → second PUT 200 with the fresh sha; step 1 done |
| W validator parity | `#/new` (slug `parity-post`, category `samajh`, one image uploaded first): each of `## एक … #### चार`, `## In English … #### Four`, `[x](about/)`, `[x](/posts/typo/)`, `![x](/images/parity-post/missing.webp)`, `[x](/category/khabar/)` (no post in khabar), `<a href="about/">` → `#publish` lists exactly one body error — `## के बाद #### नइखे चलेला — ### लगाईं`, `लिंक / से शुरू करीं (जइसे /posts/<slug>/) या पूरा https:// URL दीं: about/`, `ई लिंक साइट पर नइखे मिलत: /posts/typo/ — …`, `ई छवि साइट पर नइखे मिलत: … — छवि बटन से अपलोड करीं`, `ई लिंक साइट पर नइखे मिलत: /category/khabar/ — …`, `HTML टैग <a> मत लिखीं — ओकर Markdown रूप बरतीं` — on `#f-body-error` too, dialog closed, 0 commits (pass 5 MEDIUMs: the first two shapes committed and then failed CI) |
| W2 validator parity | category switched to `khabar`; body with `/posts/llm-kaise-bolela/`, the same with `#x`, `/about/`, `/posts/parity-post/` (its own page), `/category/khabar/` (made active by this post), the uploaded image, `https://example.com/x`, `### → ####` → committed: `content/posts/07-parity-post.md`, `post: Parity post`, body byte-equal, 0 errors |
| X external image in preview | `![बाहरी](https://example.com/a.png)` (routed to a 1×1 PNG) → preview `<img>` `complete`, `naturalWidth` 1, zero `img-src` CSP violations (pass 5 NIT: `img-src` lacked `https:`) |
| Y validator parity (edit) | fake seeded with `content/images/llm-kaise-bolela/purana.webp` and a `draft: true` post `09-draft-x.md`; `#/edit/02-llm-kaise-bolela.md`: `![x](/images/llm-kaise-bolela/nahi.webp)` → `ई छवि साइट पर नइखे मिलत …` (0 commits); `[x](/posts/draft-x/)` → `ई लिंक साइट पर नइखे मिलत: /posts/draft-x/ …` (0 commits — a draft has no page); `![पुरान](/images/llm-kaise-bolela/purana.webp)` (listed from the repository, not uploaded this session) → PUT 200 with the previous sha, 0 errors |
| Z sign-out flush | `#/new`, title typed, `#signout` invoked from script within 3 s (the button sits in the dashboard header, hidden while the editor is open) → `batkahi.admin.draft.new` holds the title, both token stores empty; sign in again → `#/new` shows the restore banner → `वापस लाईं` brings the title back |
| S screenshots | 12 viewport-only PNGs (`admin-{lock,dashboard,editor}-{390x844,1440x900}-{light,dark}.png`), header sizes = viewport, ≤ 4000 px |
| per-context | 30 contexts × (csp, pageErrors, tokenHygiene console/url) = 90 rows, all ok |

Admin defects fixed by this audit (in `public/admin/admin.css`): draft/remember checkbox labels are now 44 px tap targets; the inline links in the lock-screen help/security lists get `padding-block: 0.6em` so their hit boxes are ≥ 40 px at every width (they measured 22–29 px in the public matrix).

Review pass 2 fixes (verified by the rows above and by `npm test`): the dashboard cache-eviction race (gate flake, see Gates); the unsaved-changes guard (row V); `tests/dist-pages.test.js` no longer asserts a related-list size for the shipped six posts, and its ToC expectation counts `<h2>` in the rendered body so setext headings follow the renderer; `validate.js` rejects setext underlines (`शीर्षक खातिर ## लिखीं (=== / --- ना)`, unit-tested for `===` and `---`); a draft without `title_en` is committed as `draft: <slug> [skip ci]`.

Review pass 3 fixes: the setext rule in `validate.js` no longer pattern-matches line pairs (that rejected `---` inside a fenced code block, directly under a list item or a `>` quote, none of which render as a heading); it now asks the same Marked lexer the preview uses for heading tokens whose source does not start with `#`, walking list items and block quotes, so it rejects exactly what the build would render as a setext h1/h2. `tests/admin-lib.test.js` keeps `===` and `पैरा\n---` (plus a setext inside a quote and inside a list item) as must-fail and adds seven must-pass bodies: `---` in a ```` ```yaml ```` fence, `===`/`---` in a bare fence, `---` under a list item, under a quote, after a blank line, a GFM table delimiter row and a `## …` example inside a fence. The unsaved-changes guard's "छोड़ दीं" now removes the autosave it had just written (row V above); row L2 reaches the dashboard by a full load instead of the in-page `वापस`, since the latter would now discard the copy the row is about to restore.

Review pass 4 fixes. (1) The "ड्राफ्ट (साइट पर ना देखाई)" checkbox now decides what is committed: `publish()` reads it at click time (`isDraft = draft || data.draft === true`, where `draft` is only the "ड्राफ्ट सहेजीं" button's flag) and uses that one value for validation, `serialize()`, the commit message, the cached post and the dialog steps; after a successful commit the box is set to the committed state. The primary button's label follows the box (`प्रकाशित करीं` ↔ `ड्राफ्ट सहेजीं`) and the separate draft button is hidden while the box is ticked, so the two buttons never promise different things. Rows P / P2 / P3 above prove ticked + primary → `draft: true` + `[skip ci]`, button with box off → `draft: true` + box ticked afterwards, and opened draft + untick + primary → no `draft` key + a run. Sweep of every other control read at submit time: `formData()` reads title, title_en, slug, date, category, summaries and instagram from the inputs when `publish()` runs; tags come from the chip list, and a pending `#f-tags` value is committed on blur (clicking any button) or by the tags input's own Enter handler, which runs before the form's Ctrl+Enter handler; `#remember` is read in `signIn`'s submit handler; `#confirm-slug` on the delete form's submit; the link and image dialogs read their fields in `close`. No submit path caches a control value. (2) Every structure rule in `validate.js` is decided by the heading tokens of the injected Marked lexer (`allHeadings()` walks list items and block quotes in document order): the h1 ban (ATX depth-1 tokens), setext (non-ATX tokens), `###` before `##` (first depth-3 index vs first depth-2 index), and the In-English rule (exactly one ATX depth-2 `In English`, last of the h2s). Because the build's `splitInEnglish` is still a line regex, the rule additionally requires that regex's first match to sit at the top-level offset of that heading token (sum of preceding top-level `raw` lengths — the lexer consumes the source token by token), so a fenced `## In English` *before* the real heading, a `> ## In English` or an indented `  ## In English` are rejected (the build would cut at the wrong place or not at all) while a fenced one *after* it passes. `hints()` now takes the lexer and counts depth-2 tokens of the part before the cut. `tests/admin-lib.test.js` adds must-pass bodies — one fence holding `# h1`, `### h3`, `---`, `===`; a fenced `# शीर्षक`; a fenced `### छोट` above the first `##`; a fenced `## उदाहरण` and a fenced `## In English` after the real heading; 4-space-indented `# h1` / `### h3` / `## In English` — and must-fail counterparts for the same lines unfenced (`# h1`, `### h3`, trailing `## उदाहरण`) plus the three mis-split cases, and two `hints()` cases (fenced `##` lines are not sections; a quoted `> ## दू` is, as `extractToc` counts it).

Review pass 5 fixes (0 HIGH, 3 MEDIUM, 4 NIT; the review loop ended here). **Validator parity with CI** — `validate.js` now rejects everything the dist tests reject about a body, decided from the lexer's tokens (one walk over headings, links/images and raw-HTML tokens, descending into inline tokens, list items, quotes and table cells): (1) heading depth — the title is the page's h1, so the first heading must be `##` and each later one at most one level deeper than the previous, the template's In English h2 included (`## के बाद #### नइखे चलेला — ### लगाईं`; the first heading being `###`/`####` keeps `### से पहिले ## चाहीं`); (2) links and images — `tests/dist-links.test.js` skips exactly `https?:`, `mailto:`, `data:` and `#…`, so everything else must start with `/` (`लिंक / से शुरू करीं (जइसे /posts/<slug>/) या पूरा https:// URL दीं: …`) and, fragment/query stripped and trailing `/` or `/index.html` optional, be one of the paths the admin passes as `knownPaths` (`ई लिंक साइट पर नइखे मिलत: …` / `ई छवि साइट पर नइखे मिलत: … — छवि बटन से अपलोड करीं`); `admin.js` `sitePaths()` builds that set at publish time from the posts' front matter (every non-draft post's `/posts/<slug>/`, the categories those posts use plus this post's category as `/category/<slug>/`, this post's own slug, `SITE_PAGES` = `/`, `/posts/`, `/about/`, `/feed.xml`, this session's uploads, and the Contents-API listing of every `/images/<dir>/` the body references, cached per session — posts not yet fetched by the dashboard are fetched here, so `#/new` opened directly costs one GET per post once); (3) raw HTML the page tests judge as markup (`<a>`, `<img>`, `<h1>`–`<h6>`, `<svg>`, `<script>`) → `HTML टैग <a> मत लिखीं — ओकर Markdown रूप बरतीं`; (4) the words `tests/dist-pages.test.js` bans from every page (`lorem`, `coming soon`, `follower`, `trusted by`, `testimonial`) in title, title_en, summary, summary_en (they reach `<title>`, the description and the prev/next nav); (5) a fenced `## In English` before the real one now says `` `## In English` लाइन कोड ब्लॉक में भी मत लिखीं — build ओहिजे काटेला`` instead of the missing-section message. `tests/validate-parity.test.js` (a) runs every `content/posts/*.md` through the validator with repository-derived paths and (b) holds 35 fixtures, each judged by a CI oracle made of the dist tests' own regexes/`resolveInternal()` applied to the rendered post page: 24 must-fail bodies/fields that the oracle rejects AND the validator rejects (ATX/setext h1, `###`/`####` first, `## → ####` in the body and under In English, `### → #####`, no In English, relative/parent-relative links, unknown slug, unknown root path, `/admin/`, uppercase scheme, category without posts, missing/relative image, raw `<h4>`/`<a>`/external `<a>` without rel/`<img>` without alt/`<script>`, banned word in title and summary_en), 3 admin-only rules (In English not last, twice, fenced before — the build accepts the file but renders the wrong thing), 8 must-pass bodies both accept (plain, `## → ### → ####` on both sides, every known-link form incl. `#x`, `?q`, `/index.html`, no trailing slash, every external form, links inside heading/list/quote/table, fenced and code-span pseudo markup, harmless inline HTML, a committed image), the self-link case, an inventory check that the fixtures cover `dist-admin`, `dist-lang`, `dist-links`, `dist-pages` and `posts.js`, and `SITE_PAGES` resolving in `dist/`. Audit rows W / W2 / Y reproduce the reviewer's end-to-end cases in the UI. **Multi-file upload** — the drop/paste/change handlers queue files on `state.uploadQueue` so `uploadImage()` runs one file at a time (each with its own alt dialog and Markdown line, in order); `askImage()` throws if the dialog is already open; found on the way: Chromium resets the textarea caret to 0 when a modal dialog hands focus back, so every upload now remembers the selection before its dialog and inserts there (rows M and M2 assert the position). **NITs** — the slug is checked with the exported `isValidSlug` before any resize/PUT (`slug में सिर्फ a-z, 0-9 आ -`, row M3); the admin CSP `img-src` is `'self' data: blob: https:` so external images render in the preview (row X; `tests/dist-admin.test.js` updated); `signOut()` flushes a dirty editor to the autosave first (row Z — note `#signout` lives in the dashboard header, which is hidden while the editor is open, so the row invokes it from script); the fenced-In-English message (above).

Not exercised: the real GitHub API (no token), Firefox/Safari, the 10-minute poll cap, `QuotaExceededError`, the old-browser notice, the image-overwrite `confirm`, a `listDir` failure during `sitePaths()` (shown as a body error `छवि सूची: …`; 401 locks the page), literal-phrase collisions the page tests could still trip on (a body containing the text `पढ़े में ~N मिनट`, `class="share"` or `rail-meta` in raw HTML).

---

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

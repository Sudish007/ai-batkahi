// Owner-only admin page (dist/admin/index.html). Static markup only: the
// module public/admin/admin.js toggles `hidden`/classes, never styles, so the
// Content-Security-Policy below can forbid inline styles and allow exactly
// one inline script — the layout's PREPAINT, pinned by its sha256 hash.
import { createHash } from "node:crypto";
import config from "../../site.config.js";
import { url } from "../lib/urls.js";
import { escapeHtml } from "../lib/xml.js";
import { layout, PREPAINT } from "./layout.js";

const { owner, name: repoName, branch } = config.repo;
const repoUrl = `https://github.com/${owner}/${repoName}`;

function field({ id, label, type = "text", lang, hint, extra = "" }) {
  const tag =
    type === "textarea"
      ? `<textarea id="${id}" rows="3"${lang ? ` lang="${lang}"` : ""}></textarea>`
      : `<input id="${id}" type="${type}"${lang ? ` lang="${lang}"` : ""} autocomplete="off"${extra}>`;
  return `<div class="field">
  <label for="${id}">${label}</label>
  ${tag}
  <p class="hint" id="${id}-hint">${hint || ""}</p>
  <p class="field-error" id="${id}-error" role="alert" hidden></p>
</div>`;
}

export function adminPage({ categories }) {
  const hash = createHash("sha256").update(PREPAINT).digest("base64");
  const siteOrigin = new URL(config.siteUrl).origin;
  const siteHost = new URL(config.siteUrl).host;
  const csp =
    `default-src 'self'; connect-src 'self' https://api.github.com ${siteOrigin}; ` +
    // https: so the srcdoc preview (which inherits this policy) shows external
    // images exactly as the build renders them, besides raw.githubusercontent.com.
    "img-src 'self' data: blob: https:; style-src 'self'; " +
    `script-src 'self' 'sha256-${hash}'; frame-src 'self' blob:; object-src 'none'; ` +
    "base-uri 'none'; form-action 'self'";

  const options = categories
    .map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`)
    .join("");
  const toolbar = [
    ["h2", "H2"],
    ["bold", "मोटा"],
    ["italic", "तिरछा"],
    ["link", "लिंक"],
    ["list", "सूची"],
    ["quote", "उद्धरण"],
    ["code", "कोड"],
    ["image", "छवि"],
  ]
    .map(([md, label]) => `<button type="button" data-md="${md}">${label}</button>`)
    .join("");

  const adminConfig = JSON.stringify({
    owner,
    repo: repoName,
    branch,
    siteUrl: config.siteUrl,
    basePath: config.basePath,
    wordsPerMinute: config.wordsPerMinute,
    stylesheet: url("styles.css"),
    categories: categories.map((c) => ({ slug: c.slug, name: c.name })),
  }).replace(/</g, "\\u003c");

  const body = `<header class="page-header">
  <p class="eyebrow"><span lang="en">Admin</span> · सिर्फ मालिक खातिर</p>
  <h1>संपादक</h1>
  <p class="lede">बतकही लिखे, सुधारे आ प्रकाशित करे के जगह। ई पन्ना सिर्फ रउआ (मालिक) खातिर बा — बिना GitHub token (टोकन) एह से कुछ ना हो सके।</p>
</header>
<section id="lock" aria-labelledby="lock-heading">
  <h2 id="lock-heading">साइन इन</h2>
  <p class="form-error" id="browser-notice" role="alert" hidden></p>
  <form id="signin" method="post" novalidate>
    <label for="token">GitHub token</label>
    <input id="token" name="token" type="password" autocomplete="off" spellcheck="false" required>
    <div class="check"><input id="remember" type="checkbox"><label for="remember">ई डिवाइस पर याद राखीं</label></div>
    <p class="hint" id="remember-hint">याद राखला पर token एह ब्राउज़र के localStorage में रहेला — ${siteHost} के बाकी साइट भी ओही storage देख सकेली। बिना टिक कइले ई सिर्फ एह tab तक (sessionStorage) रहेला।</p>
    <button type="submit" id="signin-btn" disabled>साइन इन</button>
    <p class="form-error" id="signin-error" role="alert" hidden></p>
    <noscript><p>एह पन्ना खातिर JavaScript जरूरी बा।</p></noscript>
  </form>
</section>
<section class="help" aria-labelledby="help-heading">
  <h2 id="help-heading">टोकन कइसे बनाईं</h2>
  <ol>
    <li>GitHub पर <a href="https://github.com/settings/personal-access-tokens/new" rel="noopener" lang="en">github.com/settings/personal-access-tokens/new</a> खोलीं (fine-grained token)।</li>
    <li><span lang="en">Token name</span>: <span lang="en">ai-batkahi admin</span>; <span lang="en">Expiration</span>: 90 दिन या कम।</li>
    <li><span lang="en">Repository access</span> → <span lang="en">Only select repositories</span> → <span lang="en">${owner}/${repoName}</span> चुनीं।</li>
    <li><span lang="en">Repository permissions</span>: <span lang="en">Contents</span> → <span lang="en">Read and write</span>; <span lang="en">Actions</span> → <span lang="en">Read-only</span>। आउर कुछ ना।</li>
    <li><span lang="en">Generate token</span> दबाईं, token कॉपी करीं आ ऊपर के खाना में चिपकाईं।</li>
  </ol>
</section>
<section class="security" aria-labelledby="security-heading">
  <h2 id="security-heading">सुरक्षा के बात</h2>
  <ul>
    <li>Token सिर्फ एह ब्राउज़र में रहेला; ई कबो सर्वर पर ना जाला — सिर्फ api.github.com पर।</li>
    <li>जे केहू एह ब्राउज़र profile के इस्तेमाल करेला, ऊ पोस्ट प्रकाशित कर सकेला। साझा कंप्यूटर पर "याद राखीं" मत टिक करीं आ काम के बाद साइन आउट करीं।</li>
    <li>Token कबो भी <a href="https://github.com/settings/tokens" rel="noopener" lang="en">github.com/settings/tokens</a> पर रद्द (revoke) कर सकीलें।</li>
    <li>${siteHost} पर के सब पन्ना (जइसे bhojverse-site) एके origin बा — storage साझा होला, एही से default sessionStorage बा।</li>
  </ul>
</section>
<section class="limits" aria-labelledby="limits-heading">
  <h2 id="limits-heading">सीमा</h2>
  <ul>
    <li>प्रकाशित होखे में लगभग एक मिनट लागेला — GitHub Actions साइट बनावेला।</li>
    <li>Admin सिर्फ मालिक के ब्राउज़र में चलेला; कवनो सर्वर, कवनो डेटाबेस नइखे।</li>
    <li>एक लेखक; comments, analytics, multi-user नइखे।</li>
    <li>ब्राउज़र: Chromium/Edge 120+, Firefox 120+, Safari 17+।</li>
  </ul>
</section>
<section id="dashboard" hidden aria-labelledby="dash-heading">
  <div class="dash-head">
    <h2 id="dash-heading">सब बतकही</h2>
    <p id="dash-count"></p>
    <p id="deploy-status" role="status"></p>
    <div class="actions">
      <button type="button" id="new-post">नया बतकही</button>
      <button type="button" id="signout">साइन आउट</button>
    </div>
  </div>
  <ul id="post-list" class="post-rows" aria-busy="false"></ul>
  <p class="empty" id="dash-empty" hidden>अबहीं कवनो बतकही नइखे।</p>
  <p class="form-error" id="dash-error" role="alert" hidden></p>
  <button type="button" id="dash-retry" hidden>फेर कोशिश करीं</button>
</section>
<section id="editor" hidden aria-labelledby="editor-heading">
  <h2 id="editor-heading">नया बतकही</h2>
  <p class="restore" id="restore" hidden>असहेजल बदलाव मिलल। <button type="button" id="restore-yes">वापस लाईं</button> <button type="button" id="restore-no">हटाईं</button></p>
  <form id="post-form" novalidate>
    <div class="editor-grid">
      <div class="fields">
${field({ id: "f-title", label: "शीर्षक (भोजपुरी)" })}
${field({ id: "f-title-en", label: "Title (English)", lang: "en" })}
${field({ id: "f-slug", label: "slug (URL नाम)", hint: "सिर्फ a-z, 0-9 आ -; title_en से अपने बन जाला" })}
${field({ id: "f-date", label: "तारीख", type: "date" })}
<div class="field">
  <label for="f-category">विषय</label>
  <select id="f-category">${options}</select>
  <p class="hint" id="f-category-hint"></p>
  <p class="field-error" id="f-category-error" role="alert" hidden></p>
</div>
<div class="field">
  <div class="chips" role="group" aria-labelledby="tags-label">
    <span id="tags-label">टैग</span>
    <ul id="tag-list"></ul>
    <label class="visually-hidden" for="f-tags">नया टैग</label>
    <input id="f-tags" type="text" autocomplete="off">
  </div>
  <p class="hint" id="f-tags-hint">Enter या , से जोड़ीं; 1 से 8 टैग</p>
  <p class="field-error" id="f-tags-error" role="alert" hidden></p>
</div>
<div class="field">
  <label for="f-summary">सार (भोजपुरी)</label>
  <textarea id="f-summary" rows="3"></textarea>
  <p class="hint" id="f-summary-hint"><span class="count" id="summary-count">0 / 300</span></p>
  <p class="field-error" id="f-summary-error" role="alert" hidden></p>
</div>
<div class="field">
  <label for="f-summary-en">Summary (English)</label>
  <textarea id="f-summary-en" rows="3" lang="en"></textarea>
  <p class="hint" id="f-summary-en-hint"><span class="count" id="summary-en-count">0 / 300</span></p>
  <p class="field-error" id="f-summary-en-error" role="alert" hidden></p>
</div>
${field({ id: "f-instagram", label: "Instagram लिंक (वैकल्पिक)", type: "url" })}
<div class="field">
  <div class="check"><input id="f-draft" type="checkbox"><label for="f-draft">ड्राफ्ट (साइट पर ना देखाई)</label></div>
</div>
      </div>
      <div class="body-pane">
        <div class="toolbar" role="toolbar" aria-label="फॉर्मैटिंग">${toolbar}</div>
        <label for="f-body">बतकही (Markdown)</label>
        <textarea id="f-body" rows="24" spellcheck="false"></textarea>
        <p class="field-error" id="f-body-error" role="alert" hidden></p>
        <label class="visually-hidden" for="f-image">छवि फाइल</label>
        <input id="f-image" type="file" accept="image/*" class="visually-hidden" tabindex="-1">
        <p class="status-line" id="status-line"><span id="word-count">0 शब्द</span> · <span id="read-time">~1 मिनट</span> · <span id="save-state">असहेजल</span></p>
        <p class="hint" id="toc-hint" hidden>2 से कम ## खंड: ToC ना बनी</p>
      </div>
      <div class="preview-pane">
        <button type="button" id="preview-toggle" aria-expanded="false" aria-controls="preview-wrap">पूर्वावलोकन देखाईं</button>
        <div id="preview-wrap" hidden><iframe id="preview" sandbox="allow-same-origin" title="पूर्वावलोकन"></iframe></div>
      </div>
    </div>
    <ul id="errors" class="errors" role="alert" tabindex="-1"></ul>
    <div class="actions">
      <button type="button" id="save-draft">ड्राफ्ट सहेजीं</button>
      <button type="submit" id="publish">प्रकाशित करीं</button>
      <button type="button" id="back">वापस</button>
    </div>
  </form>
</section>
<dialog id="confirm-delete" class="admin-dialog" aria-labelledby="del-heading">
  <form method="dialog">
    <h2 id="del-heading">बतकही हटाईं?</h2>
    <p id="del-text"></p>
    <label for="confirm-slug">पक्का करे खातिर slug लिखीं</label>
    <input id="confirm-slug" type="text" autocomplete="off">
    <div class="actions"><button type="submit" id="del-go" value="ok" disabled>हटाईं</button><button type="button" id="del-cancel">रद्द</button></div>
  </form>
</dialog>
<dialog id="publish-dialog" class="admin-dialog" aria-labelledby="pub-heading">
  <h2 id="pub-heading">प्रकाशित करत बानी</h2>
  <p id="pub-file" lang="en"></p>
  <p class="hint">प्रकाशित होखे में लगभग एक मिनट लागेला (GitHub Actions): commit (बदलाव दर्ज) → run (Actions चलाव) → deploy (साइट बनावल)।</p>
  <ol class="steps" id="pub-steps">
    <li data-state="pending"><span class="step-label">फाइल कमिट</span> <span class="step-status"></span></li>
    <li data-state="pending"><span class="step-label">Pages build</span> <span class="step-status"></span></li>
    <li data-state="pending"><span class="step-label">लाइव</span> <span class="step-status"></span></li>
  </ol>
  <p id="pub-result" role="status"></p>
  <p><a id="run-link" href="${repoUrl}/actions" rel="noopener" hidden lang="en">Actions run देखीं</a> <a id="live-link" href="${config.siteUrl}/" rel="noopener" hidden>लाइव बतकही खोलीं</a></p>
  <div class="actions"><button type="button" id="copy-live" hidden>लिंक कॉपी करीं</button><button type="button" id="pub-close">बंद करीं</button></div>
</dialog>
<dialog id="link-dialog" class="admin-dialog">
  <form method="dialog" novalidate>
    <h2>लिंक जोड़ीं</h2>
    <label for="link-url">URL</label>
    <input id="link-url" type="url">
    <label for="link-text">लिखाई</label>
    <input id="link-text" type="text">
    <div class="actions"><button type="submit" value="ok">जोड़ीं</button><button type="submit" value="cancel">रद्द</button></div>
  </form>
</dialog>
<dialog id="image-dialog" class="admin-dialog">
  <form method="dialog">
    <h2>छवि के बारे में</h2>
    <p id="image-info"></p>
    <label for="image-alt">alt (छवि के बयान)</label>
    <input id="image-alt" type="text">
    <div class="check"><input id="image-decorative" type="checkbox"><label for="image-decorative">सजावटी (alt खाली)</label></div>
    <p class="field-error" id="image-error" role="alert" hidden></p>
    <div class="actions"><button type="submit" value="ok">अपलोड करीं</button><button type="submit" value="cancel">रद्द</button></div>
  </form>
</dialog>
<section id="activity" aria-labelledby="activity-heading" hidden>
  <h2 id="activity-heading">गतिविधि</h2>
  <ol id="activity-list" aria-live="polite"></ol>
</section>
<script type="application/json" id="admin-config">${adminConfig}</script>`;

  return layout({
    title: "संपादक",
    description: "AI Batkahi admin (owner only).",
    path: "admin/",
    body,
    bodyClass: "page-admin",
    mainClass: "container admin",
    noindex: true,
    // The CSP must precede the inline pre-paint script it hashes, or the hash gates nothing.
    headStart: `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    head: `<link rel="stylesheet" href="${url("admin/admin.css")}">`,
    foot: `<script type="module" src="${url("admin/admin.js")}"></script>`,
  });
}

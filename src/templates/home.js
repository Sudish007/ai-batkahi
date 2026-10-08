import config from "../../site.config.js";
import { url } from "../lib/urls.js";
import { escapeHtml } from "../lib/xml.js";
import { layout } from "./layout.js";
import { postGrid } from "./partials.js";

export function homePage({ posts, activeCategories = [], categoryCounts = [] }) {
  // Kinetic word slot: every pair is in the HTML; the first carries data-on so
  // the hero is complete without JS. The button's accessible name is its visible
  // content (no aria-label), the hint explains the click.
  const slotItems = config.heroWords
    .map(
      (w, i) =>
        `<span class="slot-item"${i === 0 ? " data-on" : ""}><span class="slot-word">${escapeHtml(w.word)}</span><span class="slot-gloss" lang="en">${escapeHtml(w.gloss)}</span></span>`
    )
    .join("");

  const vishay = categoryCounts
    .map(
      ({ category, count }) => `<li class="reveal"><a href="${url(`category/${category.slug}/`)}"><h3>${escapeHtml(category.name)}</h3><p>${escapeHtml(category.description)}</p><p class="vishay-count">${count} बतकही</p></a></li>`
    )
    .join("\n");

  const body = `<section class="hero container" aria-labelledby="site-title">
  <p class="eyebrow dict"><span class="dict-word">बतकही</span> <span class="dict-pron" lang="en">/ bat·ka·hi /</span> <span class="dict-gloss" lang="en">a conversation on the <span lang="bho">दुआर</span>, unhurried</span></p>
  <div class="hero-main">
    <h1 class="display" id="site-title">${escapeHtml(config.titleDevanagari)}<span class="visually-hidden"> — ${escapeHtml(config.title)}</span></h1>
    <p class="tagline">${escapeHtml(config.tagline)}</p>
    <p class="slot-line"><span class="slot-frame">AI के शब्द, आपन बोली में</span> <button class="slot" type="button" disabled aria-describedby="slot-hint">${slotItems}</button> <span class="visually-hidden" id="slot-hint">अगिला शब्द खातिर दबाईं</span></p>
  </div>
  <div class="hero-foot">
    <a class="scroll-cue" href="#latest">नया बतकही पढ़ीं <span class="arrow" aria-hidden="true">↓</span></a>
    <p class="hero-facts"><span>${posts.length} बतकही</span><span>${activeCategories.length} विषय</span><span lang="en">${escapeHtml(config.instagramHandle)}</span></p>
  </div>
</section>

<section class="section container" id="latest" aria-labelledby="latest-heading">
  <div class="section-head">
    <h2 id="latest-heading">नया बतकही</h2>
    <a href="${url("posts/")}">सब बतकही देखीं</a>
  </div>
  <p class="intro">${escapeHtml(config.title)} एगो नया ब्लॉग आ Instagram पेज बा, जे ${escapeHtml(config.startedLabel)} में शुरू भइल। इहाँ हम AI, machine learning आ data science के बात आपन भोजपुरी में, सीधा-सादा ढंग से करत बानी।</p>
  ${postGrid(posts, { kind: "bento", headingLevel: 3 })}
</section>

<section class="section container" id="vishay" aria-labelledby="vishay-heading">
  <div class="section-head">
    <h2 id="vishay-heading">बतकही के विषय</h2>
  </div>
  <ul class="vishay">
${vishay}
  </ul>
</section>

<aside class="cta container" aria-label="Instagram">
  <p class="eyebrow"><span lang="en">Instagram</span></p>
  <a class="insta-handle" href="${config.instagramUrl}" rel="noopener" lang="en">${escapeHtml(config.instagramHandle)}</a>
  <p>छोट-छोट बतकही Instagram पर भी — <a href="${config.instagramUrl}" rel="noopener">${escapeHtml(config.instagramHandle)}</a></p>
</aside>`;

  return layout({
    title: "",
    description: config.description,
    path: "",
    body,
    bodyClass: "page-home",
    mainClass: "",
  });
}

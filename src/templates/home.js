import config from "../../site.config.js";
import { escapeHtml } from "../lib/xml.js";
import { layout } from "./layout.js";
import { postList } from "./partials.js";

export function homePage({ posts }) {
  const body = `<section class="hero">
  <h1 class="display">${escapeHtml(config.title)} <span class="display-dev">${escapeHtml(config.titleDevanagari)}</span></h1>
  <p class="tagline">${escapeHtml(config.tagline)}</p>
  <p class="intro">${escapeHtml(config.title)} एगो नया ब्लॉग आ Instagram पेज बा, जे ${escapeHtml(config.startedLabel)} में शुरू भइल। इहाँ हम AI, machine learning आ data science के बात आपन भोजपुरी में, सीधा-सादा ढंग से करत बानी।</p>
</section>

<section class="latest" aria-labelledby="latest-heading">
  <h2 id="latest-heading" class="section-title">नया बतकही</h2>
  ${postList(posts, { headingLevel: 3 })}
</section>

<aside class="cta">
  <p>छोट-छोट बतकही Instagram पर भी — <a href="${config.instagramUrl}" rel="noopener">${escapeHtml(config.instagramHandle)}</a></p>
</aside>`;

  return layout({
    title: "",
    description: config.description,
    path: "",
    body,
    bodyClass: "page-home",
  });
}

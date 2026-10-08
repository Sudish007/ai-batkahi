import config from "../../site.config.js";
import { url } from "../lib/urls.js";
import { escapeHtml } from "../lib/xml.js";
import { layout } from "./layout.js";

export function aboutPage({ activeCategories, allCategories }) {
  const activeSlugs = new Set(activeCategories.map((c) => c.slug));
  const pillars = allCategories
    .map((c) => {
      // A pillar with zero posts has no page: plain text, never an <a>.
      const name = activeSlugs.has(c.slug)
        ? `<a href="${url(`category/${c.slug}/`)}">${escapeHtml(c.name)}</a>`
        : `${escapeHtml(c.name)} <span class="pillar-note">अबहीं पोस्ट नइखे</span>`;
      return `    <div class="pillar">
      <dt>${name} <span class="slug-hint" lang="en">${escapeHtml(c.slug)}</span></dt>
      <dd>${escapeHtml(c.description)}</dd>
    </div>`;
    })
    .join("\n");

  const body = `<article class="prose about">
  <header class="page-header">
    <h1>हमरा बारे में</h1>
  </header>

  <h2>AI Batkahi का ह</h2>
  <p>${escapeHtml(config.title)} एगो ब्लॉग आ Instagram पेज बा, जे ${escapeHtml(config.startedLabel)} में शुरू भइल। इहाँ AI (artificial intelligence), machine learning आ data science के बात भोजपुरी में होला — ना ऊँच-ऊँच अंग्रेजी, ना बाजारू वादा। "बतकही" माने बातचीत; हर पोस्ट एगो बतकही बा, जइसे दुआर पर बइठ के केहू समझावत होखे।</p>
  <p>मकसद सीधा बा: जे लोग भोजपुरी में सोचेला, ओकरा AI के समझ आपन भाषा में मिले — का होला, कइसे बरतल जाए, कहाँ सावधान रहल जाए, आ सीखे के रास्ता कहाँ से खुलेला।</p>

  <h2>चार विषय</h2>
  <dl class="pillars">
${pillars}
  </dl>

  <h2>के बनावेला</h2>
  <p>${escapeHtml(config.author.name)}। हम <a href="${config.bhojverseUrl}" rel="noopener">BhojVerse</a> नाम के भोजपुरी सीखे वाला ऐप भी बनवले बानी — ई साइट ओही बनावे वाला के ओर से बा। हमार कोड <a href="${config.author.github}" rel="noopener">GitHub</a> पर आ बाकी बात <a href="${config.author.site}" rel="noopener">sudish.dev</a> पर मिली।</p>
  <p>छोट-छोट बतकही Instagram पर भी: <a href="${config.instagramUrl}" rel="noopener">${escapeHtml(config.instagramHandle)}</a>।</p>

  <h2>एगो ईमानदार बात</h2>
  <p>जहाँ हमरा पक्का ना मालूम, उहाँ हम कम कहब, बनावब ना। भोजपुरी लिखाई में कवनो चूक लागे त Instagram पर बताईं — सुधार होई।</p>
</article>`;

  return layout({
    title: "हमरा बारे में",
    description: `About ${config.title}: AI, machine learning and data science explained in Bhojpuri, by ${config.author.name}, maker of the BhojVerse Bhojpuri-learning app.`,
    path: "about/",
    body,
    bodyClass: "page-about",
  });
}

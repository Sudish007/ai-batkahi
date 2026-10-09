// Single source of truth for site-wide values.
// To move to a custom domain later: change siteUrl, set basePath to "/",
// and add public/CNAME containing the domain. See README.md.
export default {
  siteUrl: "https://sudish007.github.io/ai-batkahi",
  basePath: "/ai-batkahi/",
  title: "AI Batkahi",
  titleDevanagari: "एआई बतकही",
  tagline: "AI के बतकही, आपन भाषा में",
  description:
    "AI Batkahi — AI, machine learning and data science explained in plain Bhojpuri. A blog and Instagram page by Sudish Kumar.",
  instagramUrl: "https://www.instagram.com/batkahi/",
  instagramHandle: "@batkahi",
  author: {
    name: "Sudish Kumar",
    github: "https://github.com/Sudish007",
    site: "https://sudish.dev",
  },
  // The GitHub repository the browser admin (dist/admin/) commits to.
  repo: { owner: "Sudish007", name: "ai-batkahi", branch: "main" },
  bhojverseUrl: "https://sudish007.github.io/bhojverse-site/",
  bhojverseRepo: "https://github.com/Sudish007/bhojverse-site",
  startedLabel: "अक्टूबर 2026",
  copyrightYear: 2026,
  wordsPerMinute: 180,
  feedLimit: 20,
  // Home hero word slot: Bhojpuri word + English gloss, cycled by main.js.
  heroWords: [
    { word: "अटकल", gloss: "prediction" },
    { word: "खलिहान", gloss: "signal / noise" },
    { word: "बुझक्कड़", gloss: "inference" },
    { word: "समुझ", gloss: "understanding" },
    { word: "गहिर", gloss: "deep learning" },
    { word: "पोखरा", gloss: "data lake" },
  ],
};

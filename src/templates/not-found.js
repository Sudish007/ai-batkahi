import { url } from "../lib/urls.js";
import { layout } from "./layout.js";

export function notFoundPage() {
  const body = `<section class="not-found">
  <h1>ई पन्ना नइखे मिलल।</h1>
  <p class="lede">लिंक पुरान हो सकेला, या पता में कुछ चूक भइल बा।</p>
  <ul class="link-row">
    <li><a href="${url("")}">घरे चलीं</a></li>
    <li><a href="${url("posts/")}">सब बतकही</a></li>
  </ul>
</section>`;

  return layout({
    title: "पन्ना नइखे मिलल",
    description: "Page not found.",
    path: "404.html",
    body,
    bodyClass: "page-404",
    noindex: true,
  });
}

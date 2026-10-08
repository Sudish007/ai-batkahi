// Exact font files copied into dist/fonts (devanagari + latin subsets only).
// Shared by build.js (copy) and layout.js (preloads).
export const FONT_FILES = [
  ["@fontsource/tiro-devanagari-hindi", "tiro-devanagari-hindi-devanagari-400-normal.woff2"],
  ["@fontsource/tiro-devanagari-hindi", "tiro-devanagari-hindi-latin-400-normal.woff2"],
  ["@fontsource/noto-sans-devanagari", "noto-sans-devanagari-devanagari-400-normal.woff2"],
  ["@fontsource/noto-sans-devanagari", "noto-sans-devanagari-devanagari-700-normal.woff2"],
  ["@fontsource/noto-sans-devanagari", "noto-sans-devanagari-latin-400-normal.woff2"],
  ["@fontsource/noto-sans-devanagari", "noto-sans-devanagari-latin-700-normal.woff2"],
];

// dist-relative paths, e.g. "fonts/tiro-devanagari-hindi-devanagari-400-normal.woff2".
export function fontUrls() {
  return FONT_FILES.map(([, file]) => `fonts/${file}`);
}

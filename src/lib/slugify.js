// Latin-only slug: lower-case letters and digits separated by single hyphens.
export function slugify(input) {
  return String(input)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// "03-ai-se-sahi-sawal.md" -> "ai-se-sahi-sawal"
export function slugFromFilename(filename) {
  const stem = String(filename).replace(/\.(md|markdown)$/i, "");
  const withoutPrefix = stem.replace(/^\d+-/, "");
  return slugify(withoutPrefix);
}

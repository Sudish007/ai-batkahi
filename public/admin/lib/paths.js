// Repository path helpers for posts and images. Imports nothing; `slugify`
// is passed in so this file stays a byte-independent admin module.
const POST_FILE = /^(\d+)-(.+)\.md$/;

// "07-x-y.md" -> "x-y"
export function postSlugFromName(name) {
  const m = POST_FILE.exec(String(name));
  return m ? m[2] : String(name).replace(/\.md$/, "");
}

export function existingSlugs(files) {
  return files.filter((f) => POST_FILE.test(f)).map(postSlugFromName);
}

// Next zero-padded numeric prefix after the highest existing one (01 when empty).
export function nextPostPath(files, slug) {
  let max = 0;
  for (const f of files) {
    const m = POST_FILE.exec(f);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `content/posts/${String(max + 1).padStart(2, "0")}-${slug}.md`;
}

const localSlugify = (s) =>
  String(s)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// "My Photo.PNG", "webp" -> "20261009-my-photo.webp"
export function imageFileName(originalName, ext, date = new Date(), slugify = localSlugify) {
  const stem = String(originalName).replace(/\.[^.]*$/, "");
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `${ymd}-${slugify(stem) || "image"}.${ext}`;
}

export const imagePath = (slug, name) => `content/images/${slug}/${name}`;
export const imageMarkdownPath = (slug, name) => `/images/${slug}/${name}`;

// ISO date in India Standard Time (UTC+5:30), independent of the host timezone.
export function todayIST(now = new Date()) {
  return new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
}

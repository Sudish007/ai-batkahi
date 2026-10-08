// Word count from Markdown source (fences, inline code, heading markers,
// link URLs and emphasis markers stripped), and reading minutes at a given wpm.

export function countWords(markdown) {
  const text = String(markdown)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_>#|\-]{1,}/g, " ")
    .trim();
  if (text === "") return 0;
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function readingMinutes(words, wpm = 180) {
  return Math.max(1, Math.ceil(words / wpm));
}

// Minimal front-matter parser: `---` fences, `key: value`, inline lists
// `tags: [a, b]`, optional single/double quotes, empty values -> "".

function unquote(value) {
  const v = value.trim();
  if (v.length >= 2) {
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return v.slice(1, -1);
    }
  }
  return v;
}

function parseValue(raw) {
  const v = raw.trim();
  if (v === "") return "";
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((s) => unquote(s)).filter((s) => s !== "");
  }
  return unquote(v);
}

export function parse(markdown) {
  const text = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { data: {}, body: text };
  }
  const data = {};
  for (const line of match[1].split("\n")) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) {
      throw new Error(`Invalid front-matter line: "${line}"`);
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1);
    data[key] = parseValue(value);
  }
  return { data, body: text.slice(match[0].length) };
}

// Serialiser that round-trips through parse() above. Key order is fixed:
// `draft: true` first (only when set), then the README key order, with
// `instagram` always emitted (an empty value is allowed and emitted bare).
const KEY_ORDER = ["title", "title_en", "date", "category", "tags", "summary", "summary_en"];
const QUOTE_WHEN_LEADING = "[]'\"->*&!|%@`{}";

function needsQuotes(value) {
  if (value === "") return false;
  if (value.includes(":") || value.includes("#")) return true;
  if (QUOTE_WHEN_LEADING.includes(value[0])) return true;
  if (value !== value.trim()) return true;
  return false;
}

// parse() strips one pair of outer quotes and never unescapes, so the quote
// character chosen must not occur inside the value at all.
function scalar(raw) {
  const value = String(raw ?? "").replace(/\r?\n/g, " ");
  if (!needsQuotes(value)) return value;
  if (!value.includes('"')) return `"${value}"`;
  if (!value.includes("'")) return `'${value}'`;
  throw new Error("mixed quotes");
}

function list(tags) {
  const items = Array.isArray(tags) ? tags : [];
  for (const tag of items) {
    const t = String(tag);
    if (t.trim() === "" || /[,[\]]/.test(t)) {
      throw new Error(`invalid tag: "${t}"`);
    }
  }
  return `[${items.map((t) => String(t).trim()).join(", ")}]`;
}

export function serialize(data) {
  const lines = [];
  if (data.draft === true || data.draft === "true") lines.push("draft: true");
  for (const key of KEY_ORDER) {
    lines.push(`${key}: ${key === "tags" ? list(data.tags) : scalar(data[key])}`);
  }
  const instagram = scalar(data.instagram);
  lines.push(instagram === "" ? "instagram:" : `instagram: ${instagram}`);
  return `---\n${lines.join("\n")}\n---\n`;
}

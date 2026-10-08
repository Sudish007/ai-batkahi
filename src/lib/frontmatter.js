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

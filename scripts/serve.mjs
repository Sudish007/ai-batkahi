// Tiny static server that mounts dist/ under basePath, exactly as GitHub Pages will.
// Usage: npm run serve  (PORT env var optional, default 4173)
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import config from "../site.config.js";

const DIST = join(fileURLToPath(new URL("../dist/", import.meta.url)));
const PORT = Number(process.env.PORT || 4173);
const BASE = config.basePath;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function send(res, status, file) {
  res.writeHead(status, {
    "Content-Type": MIME[extname(file)] || "application/octet-stream",
    "Content-Length": statSync(file).size,
  });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (pathname === "/" || pathname === BASE.slice(0, -1)) {
    res.writeHead(302, { Location: BASE });
    return res.end();
  }
  if (!pathname.startsWith(BASE)) {
    return send(res, 404, join(DIST, "404.html"));
  }
  const rel = normalize(pathname.slice(BASE.length)).replace(/^(\.\.[/\\])+/, "");
  let file = join(DIST, rel);
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!pathname.endsWith("/")) {
      res.writeHead(301, { Location: pathname + "/" });
      return res.end();
    }
    file = join(file, "index.html");
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    return send(res, 404, join(DIST, "404.html"));
  }
  send(res, 200, file);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Serving dist/ at http://127.0.0.1:${PORT}${BASE}`);
});

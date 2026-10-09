// Minimal GitHub REST client for the admin (contents + actions endpoints).
// fetch is injectable so node:test can drive it. The token lives only in the
// Authorization header: it is never part of a URL, an Error or a log line.
import { encodeUtf8, encodeBytes, decodeUtf8 } from "./base64.js";

const API_VERSION = "2022-11-28";

export class GitHubError extends Error {
  constructor(status, message, { rateLimitReset = null, kind = "http" } = {}) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
    this.rateLimitReset = rateLimitReset;
    this.kind = kind;
  }
  userMessage() {
    if (this.kind === "network") return "नेटवर्क नइखे — फेर कोशिश करीं";
    if (this.status === 401) return "टोकन गलत बा या खतम हो गइल";
    if (this.status === 403 && this.rateLimitReset) {
      const time = new Date(this.rateLimitReset * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      return `GitHub rate limit — ${time} पर फेर कोशिश करीं`;
    }
    if (this.status === 403 || this.status === 404) return "टोकन के एह repo तक पहुँच नइखे";
    if (this.status === 409) return "ई फाइल बीच में बदल गइल बा";
    if (this.status === 422) return this.message;
    return `GitHub ${this.status}: ${this.message}`;
  }
}

// Replace every occurrence of the token in free text (activity log, console).
export function scrub(text, token) {
  const s = String(text);
  return token ? s.split(token).join("•••") : s;
}

export function createClient({ token, owner, repo, branch, fetchImpl = globalThis.fetch.bind(globalThis), api = "https://api.github.com" }) {
  const base = `/repos/${owner}/${repo}`;

  async function request(method, path, body) {
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": API_VERSION,
      Authorization: `Bearer ${token}`,
    };
    const init = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetchImpl(api + path, init);
    } catch (err) {
      if (err instanceof TypeError) throw new GitHubError(0, "network", { kind: "network" });
      throw err;
    }
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      const remaining = res.headers.get("x-ratelimit-remaining");
      const reset = remaining === "0" ? Number(res.headers.get("x-ratelimit-reset")) : null;
      throw new GitHubError(res.status, json.message || res.statusText, { rateLimitReset: reset });
    }
    if (res.status === 204) return null;
    return res.json();
  }

  const contents = (path) => `${base}/contents/${path}?ref=${encodeURIComponent(branch)}`;

  return {
    repo: () => request("GET", base),
    async listDir(path) {
      try {
        const json = await request("GET", contents(path));
        return Array.isArray(json) ? json : [];
      } catch (err) {
        if (err instanceof GitHubError && err.status === 404) return [];
        throw err;
      }
    },
    async getFile(path) {
      const json = await request("GET", contents(path));
      return { text: decodeUtf8(json.content), sha: json.sha, bytesBase64: json.content };
    },
    async putFile(path, { content, message, sha }) {
      const encoded = typeof content === "string" ? encodeUtf8(content) : encodeBytes(content);
      const json = await request("PUT", `${base}/contents/${path}`, {
        message,
        content: encoded,
        branch,
        ...(sha ? { sha } : {}),
      });
      return { contentSha: json.content.sha, commitSha: json.commit.sha };
    },
    deleteFile: (path, { message, sha }) => request("DELETE", `${base}/contents/${path}`, { message, sha, branch }),
    async latestRun() {
      const json = await request("GET", `${base}/actions/runs?branch=${encodeURIComponent(branch)}&event=push&per_page=1`);
      return (json.workflow_runs && json.workflow_runs[0]) || null;
    },
    run: (id) => request("GET", `${base}/actions/runs/${id}`),
    async latestPagesRun() {
      const json = await request("GET", `${base}/actions/workflows/pages.yml/runs?per_page=1`);
      return (json.workflow_runs && json.workflow_runs[0]) || null;
    },
  };
}

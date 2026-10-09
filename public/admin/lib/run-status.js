// GitHub Actions run classification for the publish dialog and the dashboard
// deploy strip. Imports nothing.
const QUEUED = new Set(["queued", "waiting", "pending", "requested"]);

export function classifyRun(run, commitSha) {
  const url = (run && run.html_url) || null;
  if (!run || run.head_sha !== commitSha) return { state: "waiting", label: "run अभी शुरू नइखे भइल", url };
  if (QUEUED.has(run.status)) return { state: "queued", label: "कतार में", url };
  if (run.status === "in_progress") return { state: "in_progress", label: "चलत बा", url };
  if (run.status === "completed") {
    if (run.conclusion === "success") return { state: "success", label: "सफल", url };
    return { state: "failure", label: `असफल (${run.conclusion})`, url };
  }
  return { state: "queued", label: "कतार में", url };
}

export function relativeTime(iso, now = new Date()) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const mins = Math.round((now.getTime() - then.getTime()) / 60000);
  if (mins < 60) return `${Math.max(0, mins)} मिनट पहिले`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} घंटा पहिले`;
  return then.toISOString().slice(0, 10);
}

// "आखिरी deploy: सफल · 5 मिनट पहिले"; null when there is no run yet.
export function describeLatest(run, now = new Date()) {
  if (!run) return null;
  let label = "चलत बा";
  if (run.status === "completed") label = run.conclusion === "success" ? "सफल" : "असफल";
  const when = relativeTime(run.updated_at || run.created_at, now);
  return { text: `आखिरी deploy: ${label}${when ? ` · ${when}` : ""}`, url: run.html_url || null, state: label };
}

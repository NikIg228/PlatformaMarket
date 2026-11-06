import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export async function verifyReleaseCi({ repository, sha, token, apiUrl = "https://api.github.com", fetchImpl = fetch }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? "") || !/^[a-f0-9]{40}$/.test(sha ?? "") || !token) {
    throw new Error("Release requires repository, exact commit SHA and Actions read token");
  }
  const query = new URLSearchParams({ head_sha: sha, event: "push", branch: "main", per_page: "100" });
  const response = await fetchImpl(`${apiUrl}/repos/${repository}/actions/workflows/ci.yml/runs?${query}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Cannot verify release CI: HTTP ${response.status}`);
  const body = await response.json();
  const runs = body.workflow_runs.filter(run => run.head_sha === sha && run.event === "push" && run.head_branch === "main" && run.repository?.full_name === repository);
  runs.sort((a, b) => b.id - a.id);
  const latest = runs[0];
  if (!latest || latest.status !== "completed" || latest.conclusion !== "success") {
    throw new Error("Release blocked: latest main push CI for this SHA must complete successfully");
  }
  return latest.id;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sha = process.env.RELEASE_SHA;
  const run = await verifyReleaseCi({ repository: process.env.GITHUB_REPOSITORY, sha, token: process.env.GITHUB_TOKEN, apiUrl: process.env.GITHUB_API_URL });
  console.log(`Release CI verified: ${sha}, run ${run}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `sha=${sha}\n`);
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { verifyReleaseCi } from "./verify-release-ci.mjs";

const sha = "a".repeat(40);
const repository = "owner/market";
const success = { id: 10, head_sha: sha, event: "push", head_branch: "main", repository: { full_name: repository }, status: "completed", conclusion: "success" };
const verify = (runs, extra = {}) => verifyReleaseCi({ repository, sha, token: "test-token", fetchImpl: async () => ({ ok: true, json: async () => ({ workflow_runs: runs }) }), ...extra });

test("accepts only successful main push CI for exact SHA", async () => {
  assert.equal(await verify([success]), 10);
  for (const delta of [{ head_sha: "b".repeat(40) }, { event: "pull_request" }, { head_branch: "other" }, { repository: { full_name: "fork/market" } }]) {
    await assert.rejects(verify([{ ...success, ...delta }]), /Release blocked/);
  }
  await assert.rejects(verify([]), /Release blocked/);
});

test("does not fall back to old success when newest run fails or is pending", async () => {
  for (const delta of [{ conclusion: "failure" }, { conclusion: "cancelled" }, { conclusion: "skipped" }, { status: "in_progress", conclusion: null }, { status: "queued", conclusion: null }]) {
    await assert.rejects(verify([success, { ...success, id: 11, ...delta }]), /Release blocked/);
  }
});

test("fails closed on API/auth failures and malformed results", async () => {
  await assert.rejects(verify([], { token: "" }), /Actions read token/);
  await assert.rejects(verify([], { sha: "main" }), /exact commit SHA/);
  await assert.rejects(verify([], { fetchImpl: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);
  await assert.rejects(verify([], { fetchImpl: async () => { throw new Error("network failure"); } }), /network failure/);
  await assert.rejects(verify([], { fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }));
});

test("queries the named workflow and SHA without filtering away failed runs", async () => {
  await verify([], { fetchImpl: async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, "/repos/owner/market/actions/workflows/ci.yml/runs");
    assert.equal(parsed.searchParams.get("head_sha"), sha);
    assert.equal(parsed.searchParams.get("event"), "push");
    assert.equal(parsed.searchParams.get("branch"), "main");
    assert.equal(parsed.searchParams.has("status"), false);
    assert.equal(options.headers.Authorization, "Bearer test-token");
    assert(options.signal);
    return { ok: true, json: async () => ({ workflow_runs: [success] }) };
  } });
});

test("publishing depends on verified revision and checks out that SHA", () => {
  const workflow = load(readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8"));
  assert.equal(workflow.jobs.images.needs, "verified-revision");
  assert.equal(workflow.jobs["verified-revision"].permissions.actions, "read");
  assert.equal(workflow.jobs.images.steps[0].with.ref, "${{ needs.verified-revision.outputs.sha }}");
  const build = workflow.jobs.images.steps.find(step => step.uses?.startsWith("docker/build-push-action"));
  assert.match(build.with.tags, /sha-\$\{\{ needs.verified-revision.outputs.sha \}\}/);
});

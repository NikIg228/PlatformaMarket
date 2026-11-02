import { jest } from "@jest/globals";
import { syntheticReadFailureCorpus } from "./test-fixtures/synthetic-read-failure-corpus";
import { replaySyntheticReadCapture } from "./test-fixtures/synthetic-read-corpus";

const ids = [401, 403, 404, 429, 500].flatMap(status => [`core-workflow-http-${status}`, `metadata-cities-http-${status}`, `conversation-offer-http-${status}`]).concat([403, 404, 429, 500].map(status => `metadata-summary-http-${status}`), ["metadata-summary-malformed"]);
it.each(ids)("serialized synthetic%s retains the actual expected rejection/partial phase", async id => {
  const entry = (await syntheticReadFailureCorpus()).find(row => row.id === id)!; expect(entry).toBeDefined();
  const report = await replaySyntheticReadCapture(entry.format, JSON.parse(JSON.stringify(entry.input))), phase = "consumerPhase" in report ? report.consumerPhase : report.phase;
  expect(report.status).toBe(entry.expected.status); expect(phase).toBe(entry.expected.phase);
  if (entry.expected.summaryIssue !== undefined) expect(report).toHaveProperty("summaryIssue", entry.expected.summaryIssue);
  expect(report).toMatchObject({ serverAccepted: false, productionAuthorizationVerified: false, networkRequests: 0, mutations: 0 });
  for (const value of ["SYNTHETIC", "https:", "organizationId", "PRIVATE", "/conversations"]) expect(JSON.stringify(report)).not.toContain(value);
});
it("failure templates are exactly20 safe unique names with explicit expected outcomes", async () => {
  const rows = await syntheticReadFailureCorpus(); expect(rows.map(row => row.id)).toEqual(ids); expect(rows).toHaveLength(20); expect(new Set(rows.map(row => row.id)).size).toBe(20); expect(Object.isFrozen(rows)).toBe(true);
  for (const row of rows) { expect(row.id).toMatch(/^[a-z][a-z0-9-]+$/); expect(Object.isFrozen(row)).toBe(true); expect(Object.isFrozen(row.expected)).toBe(true); }
});
it("failure corpus and classification perform no network or timers", async () => {
  const fetch = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("FORBIDDEN_NETWORK")), timer = jest.spyOn(globalThis, "setTimeout");
  try { for (const entry of await syntheticReadFailureCorpus()) expect((await replaySyntheticReadCapture(entry.format, entry.input)).status).toBe(entry.expected.status); expect(fetch).not.toHaveBeenCalled(); expect(timer).not.toHaveBeenCalled(); }
  finally { fetch.mockRestore(); timer.mockRestore(); }
});

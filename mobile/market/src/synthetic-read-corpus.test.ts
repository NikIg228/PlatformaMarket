import { jest } from "@jest/globals";
import { syntheticReadCaptureCorpus, replaySyntheticReadCapture } from "./test-fixtures/synthetic-read-corpus";

const ids = ["core-catalog", "core-comparison", "core-workspace-orders", "core-organization-profile", "core-workflow", "core-cart", "core-checkout", "core-workspace-carts", "core-support-tickets", "core-support-ticket", "metadata-document-archive", "metadata-archive-document", "metadata-public-cities", "conversation-order-plain", "conversation-order-support", "conversation-order-older", "conversation-offer-plain", "conversation-offer-support", "conversation-offer-older"] as const;
it.each(ids)("serialized synthetic%s passes the actual protected consumer without network or mutation", async id => {
  const entry = (await syntheticReadCaptureCorpus()).find(row => row.id === id)!; expect(entry).toBeDefined();
  const input = JSON.parse(JSON.stringify(entry.input)), report = await replaySyntheticReadCapture(entry.format, input);
  expect(report).toMatchObject({ status: "CONSISTENT_READ", serverAccepted: false, productionAuthorizationVerified: false, networkRequests: 0, mutations: 0 });
  for (const value of ["SYNTHETIC", "https:", "/conversations", "organizationId", "documentId", "900719925"]) expect(JSON.stringify(report)).not.toContain(value);
});
it("the full registry has unique safe filenames and fresh input ownership on each generation", async () => {
  const first = await syntheticReadCaptureCorpus(), second = await syntheticReadCaptureCorpus(); expect(first.map(row => row.id)).toEqual(ids); expect(new Set(first.map(row => row.id)).size).toBe(19); expect(Object.isFrozen(first)).toBe(true);
  for (let i = 0; i < first.length; i++) { expect(first[i]!.id).toMatch(/^[a-z][a-z0-9-]+$/); expect(Object.isFrozen(first[i])).toBe(true); expect(second[i]!.input).not.toBe(first[i]!.input); }
});
it("generation and all format replayers call no fetch/timer or real input reader", async () => {
  const fetch = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("FORBIDDEN_NETWORK")), timer = jest.spyOn(globalThis, "setTimeout");
  try { for (const entry of await syntheticReadCaptureCorpus()) expect((await replaySyntheticReadCapture(entry.format, entry.input)).status).toBe("CONSISTENT_READ"); expect(fetch).not.toHaveBeenCalled(); expect(timer).not.toHaveBeenCalled(); }
  finally { fetch.mockRestore(); timer.mockRestore(); }
});

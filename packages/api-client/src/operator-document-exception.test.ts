import { afterEach, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";
afterEach(() => vi.unstubAllGlobals());
it("uses the exact exception and retains the command key and versions for recovery", async () => {
  const fetcher = vi.fn(async () => new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetcher);
  const client = new MarketplaceApiClient("http://api.invalid/api", {}), abort = new AbortController();
  await client.operatorDocumentException("case-id", abort.signal);
  expect(fetcher.mock.calls[0]).toMatchObject(["http://api.invalid/api/operations/document-exceptions/case-id", { signal: abort.signal }]);
  const input = { expectedOrderVersion: 1, expectedShipmentVersion: 2, expectedExceptionVersion: 3, idempotencyKey: "same-command", reason: "Рекомендация оператора", nextStep: "Следующее действие" };
  await client.publishOperatorExceptionRecommendation("case-id", input); await client.publishOperatorExceptionRecommendation("case-id", input);
  for (const call of fetcher.mock.calls.slice(1)) expect(call).toMatchObject(["http://api.invalid/api/operations/document-exceptions/case-id/recommendation", { method: "POST", body: JSON.stringify(input) }]);
});

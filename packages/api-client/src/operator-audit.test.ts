import { afterEach, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";
afterEach(() => vi.unstubAllGlobals());
it("keeps audit filters and abort context separate from the tenant audit endpoint", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetcher);
  const client = new MarketplaceApiClient("http://api.invalid/api", {}), abort = new AbortController();
  await client.operatorAudit({ offset: 25, limit: 25, action: "order.confirmed", dateFrom: "2026-10-01" }, abort.signal);
  expect(fetcher.mock.calls[0]).toMatchObject([expect.stringContaining("/operations/audit?"), { signal: abort.signal }]);
  const params = new URL(String(fetcher.mock.calls[0][0])).searchParams;
  expect(params.get("action")).toBe("order.confirmed"); expect(params.get("offset")).toBe("25"); expect(params.get("dateFrom")).toBe("2026-10-01");
  await client.operatorTechnical(abort.signal);
  expect(fetcher.mock.calls[1]).toMatchObject(["http://api.invalid/api/operations/technical", { signal: abort.signal }]);
});
it("pages dead-letter metadata and retains failure preconditions/key on uncertain replay", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetcher);
  const client = new MarketplaceApiClient("http://api.invalid/api", {}), abort = new AbortController();
  await client.listOutboxDeadLetters({ offset: 25, limit: 25, eventType: "OrderDiscrepancyChanged" }, abort.signal);
  expect(fetcher.mock.calls[0]).toMatchObject([expect.stringContaining("offset=25"), { signal: abort.signal }]);
  const input = { idempotencyKey: "same-command", reason: "Ошибка обработчика устранена", expectedAvailableAt: "2026-10-17T00:00:00Z", expectedAttempts: 10 };
  await client.replayOutboxDeadLetter("selected-id", input); await client.replayOutboxDeadLetter("selected-id", input);
  for (const call of fetcher.mock.calls.slice(1)) expect(call).toMatchObject(["http://api.invalid/api/operations/outbox/dead-letter/selected-id/replay", { method: "POST", body: JSON.stringify(input) }]);
});

import { afterEach, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";
afterEach(() => vi.unstubAllGlobals());
it("sends the selected supplier, connection, entry and optimistic version in the resolution command", async () => {
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ id: "entry", status: "RESOLVED", resolution: "Проверено", resolvedAt: "2026-10-17T00:00:00.000Z" }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const client = new MarketplaceApiClient("http://api.invalid/api", {});
  const input = { resolution: "Проверено", expectedUpdatedAt: "2026-10-17T00:00:00.000Z" };
  const result = await client.resolveIntegrationReconciliation("supplier", "connection", "entry", input);
  expect(fetcher.mock.calls[0][0]).toBe("http://api.invalid/api/suppliers/supplier/integrations/connection/reconciliation/entry/resolve");
  expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", body: JSON.stringify(input) });
  expect(result.status).toBe("RESOLVED");
});

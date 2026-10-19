import { afterEach, expect, it, vi } from "vitest";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });
it("uses one bounded summary request, cancellable provenance pages and versioned resolution", async () => {
  vi.stubEnv("NEXT_PUBLIC_DEPLOYMENT_PROFILE", "go_live"); vi.resetModules();
  const { MarketplaceApiClient } = await import("./index");
  const fetcher = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetcher);
  const client = new MarketplaceApiClient("http://api.invalid/api", {}), abort = new AbortController();
  await client.operatorTrust({ incidentOffset: 25, supplierOffset: 50 }, abort.signal);
  expect(fetcher.mock.calls[0]).toMatchObject(["http://api.invalid/api/trust/operator?incidentOffset=25&supplierOffset=50", { signal: abort.signal }]);
  await client.operatorTrustEvents("supplier", 25, abort.signal);
  expect(fetcher.mock.calls[1]).toMatchObject(["http://api.invalid/api/trust/operator/suppliers/supplier/events?offset=25", { signal: abort.signal }]);
  const input = { version: 4, resolution: "Документы проверены оператором" };
  await client.resolveOperatorTrustIncident("incident", input);
  expect(fetcher.mock.calls[2]).toMatchObject(["http://api.invalid/api/trust/operator/incidents/incident/resolve", { method: "POST", body: JSON.stringify(input) }]);
});

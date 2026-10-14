import { afterEach, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";

afterEach(() => vi.unstubAllGlobals());
it("keeps requisites ownership in the authenticated context and forwards version/replay commands", async () => {
  const fetcher = vi.fn().mockImplementation(async () => new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetcher);
  const client = new MarketplaceApiClient("http://api.invalid/api", {});
  const save = { expectedVersion: 0, expectedOrganizationVersion: 1, idempotencyKey: "draft-test", fields: { legalForm: null, bankAccounts: [], defaultBankAccountId: null, taxPeriods: [] } };
  const confirm = { expectedVersion: 1, expectedOrganizationVersion: 1, idempotencyKey: "confirm-test", acknowledged: true as const };
  await client.getOrganizationRequisites(); await client.saveOrganizationRequisites(save); await client.confirmOrganizationRequisites(confirm);
  await client.getOrganizationRequisitesHistory({ beforeVersion: 21 });
  expect(fetcher.mock.calls.map(call => call[0])).toEqual([
    "http://api.invalid/api/organizations/current/requisites", "http://api.invalid/api/organizations/current/requisites",
    "http://api.invalid/api/organizations/current/requisites/confirm", "http://api.invalid/api/organizations/current/requisites/history?beforeVersion=21",
  ]);
  expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  expect(fetcher.mock.calls[0][1].method ?? "GET").toBe("GET");
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual(save);
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual(confirm);
});

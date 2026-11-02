import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSupplierCalendar } from "@marketplace/schemas";
import { MarketplaceApiClient } from "./index";

const organizationId = "11111111-1111-4111-8111-111111111111";
const result = { organizationId, version: 0, source: "DEFAULT", canEdit: true, calendar: defaultSupplierCalendar() };
afterEach(() => vi.unstubAllGlobals());
describe("supplier calendar client", () => {
  it("uses the authenticated current supplier for read/save and preserves CAS/replay fields", async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify(result), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const api = new MarketplaceApiClient("/api", { getAccessToken: async () => "fixture" });
    expect(await api.getSupplierCalendar()).toEqual(result);
    const input = { ...defaultSupplierCalendar(), expectedVersion: 0, idempotencyKey: organizationId };
    await api.saveSupplierCalendar(input);
    expect(fetcher).toHaveBeenLastCalledWith("/api/suppliers/current/working-calendar", expect.objectContaining({ method: "POST", body: JSON.stringify(input), headers: { "content-type": "application/json", authorization: "Bearer fixture" } }));
  });
  it("rejects invalid input before a request and does not retry a version conflict", async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ code: "CONFLICT", message: "Календарь изменился" }), { status: 409 }));
    vi.stubGlobal("fetch", fetcher);
    const api = new MarketplaceApiClient("/api", { getAccessToken: async () => "fixture" });
    await expect(api.saveSupplierCalendar({ ...defaultSupplierCalendar(), expectedVersion: -1, idempotencyKey: organizationId })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await expect(api.saveSupplierCalendar({ ...defaultSupplierCalendar(), expectedVersion: 0, idempotencyKey: organizationId })).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects a malformed server calendar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...result, calendar: {} }))));
    await expect(new MarketplaceApiClient("/api", {}).getSupplierCalendar()).rejects.toThrow();
  });
});

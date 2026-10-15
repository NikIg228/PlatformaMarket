import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";

afterEach(() => vi.unstubAllGlobals());
describe("order invoice API client", () => {
  it("uses the order scope and preserves the prepare replay key", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const client = new MarketplaceApiClient("http://api.invalid/api", {});
    await client.getOrderInvoices("order-1");
    expect(fetcher.mock.calls[0][0]).toBe("http://api.invalid/api/supplier-orders/order-1/invoices");
    fetcher.mockResolvedValue(new Response("{}", { status: 201 }));
    const input = { expectedVersion: 3, idempotencyKey: "invoice-retry-key" };
    await client.prepareOrderInvoice("order-1", input);
    expect(fetcher.mock.calls[1][0]).toBe("http://api.invalid/api/supplier-orders/order-1/invoices/prepare");
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "POST", body: JSON.stringify(input) });
  });
  it("keeps conflict status for UI recovery", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Заказ изменился", code: "ORDER_INVOICE_CONFLICT" }), { status: 409 })));
    const client = new MarketplaceApiClient("http://api.invalid/api", {});
    await expect(client.prepareOrderInvoice("order-1", { expectedVersion: 1, idempotencyKey: "invoice-retry-key" })).rejects.toMatchObject({ status: 409 });
  });
});

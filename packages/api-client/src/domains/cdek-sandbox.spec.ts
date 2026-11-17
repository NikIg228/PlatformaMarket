import { expect, it, vi } from "vitest";
import { cdekSandboxCities, cdekSandboxQuote } from "./cdek-sandbox";
import type { ClientTransport } from "../transport-contract";
it("encodes route and city and sends typed parcel input without credentials", async () => {
  const get = vi.fn(), post = vi.fn(); const transport = { get, post } as unknown as ClientTransport;
  await cdekSandboxCities(transport, "order/other", "Алматы & Астана");
  expect(get).toHaveBeenCalledWith(`/supplier-orders/order%2Fother/cdek-sandbox/cities?${new URLSearchParams({ city: "Алматы & Астана" })}`);
  const input = { fromCityCode: 1, toCityCode: 2, packages: [{ weight: 1000, length: 20, width: 20, height: 10 }] };
  await cdekSandboxQuote(transport, "order", input);
  expect(post).toHaveBeenCalledWith("/supplier-orders/order/cdek-sandbox/quotes", input);
});

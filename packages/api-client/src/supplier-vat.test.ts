import { expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";

const selection = { mode: "TAXABLE" as const, rate: "16" as const, basis: null };
const tax = { selection, expectedRequisitesVersion: 4, acknowledged: true as const };

it("preserves reviewed VAT selection, versions, exact selected offers and replay identity", async () => {
  const client = new MarketplaceApiClient("https://example.invalid/api", {});
  const get = vi.spyOn(client, "get").mockResolvedValue({});
  const post = vi.spyOn(client, "post").mockResolvedValue({});
  const preview = { offerIds: ["offer-one"], tax };
  const apply = { ...preview, previewHash: "a".repeat(64), idempotencyKey: "same-apply" };
  const settings = { selection, expectedVersion: 2, expectedRequisitesVersion: 4, acknowledged: true as const, idempotencyKey: "same-default" };
  await client.getSupplierVatSettings("supplier");
  await client.saveSupplierVatSettings("supplier", settings);
  await client.previewOfferVat("supplier", preview);
  await client.applyOfferVat("supplier", apply);
  expect(get).toHaveBeenCalledWith("/suppliers/supplier/vat");
  expect(post.mock.calls).toEqual([
    ["/suppliers/supplier/vat", settings],
    ["/suppliers/supplier/vat/offers/preview", preview],
    ["/suppliers/supplier/vat/offers/apply", apply],
  ]);
});

it("preserves net source declaration and optimistic ERP binding version", async () => {
  const client = new MarketplaceApiClient("https://example.invalid/api", {});
  const get = vi.spyOn(client, "get").mockResolvedValue([]);
  const patch = vi.spyOn(client, "patch").mockResolvedValue({});
  const input = { expectedUpdatedAt: "2026-10-14T10:00:00.000Z", idempotencyKey: "same-binding",
    priceTax: { priceIncludesVat: false, defaultVat: selection, expectedRequisitesVersion: 4, taxAcknowledged: true as const } };
  await client.listIntegrationTaxBindings("supplier");
  await client.updateIntegrationTax("supplier", "connection", "binding", input);
  expect(get).toHaveBeenCalledWith("/suppliers/supplier/integrations/price-tax");
  expect(patch).toHaveBeenCalledWith("/suppliers/supplier/integrations/connection/bindings/binding/tax", input);
});

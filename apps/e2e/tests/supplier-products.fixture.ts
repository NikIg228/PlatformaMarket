import { expect, type Page } from "@playwright/test";
import type { WorkspaceOffer, OfferPromotion } from "@marketplace/schemas";
export const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
export const organizationId = id(1), warehouseId = id(2), offerId = id(3), variantId = id(4), productId = id(5);
const at = "2026-01-01T00:00:00.000Z";
export const permissions = ["catalog.offer.edit", "catalog.product.view", "catalog.offer.publish", "inventory.view", "inventory.adjust", "pricing.manage", "import.manage", "promotion.view", "promotion.manage", "inventory.freshness.manage", "order.confirm", "delivery.view", "delivery.manage"];
export const sampleOffer: WorkspaceOffer = {
  id: offerId, version: 1, supplierSku: "COMP-10", status: "ACTIVE", sourceType: "MANUAL", confirmationMode: "MANUAL", productVariantId: variantId,
  productVariant: { product: { id: productId, canonicalName: "Композит для реставрации", description: "Текущее описание материала", manufacturerSku: "COMP", gtin: null, productType: "MATERIAL", regulatoryClass: null } },
  saleUnit: { nameRu: "упаковка", symbol: "уп." }, packaging: { id: id(6), name: "10 штук", quantityInBaseUnit: "10", unit: { symbol: "шт." } },
  baseUnitsPerSaleUnit: "10", minimumOrderQuantity: "2", orderIncrement: "1", createdAt: at,
  publication: { status: "PUBLISHED", marketplaceVisible: true, blockedReason: null },
  prices: [{ id: id(7), amountMinor: "100000", currency: "KZT", status: "ACTIVE", includesVat: true, vatRate: null, source: "MANUAL", lastConfirmedAt: at, freshnessExpiresAt: null }],
  inventoryBalances: [{ id: id(8), warehouseId, warehouse: { name: "Основной склад" }, quantityOnHand: "28", quantityAvailable: "25", quantityReserved: "3", freshnessStatus: "FRESH", freshnessExpiresAt: null, source: "MANUAL", updatedAt: at }],
};
export const samplePromotion: OfferPromotion = {
  id: id(30), supplierOrganizationId: organizationId, supplierName: "Тестовый поставщик", offerName: sampleOffer.productVariant.product.canonicalName, productId, giftName: null,
  terms: { offerId, name: "Скидка на композит", description: "Для клиник", kind: "FIXED_AMOUNT", percentageBasisPoints: null, fixedAmountMinor: "10000", buyQuantity: null, giftOfferId: null, giftQuantity: null, minimumQuantity: "1", quantityLimit: "100", startsAt: at, endsAt: "2035-01-01T00:00:00.000Z" },
  version: 1, revision: 1, moderationStatus: "APPROVED", temporalStatus: "ACTIVE", status: "ACTIVE", currency: "KZT", unitPriceMinor: "90000", claimedQuantity: "2", isTemplate: false, placementStartsAt: null, placementEndsAt: null,
  evidence: { capturedAt: at, baseAmountMinor: "100000", currency: "KZT", minimum30DaysMinor: "100000", historyDays: 30, raisedRecently: false, observations: [] }, revisions: [], decisions: [],
};
export async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
export async function productFixture(page: Page, allowed = permissions) {
  const state = { unexpected: [] as string[], writes: [] as Array<{ path: string; body: Record<string, unknown> }>, reads: [] as string[],
    failCommercial: false, failCorrections: false, failImport: false, failOffers: false, failProposals: false, failPromotions: false, failPromotionSubmit: false,
    offers: [sampleOffer, { ...sampleOffer, id: id(9), supplierSku: "STALE-1", productVariant: { product: { ...sampleOffer.productVariant.product, canonicalName: "Адгезив универсальный" } }, prices: [{ ...sampleOffer.prices[0]!, freshnessExpiresAt: at }], inventoryBalances: [{ ...sampleOffer.inventoryBalances[0]!, freshnessStatus: "STALE" }] }],
    promotions: [samplePromotion], corrections: [] as unknown[], submissions: [{ id: id(20), proposedName: "Новый материал", proposedSku: "NEW-1", proposedGtin: null, proposedBrand: "Бренд", description: "Исходные сведения и упаковка", status: "REJECTED", rejectionReason: "Уточните упаковку", createdAt: at, decidedAt: at, approvedProductId: null, approvedVariantId: null }],
    batch: null as Record<string, unknown> | null,
  };
  await page.addInitScript(({ organizationId }) => { sessionStorage.setItem("dentmarket:supplier-session", JSON.stringify({ capability: "SUPPLIER", organizationId, sessionId: "22222222-2222-4222-8222-222222222222", accessToken: "ui-fixture-not-real", accessTokenExpiresAt: Date.now() + 3600000 })); }, { organizationId });
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, "");
    const write = request.method() !== "GET", input = write ? request.postDataJSON() as Record<string, unknown> : {};
    if (write) state.writes.push({ path, body: input }); else state.reads.push(path + url.search);
    const fail = (message: string, status = 503) => route.fulfill({ status, json: { message } });
    let body: unknown;
    if (path === "/auth/workspace-context") body = { organizationId, organizationDisplayName: "Тестовый поставщик", capabilities: ["SUPPLIER"] };
    else if (path === "/auth/current") body = null;
    else if (path === "/conversations") body = { items: [], hasMore: false, unreadCount: 0 };
    else if (path === `/notifications/organizations/${organizationId}/inbox` && !write) body = { items: [], nextCursor: null, unreadCount: 0, asOf: "2026-10-06T00:00:00Z" };
    else if (path === "/access-control/permissions") body = allowed;
    else if (path === "/access-control/policy") body = { mode: "ROLE_BASED", permissions: allowed };
    else if (path === "/workspaces/supplier/offers") {
      if (state.failOffers) return fail("Список временно недоступен");
      let items = state.offers;
      if (url.searchParams.get("attention")) items = items.filter(item => item.id === id(9));
      if (url.searchParams.get("publication") === "hidden") items = [];
      const query = url.searchParams.get("q");
      if (query) items = items.filter(item => item.productVariant.product.canonicalName.toLowerCase().includes(query.toLowerCase()) || item.supplierSku?.includes(query));
      body = { items, nextCursor: null };
    } else if (path === `/workspaces/supplier/offers/${offerId}`) body = sampleOffer;
    else if (path === "/catalog/offer-options") body = { items: [{ id: variantId, productId, name: sampleOffer.productVariant.product.canonicalName, sku: "COMP", gtin: null, packagings: [{ id: id(6), name: "10 штук", quantityInBaseUnit: "10", unit: "шт.", unitId: id(10) }] }], nextCursor: null };
    else if (path === `/suppliers/${organizationId}/warehouses`) body = [{ id: warehouseId, name: "Основной склад", status: "ACTIVE" }, { id: id(11), name: "Второй склад", status: "ACTIVE" }];
    else if (path === `/suppliers/${organizationId}/offers` && write) body = { id: offerId, version: 1 };
    else if (path.includes(`/offers/${offerId}/commercial`)) {
      if (write && state.failCommercial) return fail("Повторите сохранение условий");
      body = { offerId, offerVersion: write ? 2 : 1, warehouseId, publicationStatus: "DRAFT", marketplaceVisible: false,
        price: write ? { amountMinor: input.amountMinor, currency: "KZT", includesVat: true, vatRate: null } : null,
        balance: { id: id(8), version: write ? 2 : 1, quantityOnHand: write ? String(input.quantityOnHand) : "0", quantityReserved: "0", safetyStock: "0", quantityAvailable: write ? String(input.quantityOnHand) : "0", availabilityStatus: "AVAILABLE" } };
    } else if (path === `/suppliers/${organizationId}/offers/${offerId}/publication`) body = { offerVersion: 3, status: "PUBLISHED", marketplaceVisible: true };
    else if (path === `/suppliers/${organizationId}/data-sources`) body = write ? { id: id(12), name: "Прайс CSV", type: "CSV", status: "ACTIVE" } : [{ id: id(12), name: "Основной прайс", type: "CSV", status: "ACTIVE" }];
    else if (path === `/suppliers/${organizationId}/import-preview`) {
      if (state.failImport) return fail("Не удалось прочитать прайс");
      body = { headers: ["Код", "Название", "Цена", "Валюта", "Остаток"], rows: [{ rowNumber: 2, rawData: { Код: "PRICE-1", Название: "Композит", Цена: "1234,56", Валюта: "KZT", Остаток: "5" } }] };
    }
    else if (path === `/suppliers/${organizationId}/import-batches`) {
      if (write) {
        if (state.failImport) return fail("Не удалось прочитать прайс");
        state.batch = { id: id(13), supplierOrganizationId: organizationId, sourceId: id(12), fileName: input.fileName, fileType: input.fileType, columnMapping: input.columnMapping, status: "MAPPED", totalRows: 1, processedRows: 0, errorRows: 0, createdAt: at, updatedAt: at, rows: [{ id: id(14), rowNumber: 2, rawData: { Код: "PRICE-1", Название: "Композит", "Цена в тиынах": 100000 }, status: "RAW", errorMessage: null }] };
        body = state.batch;
      } else body = state.batch ? [state.batch] : [];
    } else if (path === `/suppliers/${organizationId}/import-batches/${id(13)}`) body = state.batch;
    else if (path === `/suppliers/${organizationId}/import-batches/${id(13)}/process`) { state.batch = { ...state.batch, status: "COMPLETED", processedRows: 1 }; body = state.batch; }
    else if (path === `/suppliers/${organizationId}/import-batches/${id(13)}/diagnostics`) body = { processedRows: 1, errorRows: 0, byStatus: {} };
    else if (path === "/moderation/product-candidates/submissions") {
      if (write) {
        if (state.failProposals) return fail("Не удалось отправить заявку");
        body = { candidate: { id: id(21), status: "PENDING" }, duplicateSuggestions: [] };
      } else body = { items: state.submissions, nextCursor: null };
    } else if (path === "/workspaces/supplier/correction-offers") body = { items: [sampleOffer], nextCursor: null };
    else if (path === "/moderation/product-corrections") {
      if (write) {
        if (state.failCorrections) return fail("Ошибка отправки");
        const correction = { id: id(22), ...input, supplierOrganizationId: organizationId, currentValue: sampleOffer.productVariant.product.description, status: "PENDING", createdAt: at, product: sampleOffer.productVariant.product, appliedValue: null, moderatorComment: null };
        state.corrections.push(correction); body = correction;
      } else body = state.corrections;
    } else if (path === "/workspaces/supplier/inventory") body = { items: url.searchParams.get("warehouseId") === id(11) ? [] : [{ ...sampleOffer.inventoryBalances[0], id: id(8), offerId, offer: { saleUnit: sampleOffer.saleUnit, packaging: sampleOffer.packaging }, createdAt: at, warehouse: { id: warehouseId, name: "Основной склад" }, productVariant: sampleOffer.productVariant, safetyStock: "0" }], nextCursor: null };
    else if (path === `/workspaces/supplier/inventory/${id(8)}/lots`) body = { items: [{ id: id(23), lotNumber: "LOT-2026", status: "ACTIVE", quantityAvailable: "25", expirationDate: "2030-01-01T00:00:00Z" }], nextCursor: null };
    else if (path === `/workspaces/supplier/inventory/${id(8)}/reservations`) body = { items: [{ id: id(24), quantity: "3", expiresAt: "2030-01-01T00:00:00Z", order: { id: id(25), orderNumber: "ORD-100" } }], nextCursor: null };
    else if (path === "/workspaces/supplier/inventory-overrides") body = { items: [], nextCursor: null };
    else if (path === "/promotions") {
      if (write) {
        if (state.failPromotions) return fail("Не удалось сохранить акцию");
        const promotion = { ...samplePromotion, id: id(31), terms: input.terms as OfferPromotion["terms"], moderationStatus: "DRAFT" as const, temporalStatus: "DRAFT" as const, status: "DRAFT" };
        state.promotions.push(promotion); body = promotion;
      } else { const items = state.promotions.filter(item => (!url.searchParams.get("q") || item.terms.name.toLowerCase().includes(url.searchParams.get("q")!.toLowerCase())) && (!url.searchParams.get("phase") || item.temporalStatus === url.searchParams.get("phase")) && (!url.searchParams.get("moderationStatus") || item.moderationStatus === url.searchParams.get("moderationStatus"))); body = { items, total: items.length, offset: 0, limit: 10 }; }
    } else if (path.endsWith("/commands") && path.startsWith("/promotions/")) { if (state.failPromotionSubmit) return fail("Не удалось отправить акцию"); state.promotions = state.promotions.map(item => item.id === path.split("/")[2] ? { ...item, moderationStatus: "PENDING", version: 2 } : item); body = state.promotions.at(-1); }
    else { state.unexpected.push(path); return fail(`Unexpected fixture path ${path}`); }
    return route.fulfill({ json: body });
  });
  return state;
}
export async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }

import { test, expect, type Page } from "@playwright/test";
import type { OfferCommercialState } from "@marketplace/schemas";
import { productFixture, noOverflow, sampleOffer, id, offerId, organizationId, warehouseId, permissions } from "./supplier-products.fixture";

const deepLink = `/supplier/products/inventory?offer=${offerId}&warehouse=${warehouseId}&balance=${id(8)}&edit=1`;
async function stockFixture(page: Page, allowed = permissions) {
  const base = await productFixture(page, allowed);
  await page.route("**/api/notifications/**", route => route.fulfill({ json: { items: [], nextCursor: null, unreadCount: 0, asOf: "2026-10-06T00:00:00Z" } }));
  const state = { failures: [] as number[], writes: [] as Array<Record<string, unknown>>, failRead: false, source: "MANUAL",
    commercial: { offerId, offerVersion: 1, warehouseId, publicationStatus: "PUBLISHED", marketplaceVisible: true,
      price: { amountMinor: "100000", currency: "KZT", includesVat: true, vatRate: null },
      balance: { id: id(8), version: 1, quantityOnHand: "28", quantityReserved: "3", safetyStock: "0", quantityAvailable: "25", availabilityStatus: "AVAILABLE" } } as OfferCommercialState };
  await page.route(`**/api/workspaces/supplier/offers/${offerId}`, route => route.fulfill({ json: { ...sampleOffer, sourceType: state.source } }));
  await page.route("**/api/workspaces/supplier/inventory?*", route => route.fulfill({ json: { items: [{ ...sampleOffer.inventoryBalances[0], ...state.commercial.balance, offerId,
    offer: { saleUnit: sampleOffer.saleUnit, packaging: sampleOffer.packaging }, warehouse: { id: warehouseId, name: "Основной склад" }, productVariant: sampleOffer.productVariant }], nextCursor: null } }));
  await page.route(`**/api/suppliers/${organizationId}/offers/${offerId}/commercial/**`, async route => {
    if (route.request().method() === "GET") return route.fulfill(state.failRead ? { status: 503, json: { message: "Не удалось загрузить остаток" } } : { json: state.commercial });
    const body = route.request().postDataJSON() as Record<string, unknown>; state.writes.push(body);
    const failure = state.failures.shift();
    if (failure) return route.fulfill({ status: failure, json: { message: failure === 409 ? "Остаток изменён другим сотрудником" : "Ответ временно недоступен" } });
    if (route.request().url().endsWith("/stock")) state.commercial = { ...state.commercial, balance: { ...state.commercial.balance!, version: state.commercial.balance!.version + 1,
      quantityOnHand: String(body.quantityOnHand), quantityAvailable: String(Number(body.quantityOnHand) - 3) } };
    else state.commercial = { ...state.commercial, offerVersion: state.commercial.offerVersion + 1, price: { ...state.commercial.price!, amountMinor: String(body.amountMinor) } };
    return route.fulfill({ json: state.commercial });
  });
  return { state, base };
}

for (const width of [1440, 390]) test(`inspector opens selected stock ready for keyboard editing ${width}`, async ({ page }, testInfo) => {
  const { state, base } = await stockFixture(page); await page.setViewportSize({ width, height: 1000 });
  await page.goto("/supplier/products");
  await page.getByRole("button", { name: "Композит для реставрации", exact: true }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Обновить остатки", exact: true }).click();
  const field = page.getByRole("textbox", { name: "На складе, уп." });
  await expect(field).toHaveValue("28"); await expect(field).toBeFocused();
  await noOverflow(page); await page.screenshot({ path: testInfo.outputPath(`stock-initial-${width}.png`), fullPage: true });
  await expect(page).toHaveURL(/edit=1/); await page.reload(); await expect(field).toHaveValue("28");
  await field.fill("31"); await field.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Остаток сохранён" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Остатки по складам" })).toContainText("31 уп.");
  expect(state.writes[0]).toMatchObject({ warehouseId, quantityOnHand: 31, expectedBalanceVersion: 1 });
  expect(state.writes[0]).not.toHaveProperty("amountMinor"); expect(state.commercial.price?.amountMinor).toBe("100000");
  await noOverflow(page); await page.screenshot({ path: testInfo.outputPath(`stock-${width}.png`), fullPage: true });
  expect(base.unexpected).toEqual([]);
});

test("stock-only permission, validation, uncertain retry and dirty close", async ({ page }) => {
  const { state } = await stockFixture(page, permissions.filter(value => value !== "pricing.manage"));
  await page.goto("/supplier/products/inventory"); await page.getByRole("button", { name: "Изменить остаток" }).click();
  const field = page.getByRole("textbox", { name: "На складе, уп." }); await expect(field).toHaveValue("28");
  await field.fill("-1"); await page.getByRole("button", { name: "Сохранить остаток", exact: true }).click();
  expect(state.writes).toHaveLength(0); await expect(field).toHaveAttribute("aria-invalid", "true");
  await field.fill("32"); page.once("dialog", dialog => dialog.dismiss()); await page.getByRole("button", { name: "Закрыть", exact: true }).click(); await expect(field).toHaveValue("32");
  state.failures.push(503); await page.getByRole("button", { name: "Сохранить остаток", exact: true }).click();
  await expect(field).toBeDisabled(); await page.getByRole("button", { name: "Повторить сохранение остатка" }).click();
  await expect(field).toBeEnabled(); expect(state.writes).toHaveLength(2); expect(state.writes[1]).toEqual(state.writes[0]);
});

test("conflict preserves draft and requires explicit comparison before retry", async ({ page }) => {
  const { state } = await stockFixture(page); await page.goto(deepLink);
  const field = page.getByRole("textbox", { name: "На складе, уп." }); await expect(field).toHaveValue("28"); await field.fill("33");
  state.commercial.balance = { ...state.commercial.balance!, version: 2, quantityOnHand: "30" }; state.failures.push(409); state.failRead = true;
  await page.getByRole("button", { name: "Сохранить остаток", exact: true }).click();
  await expect(page.getByRole("button", { name: "Загрузить текущий остаток для сравнения" })).toBeVisible();
  await expect(field).toHaveValue("33"); await expect(page.getByRole("button", { name: "Сохранить остаток", exact: true })).toBeDisabled();
  state.failRead = false; await page.getByRole("button", { name: "Загрузить текущий остаток для сравнения" }).click();
  await expect(page.getByRole("region", { name: "Конфликт остатка" })).toContainText("30");
  await page.getByRole("button", { name: "Оставить моё значение" }).click(); expect(state.writes).toHaveLength(1);
  await page.getByRole("button", { name: "Сохранить остаток", exact: true }).click(); await expect(field).toHaveValue("33");
  await expect.poll(() => state.writes.length).toBe(2); expect(state.writes[1]).toMatchObject({ expectedBalanceVersion: 2, quantityOnHand: 33 });
  expect(state.writes[1]!.idempotencyKey).not.toBe(state.writes[0]!.idempotencyKey);
});

test("load recovery and permission or connected-source denial", async ({ page }) => {
  const { state } = await stockFixture(page, permissions.filter(value => value !== "inventory.adjust")); state.failRead = true;
  await page.goto(deepLink); await expect(page.getByRole("button", { name: "Повторить загрузку товара" })).toBeVisible();
  state.failRead = false; await page.getByRole("button", { name: "Повторить загрузку товара" }).click();
  await expect(page.getByRole("textbox", { name: "На складе, уп." })).toBeDisabled();
  await expect(page.getByText("Для изменения остатка нужно право на корректировку запасов.")).toBeVisible();
  expect(state.writes).toEqual([]);
});

test("connected source cannot change stock", async ({ page }) => {
  const { state } = await stockFixture(page); state.source = "ERP"; await page.goto(deepLink);
  await expect(page.getByRole("textbox", { name: "На складе, уп." })).toBeDisabled();
  await expect(page.getByText(/Для подключённого источника обновите количество/)).toBeVisible(); expect(state.writes).toEqual([]);
});

test("inspector edits price without stock input or stock write", async ({ page }) => {
  const { state } = await stockFixture(page, permissions.filter(value => value !== "inventory.adjust")); await page.goto("/supplier/products");
  await page.getByRole("button", { name: "Композит для реставрации", exact: true }).click(); await page.getByRole("button", { name: "Изменить цену" }).click();
  const price = page.getByRole("textbox", { name: "Цена за упаковку, ₸", exact: true }); await expect(price).toHaveValue("1000.00");
  await expect(page.getByRole("textbox", { name: "Остаток, упаковок" })).toHaveCount(0);
  await price.fill("1250"); await page.getByRole("button", { name: "Сохранить цену" }).click();
  await expect(page.getByText(/Цена сохранена. Остаток не изменён./)).toBeVisible();
  expect(state.writes[0]).toMatchObject({ amountMinor: "125000" }); expect(state.writes[0]).not.toHaveProperty("quantityOnHand"); expect(state.commercial.balance?.quantityOnHand).toBe("28");
});

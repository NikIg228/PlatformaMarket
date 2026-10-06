import { test, expect } from "@playwright/test";
import { productFixture, sampleOffer, noOverflow, permissions, organizationId, offerId, warehouseId, id } from "./supplier-products.fixture";

for (const width of [1440, 390]) test(`offer inspector reference, menu and dirty navigation ${width}`, async ({ page }, testInfo) => {
  const state = await productFixture(page);
  await page.route("**/api/notifications/**", route => route.fulfill({ json: { items: [], nextCursor: null, unreadCount: 0, asOf: "2026-10-06T00:00:00Z" } }));
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/supplier/products");
  const opener = page.getByRole("button", { name: "Композит для реставрации", exact: true });
  await opener.click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("heading", { name: "Предложение", exact: true })).toBeVisible();
  await expect(panel).toHaveCSS("width", `${Math.min(640, width)}px`);
  await expect(panel.getByRole("region", { name: "Остатки по складам" })).toContainText("28 уп.");
  await expect(panel.getByRole("region", { name: "Остатки по складам" })).toContainText("3 уп.");
  await expect(panel.getByRole("region", { name: "Остатки по складам" })).toContainText("25 уп.");
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath(`inspector-${width}.png`), animations: "disabled", fullPage: true });
  const menu = panel.getByRole("button", { name: "Действия с предложением" });
  await menu.focus(); await menu.press("Enter");
  const preview = page.getByRole("menuitem", { name: /Открыть карточку каталога/ });
  await expect(preview).toHaveAttribute("target", "_blank");
  await expect(preview).toHaveAttribute("href", `/products/${sampleOffer.productVariant.product.id}`);
  await page.keyboard.press("Escape"); await expect(menu).toBeFocused();
  await panel.getByRole("button", { name: "Изменить цену" }).click();
  const field = panel.getByRole("textbox", { name: "Новая цена за уп., ₸", exact: true });
  await expect(field).toBeEnabled(); await field.fill("1250");
  page.once("dialog", dialog => dialog.dismiss()); await panel.getByRole("button", { name: "Закрыть предложение" }).click();
  await expect(field).toHaveValue("1250");
  page.once("dialog", dialog => dialog.dismiss()); await panel.getByRole("button", { name: "← К предложению", exact: true }).click();
  await expect(field).toHaveValue("1250");
  page.once("dialog", dialog => dialog.accept()); await panel.getByRole("button", { name: "← К предложению" }).click();
  await panel.getByRole("link", { name: "Предложить исправление карточки", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`corrections\\?mode=new&offer=${offerId}`));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.unexpected).toEqual([]); expect(state.writes).toEqual([]);
});

test("offer inspector warehouse recovery, delivery save and no unsaved warning after save", async ({ page }) => {
  const state = await productFixture(page);
  await page.route("**/api/notifications/**", route => route.fulfill({ json: { items: [], nextCursor: null, unreadCount: 0, asOf: "2026-10-06T00:00:00Z" } }));
  let fail = true;
  await page.route(`**/api/suppliers/${organizationId}/warehouses`, route => route.fulfill(fail ? { status: 503, json: { message: "Склады временно недоступны" } } : { json: [{ id: warehouseId, name: "Основной склад", status: "ACTIVE" }] }));
  const writes: unknown[] = [];
  await page.route(`**/api/suppliers/${organizationId}/offers/${offerId}/delivery-options`, route => {
    if (route.request().method() === "GET") return route.fulfill({ json: [] });
    const input = route.request().postDataJSON(); writes.push(input);
    return route.fulfill({ json: { ...input, id: id(40), offerId } });
  });
  await page.goto("/supplier/products"); await page.getByRole("button", { name: "Композит для реставрации", exact: true }).click();
  await page.getByRole("button", { name: "Настроить доставку", exact: true }).click();
  await expect(page.getByText("Склады временно недоступны")).toBeVisible(); fail = false;
  await page.getByRole("button", { name: "Повторить загрузку редактора" }).click();
  await page.getByRole("button", { name: "Добавить способ доставки" }).click();
  const minimum = page.getByRole("textbox", { name: "Минимальный срок, часов", exact: true });
  await expect(minimum).toBeVisible(); await minimum.fill("3");
  await page.getByRole("button", { name: "Сохранить доставку", exact: true }).click();
  await expect(page.getByText(/Условия доставки сохранены/)).toBeVisible();
  expect(writes).toEqual([expect.objectContaining({ warehouseId, minLeadTimeHours: 3 })]);
  let prompted = false; page.on("dialog", async dialog => { prompted = true; await dialog.dismiss(); });
  await page.getByRole("button", { name: "← К предложению" }).click();
  await expect(page.getByRole("button", { name: "Изменить цену" })).toBeVisible();
  expect(prompted).toBe(false); expect(state.unexpected).toEqual([]);
});

test("offer inspector missing data and restricted actions", async ({ page }) => {
  const state = await productFixture(page, permissions.filter(value => !["pricing.manage", "delivery.manage", "promotion.manage"].includes(value)));
  await page.route("**/api/notifications/**", route => route.fulfill({ json: { items: [], nextCursor: null, unreadCount: 0, asOf: "2026-10-06T00:00:00Z" } }));
  state.offers = [{ ...sampleOffer, prices: [], inventoryBalances: [] }];
  await page.goto("/supplier/products"); await page.getByRole("button", { name: "Композит для реставрации", exact: true }).click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByText("Остатки ещё не указаны.")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Изменить цену" })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Настроить доставку" })).toHaveCount(0);
  await expect(panel.getByRole("link", { name: "Создать акцию" })).toHaveCount(0);
  await expect(panel.getByRole("link", { name: "Обновить остатки", exact: true })).toHaveAttribute("href", `/supplier/products/inventory?offer=${offerId}&edit=1`);
  await page.keyboard.press("Escape"); await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Композит для реставрации", exact: true })).toBeFocused();
  expect(state.writes).toEqual([]);
});

async function editorFixture(page: import("@playwright/test").Page, missingPackaging = false, allowed = permissions) {
  const base = await productFixture(page, allowed);
  base.offers = [{ ...sampleOffer, packaging: missingPackaging ? null : sampleOffer.packaging }];
  const state = { offer: base.offers[0]!, failures: [] as number[], failRead: false, writes: [] as Record<string, unknown>[], version: 1, price: { amountMinor: "100000", currency: "KZT", includesVat: true, vatRate: null as number | null } };
  await page.route(`**/api/workspaces/supplier/offers/${offerId}`, route => route.fulfill({ json: state.offer }));
  await page.route(`**/api/suppliers/${organizationId}/offers/${offerId}/commercial/**`, route => {
    const request = route.request();
    if (request.method() !== "GET") { const input = request.postDataJSON(); state.writes.push(input); const failure = state.failures.shift(); if (failure) return route.fulfill({ status: failure, json: { message: "Изменение не подтверждено" } }); state.price = { amountMinor: input.amountMinor, currency: "KZT", includesVat: input.includesVat, vatRate: input.vatRate }; state.version++; state.offer = { ...state.offer, prices: [{ ...state.offer.prices[0]!, ...state.price, vatRate: state.price.vatRate === null ? null : String(state.price.vatRate) }] }; }
    else if (state.failRead) return route.fulfill({ status: 503, json: { message: "Цена временно недоступна" } });
    return route.fulfill({ json: { offerId, offerVersion: state.version, warehouseId, publicationStatus: "PUBLISHED", marketplaceVisible: true, price: { ...state.price, vatRate: state.price.vatRate === null ? null : String(state.price.vatRate) }, balance: { id: id(8), version: 1, quantityOnHand: "28", quantityReserved: "3", safetyStock: "0", quantityAvailable: "25", availabilityStatus: "AVAILABLE" } } });
  });
  return { base, state };
}
async function openPrice(page: import("@playwright/test").Page) { await page.goto("/supplier/products"); await page.getByRole("button", { name: "Композит для реставрации", exact: true }).click(); await page.getByRole("button", { name: "Изменить цену", exact: true }).click(); }
for (const width of [1440, 390]) test(`independent price without packaging, VAT dirty guard and updated overview ${width}`, async ({ page }, testInfo) => {
  const { state, base } = await editorFixture(page, true); await page.setViewportSize({ width, height: 850 }); await openPrice(page);
  const field = page.getByRole("textbox", { name: "Новая цена за уп., ₸", exact: true }); await expect(field).toHaveValue("1000.00"); await expect(field).toBeFocused();
  await expect(page.getByRole("combobox", { name: "Упаковка предложения" })).toHaveCount(0); await expect(page.getByRole("link", { name: "Обновить остатки" })).toHaveCount(0);
  await page.getByRole("combobox", { name: "НДС в цене" }).click(); await page.getByRole("option", { name: "Без НДС", exact: true }).click();
  page.once("dialog", dialog => dialog.dismiss()); await page.getByRole("button", { name: "← К предложению" }).click(); await expect(field).toBeVisible();
  await field.fill("0"); await page.getByRole("button", { name: "Сохранить цену", exact: true }).click(); expect(state.writes).toEqual([]); await expect(field).toHaveAttribute("aria-invalid", "true");
  await field.fill("1250"); await noOverflow(page); await page.screenshot({ path: testInfo.outputPath(`price-${width}.png`), fullPage: true });
  await page.getByRole("button", { name: "Сохранить цену", exact: true }).click(); await expect(page.getByRole("heading", { name: "Предложение", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Цена", exact: true })).toContainText(/1\s?250/); await expect(page.getByText("Цена сохранена. Остаток не изменён.")).toBeVisible();
  expect(state.writes[0]).toMatchObject({ amountMinor: "125000", includesVat: false }); expect(state.writes[0]).not.toHaveProperty("quantityOnHand"); expect(base.unexpected).toEqual([]);
});
test("price load recovery, conflict comparison and same-key uncertain retry", async ({ page }) => {
  const { state } = await editorFixture(page); state.failRead = true; await openPrice(page); await expect(page.getByText("Цена временно недоступна")).toBeVisible(); state.failRead = false;
  await page.getByRole("button", { name: "Повторить загрузку цены" }).click(); const field = page.getByRole("textbox", { name: "Новая цена за уп., ₸", exact: true }); await field.fill("1300");
  state.version = 2; state.price.amountMinor = "110000"; state.failures.push(409); await page.getByRole("button", { name: "Сохранить цену", exact: true }).click();
  await expect(page.getByRole("region", { name: "Конфликт цены" })).toContainText(/1\s?100/); await expect(field).toHaveValue("1300"); await expect(page.getByRole("button", { name: "Сохранить цену", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Оставить мои значения" }).click(); state.failures.push(503); await page.getByRole("button", { name: "Сохранить цену", exact: true }).click(); await expect(field).toBeDisabled(); await expect(page.getByRole("button", { name: "Закрыть предложение" })).toBeDisabled();
  await page.getByRole("button", { name: "Повторить сохранение", exact: true }).click(); await expect(page.getByText("Цена сохранена. Остаток не изменён.")).toBeVisible();
  expect(state.writes).toHaveLength(3); expect(state.writes[1]).toEqual(state.writes[2]); expect(state.writes[1]).toMatchObject({ expectedOfferVersion: 2 }); expect(state.writes[0]!.idempotencyKey).not.toBe(state.writes[1]!.idempotencyKey);
});
test("delivery list, explicit edit, duplicate protection and checkbox guard", async ({ page }, testInfo) => {
  await editorFixture(page); const writes: Record<string, unknown>[] = [];
  let option = { id: id(40), offerId, warehouseId, method: "PICKUP", priceType: "FREE", currency: "KZT", fixedAmountMinor: null, freeFromAmountMinor: null, minLeadTimeHours: 2, maxLeadTimeHours: 8, pickupInstructions: null, temperatureControlled: false, installationRequired: false };
  await page.route(`**/api/suppliers/${organizationId}/offers/${offerId}/delivery-options`, route => { if (route.request().method() !== "GET") { const input = route.request().postDataJSON(); writes.push(input); option = { ...option, ...input }; return route.fulfill({ json: option }); } return route.fulfill({ json: [option] }); });
  await page.setViewportSize({ width: 390, height: 850 }); await page.goto("/supplier/products"); await page.getByRole("button", { name: "Композит для реставрации", exact: true }).click(); await page.getByRole("button", { name: "Настроить доставку" }).click();
  await expect(page.getByRole("textbox", { name: "Минимальный срок, часов" })).toHaveCount(0); await expect(page.getByText("Бесплатно · от 2 до 8 ч.")).toBeVisible();
  await page.getByRole("button", { name: "Добавить способ доставки" }).click(); await expect(page.getByRole("button", { name: "Сохранить доставку" })).toBeDisabled(); await page.getByRole("button", { name: "Открыть существующий вариант" }).click();
  await expect(page.getByRole("heading", { name: "Редактирование: Самовывоз" })).toBeFocused(); await expect(page.getByRole("textbox", { name: "Минимальный срок, часов" })).toHaveValue("2"); await expect(page.getByRole("combobox", { name: "Способ доставки", exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Температурный режим" }).check(); page.once("dialog", dialog => dialog.dismiss()); await page.getByRole("button", { name: "Отмена", exact: true }).click(); await expect(page.getByRole("checkbox", { name: "Температурный режим" })).toBeChecked();
  await page.getByRole("textbox", { name: "Минимальный срок, часов" }).fill("4"); await noOverflow(page); await page.screenshot({ path: testInfo.outputPath("delivery-mobile.png"), fullPage: true }); await page.getByRole("button", { name: "Сохранить доставку", exact: true }).click();
  await expect(page.getByText("Условия доставки сохранены.")).toBeVisible(); await expect(page.getByText("Бесплатно · от 4 до 8 ч.")).toBeVisible(); expect(writes).toEqual([expect.objectContaining({ warehouseId, method: "PICKUP", temperatureControlled: true, minLeadTimeHours: 4 })]);
});
test("standalone packaging empty state and truthful published status", async ({ page }) => {
  const { base } = await editorFixture(page, true);
  await page.route("**/api/catalog/offer-options?*", route => route.fulfill({ json: { items: [], nextCursor: null } }));
  await page.goto("/supplier/products"); await page.getByRole("button", { name: "Композит для реставрации", exact: true }).click(); await page.getByRole("button", { name: "Действия с предложением" }).click(); await page.getByRole("menuitem", { name: "Упаковка предложения" }).click();
  await expect(page.getByText(/Для этого варианта нет утверждённой упаковки/)).toBeVisible(); await expect(page.getByRole("combobox", { name: "Упаковка предложения" })).toHaveCount(0); await expect(page.getByRole("button", { name: "Назначить упаковку" })).toHaveCount(0);
  await page.getByRole("button", { name: "Действия с предложением" }).click(); await page.getByRole("menuitem", { name: "Публикация", exact: true }).click(); await expect(page.getByText("Предложение уже опубликовано и видно в каталоге.")).toBeVisible(); expect(base.writes).toEqual([]);
});

for (const kind of ["role", "source", "warehouse"] as const) test(`price editor rejects unavailable ${kind}`, async ({ page }) => {
  const { state, base } = await editorFixture(page, false, kind === "role" ? permissions.filter(item => item !== "pricing.manage") : permissions);
  if (kind === "source") { state.offer = { ...state.offer, sourceType: "ERP" }; base.offers = [state.offer]; }
  if (kind === "warehouse") await page.route(`**/api/suppliers/${organizationId}/warehouses`, route => route.fulfill({ json: [] }));
  await page.goto(`/supplier/products?offer=${offerId}&edit=1`);
  if (kind === "warehouse") await expect(page.getByText(/Для изменения цены нужен действующий склад/)).toBeVisible();
  else await expect(page.getByText("Изменение цены недоступно вашей роли или источнику предложения.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Сохранить цену", exact: true })).toBeDisabled(); expect(state.writes).toEqual([]);
});
test("packaging assignment uses selected version and publication validates fresh state", async ({ page }) => {
  const { state } = await editorFixture(page, true); state.offer = { ...state.offer, publication: { status: "DRAFT", marketplaceVisible: false, blockedReason: null } };
  const writes: Array<{ kind: string; body: unknown }> = [];
  await page.route(`**/api/suppliers/${organizationId}/offers/${offerId}/packaging`, route => { writes.push({ kind: "packaging", body: route.request().postDataJSON() }); state.offer = { ...state.offer, version: 2, packaging: sampleOffer.packaging }; return route.fulfill({ json: state.offer }); });
  await page.route(`**/api/suppliers/${organizationId}/offers/${offerId}/publication`, route => { writes.push({ kind: "publication", body: route.request().postDataJSON() }); state.offer = { ...state.offer, version: 3, publication: { status: "PUBLISHED", marketplaceVisible: true, blockedReason: null } }; return route.fulfill({ json: { offerVersion: 3, status: "PUBLISHED", marketplaceVisible: true } }); });
  await page.goto("/supplier/products"); await page.getByRole("button", { name: "Композит для реставрации", exact: true }).click(); await page.getByRole("button", { name: "Действия с предложением" }).click(); await page.getByRole("menuitem", { name: "Публикация", exact: true }).click(); await expect(page.getByRole("button", { name: "Опубликовать предложение" })).toBeDisabled();
  await page.getByRole("button", { name: "Действия с предложением" }).click(); await page.getByRole("menuitem", { name: "Упаковка предложения" }).click(); await page.getByRole("combobox", { name: "Упаковка предложения" }).click(); await page.getByRole("option", { name: "10 штук · 10 шт.", exact: true }).click();
  page.once("dialog", dialog => dialog.dismiss()); await page.getByRole("button", { name: "Отмена", exact: true }).click(); await expect(page.getByRole("combobox", { name: "Упаковка предложения" })).toContainText("10 штук");
  await page.getByRole("button", { name: "Назначить упаковку" }).click(); await expect(page.getByText("Упаковка назначена. Проверьте цену за единицу продажи.")).toBeVisible();
  await page.getByRole("button", { name: "Действия с предложением" }).click(); await page.getByRole("menuitem", { name: "Публикация", exact: true }).click(); await page.getByRole("button", { name: "Опубликовать предложение" }).click(); await expect(page.getByText("Предложение опубликовано.")).toBeVisible();
  expect(writes).toEqual([{ kind: "packaging", body: { packagingId: id(6), version: 1 } }, { kind: "publication", body: { status: "PUBLISHED", marketplaceVisible: true, expectedVersion: 2 } }]);
});
test("publication read failure cannot publish stale data and role denial stays visible", async ({ page }) => {
  const { state } = await editorFixture(page, false, permissions.filter(value => value !== "catalog.offer.publish")); state.offer = { ...state.offer, publication: { status: "DRAFT", marketplaceVisible: false, blockedReason: null } };
  await page.goto("/supplier/products"); await page.getByRole("button", { name: "Композит для реставрации", exact: true }).click();
  let fail = true; await page.route(`**/api/workspaces/supplier/offers/${offerId}`, route => route.fulfill(fail ? { status: 503, json: { message: "Нет актуальных условий" } } : { json: state.offer }));
  await page.getByRole("button", { name: "Действия с предложением" }).click(); await page.getByRole("menuitem", { name: "Публикация", exact: true }).click(); await expect(page.getByText("Нет актуальных условий")).toBeVisible();
  expect(state.writes).toEqual([]); fail = false; await page.getByRole("button", { name: "Обновить условия предложения" }).click(); await expect(page.getByText("Публикация недоступна вашей роли или источнику предложения.")).toBeVisible(); await expect(page.getByRole("button", { name: "Опубликовать предложение" })).toBeDisabled();
});

test("delivery uncertain result preserves input for explicit comparison", async ({ page }) => {
  await editorFixture(page); let calls = 0;
  const saved = { id: id(40), offerId, warehouseId, method: "PICKUP", priceType: "FREE", currency: "KZT", fixedAmountMinor: null, freeFromAmountMinor: null, minLeadTimeHours: 2, maxLeadTimeHours: 8, pickupInstructions: null, temperatureControlled: false, installationRequired: false };
  await page.route(`**/api/suppliers/${organizationId}/offers/${offerId}/delivery-options`, route => { if (route.request().method() !== "GET") { calls++; return route.fulfill({ status: 503, json: { message: "Ответ не получен" } }); } return route.fulfill({ json: [saved] }); });
  await page.goto("/supplier/products"); await page.getByRole("button", { name: "Композит для реставрации", exact: true }).click(); await page.getByRole("button", { name: "Настроить доставку" }).click(); await page.getByRole("button", { name: "Изменить: Самовывоз" }).click();
  const field = page.getByRole("textbox", { name: "Минимальный срок, часов", exact: true }); await field.fill("6"); await page.getByRole("button", { name: "Сохранить доставку" }).click(); await expect(field).toBeDisabled();
  await page.getByRole("button", { name: "Проверить результат сохранения" }).click(); await expect(page.getByRole("region", { name: "Сверка доставки" })).toContainText("от 2 до 8 ч."); await expect(field).toHaveValue("6");
  await page.getByRole("button", { name: "Оставить мои значения" }).click(); await expect(field).toBeEnabled(); await expect(field).toHaveValue("6"); expect(calls).toBe(1);
  page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", { name: "Отмена", exact: true }).click(); await expect(page.getByRole("button", { name: "Добавить способ доставки" })).toBeVisible();
});

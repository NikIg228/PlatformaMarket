import { test, expect } from "@playwright/test";
import { productFixture, permissions, organizationId, id, offerId, choose, noOverflow } from "./supplier-products.fixture";
import { taxFixture, taxDeclaration } from "./supplier-vat.fixture";
import { calculateVatLine } from "@marketplace/schemas";

for (const width of [1440, 390]) test(`VAT settings ERP save keyboard and recovery ${width}`, async ({ page }, info) => {
  const base = await productFixture(page, [...permissions, "organization.view", "integration.view", "integration.manage"]);
  const state = await taxFixture(page); state.failRead = true;
  const binding = { id: id(95), connectionId: id(96), connectionName: "Тестовая ERP", provider: "ONE_C", warehouseId: null, offerId: null, priority: 100, updatedAt: "2026-10-14T09:00:00.000Z", priceTax: null };
  const erpWrites: unknown[] = [];
  await page.route(`**/api/suppliers/${organizationId}/integrations/price-tax`, route => route.fulfill({ json: [binding] }));
  await page.route(`**/api/suppliers/${organizationId}/integrations/${binding.connectionId}/bindings/${binding.id}/tax`, route => { const input = route.request().postDataJSON(); erpWrites.push(input); return route.fulfill({ json: { ...binding, priceTax: input.priceTax, updatedAt: "2026-10-14T09:01:00.000Z" } }); });
  await page.setViewportSize({ width, height: 1000 }); await page.goto("/supplier/settings?tab=vat");
  await expect(page.getByText("Налоговые настройки временно недоступны", { exact: true })).toBeVisible(); state.failRead = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.getByRole("heading", { name: "НДС для новых предложений" })).toBeVisible();
  await choose(page, "Налоговый режим", "Освобождено от НДС");
  const basis = page.getByRole("textbox", { name: "Основание применения", exact: true }); await basis.fill("Пункт тестового перечня");
  const computed = await basis.evaluate(element => { const style = getComputedStyle(element), control = getComputedStyle(element.closest(".dm-input")!); return { font: style.fontFamily, size: style.fontSize, height: control.height, radius: control.borderRadius }; });
  expect(computed).toMatchObject({ size: "14px", height: "44px", radius: "8px" }); expect(computed.font).toContain("Manrope");
  await page.getByRole("checkbox", { name: "Подтверждаю настройку только для новых предложений и ответственность за применимость режима" }).check();
  state.failSave = true; const save = page.getByRole("button", { name: "Сохранить настройку НДС", exact: true }); await save.focus(); await page.keyboard.press("Enter");
  await expect(page.getByText("Не удалось подтвердить сохранение", { exact: true })).toBeVisible(); await expect(basis).toHaveValue("Пункт тестового перечня");
  state.failSave = false; await save.click(); await expect(page.getByText("Настройка сохранена. Условия существующих предложений не изменены.")).toBeVisible();
  expect(state.writes).toHaveLength(2); expect(state.writes[0]).toEqual(state.writes[1]);
  await choose(page, "Источник цен", "Тестовая ERP · все предложения · приоритет 100");
  await choose(page, "Формат цены ERP", "Цена без НДС — начислить сверху");
  await page.getByRole("textbox", { name: "Поле режима НДС", exact: true }).fill("vatMode");
  await page.getByRole("textbox", { name: "Поле ставки НДС", exact: true }).fill("vatRate");
  await page.getByRole("checkbox", { name: "Подтверждаю формат цен и налоговые условия источника" }).check();
  await noOverflow(page); await page.screenshot({ path: info.outputPath(`vat-settings-${width}.png`), fullPage: true });
  await page.getByRole("button", { name: "Сохранить НДС источника", exact: true }).click();
  await expect(page.getByText("Условия сохранены для следующей синхронизации.")).toBeVisible();
  expect(erpWrites).toEqual([expect.objectContaining({ expectedUpdatedAt: binding.updatedAt, priceTax: expect.objectContaining({ priceIncludesVat: false, vatMode: "vatMode", vatRate: "vatRate", taxAcknowledged: true }) })]);
  expect(base.unexpected).toEqual([]);
});

for (const width of [1440, 390]) test(`VAT bulk selected preview confirm retry ${width}`, async ({ page }, info) => {
  const base = await productFixture(page); await taxFixture(page);
  const writes: Record<string, unknown>[] = []; let fail = true;
  await page.route(`**/api/suppliers/${organizationId}/vat/offers/preview`, route => { const input = route.request().postDataJSON(); return route.fulfill({ json: { previewHash: "a".repeat(64), selection: input.tax.selection, changedCount: input.offerIds.length, unchangedCount: 0,
    items: input.offerIds.map((value: string) => ({ offerId: value, offerVersion: 1, priceId: id(7), name: "Композит", amountMinor: "100000", previous: null, changed: true })) } }); });
  await page.route(`**/api/suppliers/${organizationId}/vat/offers/apply`, route => { const input = route.request().postDataJSON(); writes.push(input); return route.fulfill(fail ? { status: 503, json: { message: "Ответ не получен" } } : { json: { updatedOfferIds: input.offerIds, unchangedCount: 0 } }); });
  await page.setViewportSize({ width, height: 1000 }); await page.goto("/supplier/products");
  await page.getByRole("checkbox", { name: "Выбрать для НДС: Композит для реставрации", exact: true }).check();
  const trigger = page.getByRole("button", { name: "Изменить НДС выбранных (1)" }); await trigger.focus(); await page.keyboard.press("Enter");
  await choose(page, "Налоговый режим", "Облагается НДС"); await choose(page, "Ставка НДС", "16% — общая ставка");
  await page.getByRole("checkbox", { name: "Подтверждаю применимость режима и ставки к этому товару" }).check();
  await page.getByRole("button", { name: "Проверить изменения", exact: true }).click();
  await expect(page.getByText("Будет изменено: 1. Без изменений: 0.")).toBeVisible(); expect(writes).toHaveLength(0);
  await noOverflow(page); await page.screenshot({ path: info.outputPath(`vat-bulk-${width}.png`), fullPage: true });
  await page.getByRole("button", { name: "Подтвердить изменение НДС", exact: true }).click();
  await expect(page.getByRole("button", { name: "Повторить подтверждение", exact: true })).toBeVisible();
  fail = false; await page.getByRole("button", { name: "Повторить подтверждение", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0); expect(writes).toHaveLength(2); expect(writes[0]).toEqual(writes[1]); expect(writes[0]?.offerIds).toEqual([offerId]); expect(base.unexpected).toEqual([]);
});

test("VAT import net preview and stale confirmation preserve file and mapping", async ({ page }, info) => {
  const base = await productFixture(page); await taxFixture(page); const reviews: Record<string, unknown>[] = [];
  await page.route(`**/api/suppliers/${organizationId}/import-tax-preview`, route => { reviews.push(route.request().postDataJSON()); return route.fulfill({ json: { previewHash: "b".repeat(64), counts: { inherited: 1, individual: 0, unchanged: 0, errors: 0, unknown: 0 }, items: [{ rowNumber: 2, kind: "INHERITED", amountMinor: "143209", selection: taxDeclaration.selection, issue: null, offerId: null, offerVersion: null, priceId: null, variantId: id(4) }] } }); });
  let conflict = true;
  await page.route(`**/api/suppliers/${organizationId}/import-batches`, route => route.request().method() === "POST" && conflict ? route.fulfill({ status: 409, json: { message: "Налоговые условия изменились" } }) : route.fallback());
  await page.goto("/supplier/products/import");
  await page.getByLabel("Таблица поставщика").setInputFiles({ name: "vat.csv", mimeType: "text/csv", buffer: Buffer.from("Код,Название,Цена,Валюта\nA,Композит,1234.56,KZT") });
  await page.getByRole("button", { name: "Настроить столбцы", exact: true }).click();
  await choose(page, "НДС в цене файла", "Цена без НДС — начислить сверху");
  await page.getByRole("checkbox", { name: "Подтверждаю налоговые условия строк и формат цен этого прайса" }).check();
  await page.getByRole("button", { name: "Проверить данные", exact: true }).click();
  await expect(page.getByText(/НДС: наследуют настройки 1/)).toBeVisible(); await expect(page.getByRole("table").getByText(/1\s?432,09/)).toBeVisible();
  await page.screenshot({ path: info.outputPath("vat-import-preview.png"), fullPage: true });
  await page.getByRole("button", { name: "Далее: подтверждение", exact: true }).click(); await page.getByRole("button", { name: "Подтвердить и обработать", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Сопоставьте столбцы" })).toBeVisible(); await expect(page.getByText(/файл и столбцы сохранены/)).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Название товара", exact: true })).toContainText("Название");
  conflict = false; await choose(page, "НДС в цене файла", "Цена без НДС — начислить сверху"); await page.getByRole("checkbox", { name: "Подтверждаю налоговые условия строк и формат цен этого прайса" }).check();
  await page.getByRole("button", { name: "Проверить данные", exact: true }).click(); await page.getByRole("button", { name: "Далее: подтверждение", exact: true }).click(); await page.getByRole("button", { name: "Подтвердить и обработать", exact: true }).click();
  await expect(page.getByText(/Всего строк: 1 · обработано: 1/)).toBeVisible();
  expect(reviews).toHaveLength(2); expect(reviews[0]).toMatchObject({ columnMapping: { priceIncludesVat: false, taxAcknowledged: true } });
  expect(base.writes.find(write => write.path.endsWith("/import-batches"))?.body).toMatchObject({ taxPreviewHash: "b".repeat(64) }); expect(base.unexpected).toEqual([]);
});

for (const width of [1440, 390]) test(`VAT buyer consent and immutable order breakdown ${width}`, async ({ page }, info) => {
  const base = await productFixture(page, ["order.create", "order.view", "document.view"]);
  await page.addInitScript(({ organizationId }) => sessionStorage.setItem("dentmarket:buyer-session", JSON.stringify({ capability: "BUYER", organizationId, sessionId: "22222222-2222-4222-8222-222222222222", accessToken: "vat-ui-fixture", accessTokenExpiresAt: Date.now() + 3600000 })), { organizationId });
  await page.route("**/api/auth/workspace-context", route => route.fulfill({ json: { organizationId, organizationDisplayName: "Тестовая клиника", capabilities: ["BUYER"] } }));
  await page.route("**/api/catalog/cities", route => route.fulfill({ json: [{ id: id(90), nameRu: "Алматы" }] }));
  await page.route("**/api/organizations/current/profile", route => route.fulfill({ json: { organizationId, legalName: "Тестовая клиника", displayName: "Тестовая клиника", bin: "970000000001", version: 1, canEdit: true, complete: true,
    profile: { contactName: "Тестовый сотрудник", phone: "+77000000000", email: "fixture@example.invalid", legalAddress: { cityId: id(90), line1: "Тестовый адрес", postalCode: null }, deliveryAddress: { cityId: id(90), line1: "Тестовый адрес", postalCode: null } } } }));
  const previous = { resolvedAt: "2026-10-14T09:00:00.000Z", offerVersion: 1, source: "BASE", ruleId: id(7), unitPriceMinor: "10000", quantity: "1", totalPriceMinor: "10000", currency: "KZT", minimumOrderQuantity: "1", orderIncrement: "1", availableQuantity: "10", fulfillmentStatus: "AVAILABLE",
    tax: calculateVatLine("10000", taxDeclaration) };
  const current = { ...previous, tax: calculateVatLine("10000", { ...taxDeclaration, selection: { mode: "EXEMPT", rate: null, basis: "Тестовый перечень" } }) };
  const item = { id: id(101), offerId, quantity: "1", unitPriceMinor: "10000", totalPriceMinor: "10000", currency: "KZT", offer: { supplier: { organization: { displayName: "Тестовый поставщик" } }, productVariant: { product: { canonicalName: "Материал с НДС" } } } };
  const cart = { id: id(102), buyerOrganizationId: organizationId, version: 1, status: "ACTIVE", currency: "KZT", items: [item], createdAt: "2026-10-14T09:00:00.000Z" };
  let accepted = false; const writes: Record<string, unknown>[] = [];
  await page.route("**/api/workspaces/buyer/carts**", route => route.fulfill({ json: { current: cart, items: [], nextCursor: null } }));
  await page.route(`**/api/carts/${cart.id}/validate`, route => route.fulfill({ json: { cartId: cart.id, cartVersion: cart.version, validatedAt: "2026-10-14T09:00:00.000Z", hasChanges: !accepted, requiresAcceptance: !accepted, canCheckout: accepted,
    items: [{ cartItemId: item.id, offerId, status: accepted ? "UNCHANGED" : "CHANGED", changes: accepted ? [] : ["OFFER_RULES"], previous: accepted ? current : previous, current, canCheckout: accepted, requiresAcceptance: !accepted, message: null }] } }));
  await page.route(`**/api/carts/${cart.id}/reprice`, route => { writes.push(route.request().postDataJSON()); accepted = true; cart.version++; return route.fulfill({ json: cart }); });
  await page.setViewportSize({ width, height: 1000 }); await page.goto("/clinic/cart");
  await expect(page.getByText("Налоговые условия: Включая НДС 16% → Освобождено от НДС", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Оформить заказ", exact: true })).toBeDisabled();
  await expect(page.getByRole("region", { name: "Расчёт НДС", exact: true })).toContainText("Освобождено от НДС");
  const dismiss = page.getByRole("button", { name: "Закрыть уведомление", exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  await noOverflow(page); await page.screenshot({ path: info.outputPath(`vat-cart-${width}.png`), fullPage: true });
  await page.getByRole("button", { name: "Принять изменения", exact: true }).focus(); await page.keyboard.press("Enter"); await expect(page.getByRole("button", { name: "Оформить заказ", exact: true })).toBeEnabled();
  expect(writes).toEqual([expect.objectContaining({ acceptedItems: [expect.objectContaining({ snapshot: expect.objectContaining({ tax: current.tax }) })] })]);
  const orderId = id(103), order = { id: orderId, orderNumber: "VAT-TEST", version: 1, supplierOrganizationId: id(104), buyerOrganizationId: organizationId, status: "AWAITING_CONFIRMATION", paymentStatus: "UNPAID", currency: "KZT", subtotalAmountMinor: "20000", shipments: [],
    items: [{ ...item, acceptedQuantity: null, offerSnapshot: { pricing: previous } }, { ...item, id: id(105), offer: { productVariant: { product: { canonicalName: "Старая позиция без декларации" } } }, offerSnapshot: {} }] };
  await page.route(`**/api/supplier-orders/${orderId}/workflow`, route => route.fulfill({ json: { orderId, order, version: 1, status: order.status, paymentStatus: "UNPAID", invoiceDocumentId: null, claims: [], events: [], reductions: [], returns: [] } }));
  await page.goto(`/clinic/orders/${orderId}`);
  const summary = page.getByRole("region", { name: "Расчёт НДС", exact: true });
  await expect(summary).toContainText("НДС: 13,79"); await expect(summary).toContainText("Позиций с неуточнённым НДС: 1");
  expect(await summary.evaluate(element => { const css = getComputedStyle(element); return { font: css.fontFamily, size: css.fontSize, gap: css.gap }; })).toMatchObject({ font: expect.stringContaining("Manrope"), size: "14px", gap: "12px" });
  await noOverflow(page); await page.screenshot({ path: info.outputPath(`vat-order-${width}.png`), fullPage: true }); expect(base.unexpected).toEqual([]);
});

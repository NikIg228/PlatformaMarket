import { test, expect, type Page } from "@playwright/test";
import { productFixture, organizationId, id, noOverflow, choose } from "./supplier-products.fixture";
import invoice from "./order-invoice.fixture.json";
import type { OrderDiscrepancyView, OrderDiscrepancyCommand } from "@marketplace/schemas";
const orderId = invoice.orderId, shipmentId = id(160), itemId = id(161), date = "2026-10-15T12:00:00Z";
const lines = [{ shipmentItemId: itemId, orderItemId: invoice.lines[0].id, name: invoice.lines[0].name, uom: "шт.", sentQuantity: "10", recordedReceivedQuantity: "0", unitPriceMinor: "5800", taxSnapshot: {}, isGift: false }];
const source = { orderVersion: 1, shipmentVersion: 1, shipmentNumber: "PART-1", documentId: null, documentVersion: null, documentChecksum: null, documentSnapshot: null, sourceReceiptEventId: null, lines };
function stateFixture() { return { failRead: false, failure: 0, allowed: true, requests: [] as OrderDiscrepancyCommand[], rows: [] as OrderDiscrepancyView[] }; }
async function fixture(page: Page, buyer: boolean, state = stateFixture()) {
  await productFixture(page, buyer ? ["order.create", "order.approve", "order.view", "document.view"] : ["order.confirm", "order.view", "document.view"]);
  if (buyer) {
    await page.addInitScript(({ organizationId }) => sessionStorage.setItem("dentmarket:buyer-session", JSON.stringify({ capability: "BUYER", organizationId, sessionId: "22222222-2222-4222-8222-222222222222", accessToken: "discrepancy-ui-fixture", accessTokenExpiresAt: Date.now() + 3600000 })), { organizationId });
    await page.route("**/api/auth/workspace-context", route => route.fulfill({ json: { organizationId, organizationDisplayName: "Тестовая клиника", capabilities: ["BUYER"] } }));
    await page.route("**/api/catalog/cities", route => route.fulfill({ json: [{ id: id(90), nameRu: "Алматы" }] }));
    await page.route("**/api/organizations/current/profile", route => route.fulfill({ json: { organizationId, legalName: "Тестовая клиника", displayName: "Тестовая клиника", bin: "970000000001", version: 1, canEdit: true, complete: true,
      profile: { contactName: "Тестовый сотрудник", phone: "+77000000000", email: "fixture@example.invalid", legalAddress: { cityId: id(90), line1: "Тестовый адрес", postalCode: null }, deliveryAddress: { cityId: id(90), line1: "Тестовый адрес", postalCode: null } } } }));
  } else await page.route("**/api/auth/workspace-context", route => route.fulfill({ json: { organizationId, organizationDisplayName: "Тестовый поставщик", capabilities: ["SUPPLIER"] } }));
  await page.route(`**/api/supplier-orders/${orderId}/invoices`, route => route.fulfill({ json: { orderId, orderVersion: 1, currentDocumentId: null, canPrepare: false, issues: [], invoices: [] } }));
  await page.route(`**/api/supplier-orders/${orderId}/workflow`, route => route.fulfill({ json: { orderId, version: 1, status: "SHIPPED", paymentStatus: "PAID", invoiceDocumentId: null, claims: [], events: [], reductions: [], returns: [],
    order: { id: orderId, orderNumber: "DISCREPANCY-TEST", version: 1, supplierOrganizationId: buyer ? id(104) : organizationId, buyerOrganizationId: buyer ? organizationId : id(104), status: "SHIPPED", paymentStatus: "PAID", currency: "KZT", subtotalAmountMinor: "58000", createdAt: date,
      shipments: [{ id: shipmentId, shipmentNumber: "PART-1", version: 1, status: "DISPATCHED", method: "CARRIER", items: [{ id: itemId, supplierOrderItemId: invoice.lines[0].id, quantity: "10", deliveredQuantity: "0" }] }],
      items: [{ ...invoice.lines[0], quantity: "10", acceptedQuantity: "10", unitPriceMinor: "5800", totalPriceMinor: "58000", currency: "KZT", offerSnapshot: { pricing: { tax: invoice.lines[0].tax } }, offer: { productVariant: { product: { canonicalName: invoice.lines[0].name } } } }] } } }));
  await page.route(`**/api/supplier-orders/${orderId}/discrepancies`, route => {
    if (route.request().method() === "GET") return route.fulfill(state.failRead ? { status: 503, json: { message: "Расхождения временно недоступны" } } : { json: {
      orderId, orderVersion: 1, party: buyer ? "BUYER" : "SUPPLIER", canWrite: state.allowed,
      shipments: [{ id: shipmentId, version: 1, number: "PART-1", eligible: true, lines, documents: [] }], discrepancies: state.rows.filter(row => buyer || row.status !== "DRAFT") } });
    const command = route.request().postDataJSON() as OrderDiscrepancyCommand; state.requests.push(command);
    if (state.failure) return route.fulfill({ status: state.failure, json: { message: state.failure === 409 ? "Данные изменились" : state.failure === 403 ? "Недостаточно прав для действия" : "Ответ сервера не получен" } });
    let row: OrderDiscrepancyView;
    if (command.action === "CREATE") {
      row = { id: id(180 + state.rows.length), shipmentId, version: 1, status: "DRAFT", previousDiscrepancyId: command.previousDiscrepancyId,
        statement: command.statement, source, resolution: null, createdAt: date, updatedAt: date, attachments: [], events: [] }; state.rows.push(row);
    } else {
      row = state.rows.find(r => r.id === command.discrepancyId)!; row.version++;
      if (command.action === "SAVE") row.statement = command.statement;
      if (command.action === "SUBMIT") row.status = "SUBMITTED";
      if (command.action === "RESPOND") { row.status = command.decision === "AGREE" ? "AGREED" : command.decision === "REJECT" ? "REJECTED" : "RESOLUTION_PROPOSED"; row.resolution = command.resolution; }
      if (command.action === "DECIDE") row.status = command.accepted ? "AGREED" : "REJECTED";
    }
    row.events.push({ id: id(200 + state.requests.length), version: row.version, action: command.action, actorId: id(91), organizationId, createdAt: date, details: command });
    return route.fulfill({ status: 201, json: { orderId, discrepancyId: row.id, version: row.version, status: row.status, eventId: row.events.at(-1)!.id } });
  });
  await page.route(`**/api/supplier-orders/${orderId}/discrepancies/attachments`, route => route.fulfill({ status: 201, json: { id: id(240), name: "proof.png", mimeType: "image/png", sizeBytes: 50 } }));
  return state;
}
const dialog = (page: Page) => page.getByRole("dialog");
async function visit(page: Page, buyer = true) { await page.goto(`/${buyer ? "clinic" : "supplier"}/orders/${orderId}`); await page.getByRole("tab", { name: "Отгрузки", exact: true }).click(); }
async function createDraft(page: Page) {
  await page.getByRole("button", { name: "Сообщить о расхождении · PART-1", exact: true }).click();
  await dialog(page).getByRole("textbox", { name: "Фактически получено — позиция 1", exact: true }).fill("8");
  await dialog(page).getByRole("textbox", { name: "Причина и описание", exact: true }).fill("Получено 8 вместо 10, упаковка целая");
  await dialog(page).getByRole("button", { name: "Сохранить черновик", exact: true }).click();
}
for (const width of [1440, 390]) test(`clinic draft recovery, immutable submission and explicit conflict review ${width}`, async ({ page }, info) => {
  const state = await fixture(page, true); state.failRead = true;
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 }); await visit(page);
  await expect(page.getByText("Расхождения временно недоступны", { exact: true })).toBeVisible(); state.failRead = false;
  await page.getByRole("button", { name: "Повторить загрузку расхождений" }).click();
  await expect(page.getByText("Заявлений о расхождениях пока нет.")).toBeVisible(); state.failure = 503;
  await createDraft(page); await expect(dialog(page).getByText("Ответ сервера не получен", { exact: true })).toBeVisible();
  await expect(dialog(page).getByRole("textbox", { name: "Причина и описание", exact: true })).toHaveValue("Получено 8 вместо 10, упаковка целая");
  state.failure = 0; await dialog(page).getByRole("button", { name: "Повторить действие", exact: true }).click();
  await expect(dialog(page).getByRole("button", { name: "Отправить расхождение", exact: true })).toBeVisible(); expect(state.requests[0]).toEqual(state.requests[1]);
  await page.keyboard.press("Escape"); await page.reload(); await page.getByRole("tab", { name: "Отгрузки", exact: true }).click();
  await page.getByRole("button", { name: /Открыть заявление/ }).click();
  await expect(dialog(page)).toContainText("Получено 8 вместо 10");
  state.failure = 409; await dialog(page).getByRole("button", { name: "Отправить расхождение", exact: true }).click();
  await expect(dialog(page).getByRole("button", { name: "Отправить расхождение", exact: true })).toBeDisabled();
  state.failure = 0; await dialog(page).getByRole("button", { name: "Обновить данные расхождения", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Данные проверены, продолжить", exact: true }).click();
  const submit = dialog(page).getByRole("button", { name: "Отправить расхождение", exact: true });
  const styles = await submit.evaluate(e => { const s = getComputedStyle(e); return { font: s.fontFamily, size: s.fontSize, height: s.height, radius: s.borderRadius }; });
  expect(styles).toMatchObject({ font: expect.stringContaining("Manrope"), size: "14px", height: "44px", radius: "8px" });
  await submit.focus(); await page.keyboard.press("Enter");
  await expect(dialog(page)).toContainText("Ожидает ответа поставщика"); await expect(dialog(page).getByRole("button", { name: "Редактировать черновик" })).toHaveCount(0);
  await noOverflow(page); await page.screenshot({ path: info.outputPath(`discrepancy-submitted-${width}.png`), animations: "disabled" });
  await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: /Открыть заявление/ })).toBeFocused();
});
test("supplier counterproposal, clinic decision, rejection and linked revision", async ({ page }, info) => {
  const state = await fixture(page, true); await visit(page); await createDraft(page);
  await dialog(page).getByRole("button", { name: "Отправить расхождение", exact: true }).click();
  await fixture(page, false, state); await visit(page, false); await page.getByRole("button", { name: /Открыть заявление/ }).click();
  await choose(page, "Ответ", "Предложить другой вариант"); await choose(page, "Встречное решение", "Уменьшение обязательства");
  await dialog(page).getByRole("textbox", { name: "Причина ответа", exact: true }).fill("Предлагаем уменьшить обязательство на 2 единицы");
  await dialog(page).getByRole("button", { name: "Отправить ответ", exact: true }).click();
  await expect(dialog(page)).toContainText("Ожидает решения клиники");
  await page.screenshot({ path: info.outputPath("discrepancy-counterproposal.png"), animations: "disabled" });
  await fixture(page, true, state); await visit(page); await page.getByRole("button", { name: /Открыть заявление/ }).click();
  await dialog(page).getByRole("textbox", { name: "Причина ответа", exact: true }).fill("Согласны с уменьшением обязательства");
  await dialog(page).getByRole("button", { name: "Отправить ответ", exact: true }).click();
  await expect(dialog(page)).toContainText("Решение согласовано — требуется исполнение"); await expect(dialog(page)).toContainText("Клиника согласна");
  await page.keyboard.press("Escape"); await createDraft(page); await dialog(page).getByRole("button", { name: "Отправить расхождение", exact: true }).click();
  await fixture(page, false, state); await visit(page, false); await page.getByRole("button", { name: /Открыть заявление/ }).last().click();
  await choose(page, "Ответ", "Отклонить"); await dialog(page).getByRole("textbox", { name: "Причина ответа", exact: true }).fill("Нужны уточнения по второй партии");
  await dialog(page).getByRole("button", { name: "Отправить ответ", exact: true }).click();
  await fixture(page, true, state); await visit(page); await page.getByRole("button", { name: /Открыть заявление/ }).last().click();
  await dialog(page).getByRole("button", { name: "Создать связанную редакцию", exact: true }).click();
  await dialog(page).getByRole("textbox", { name: "Причина и описание", exact: true }).fill("Уточнено по результатам сверки");
  await dialog(page).getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  expect(state.rows[2].previousDiscrepancyId).toBe(state.rows[1].id);
});
test("write denial preserves input and server capabilities disable controls", async ({ page }) => {
  const state = await fixture(page, true); await visit(page); state.failure = 403; await createDraft(page);
  await expect(dialog(page).getByRole("textbox", { name: "Причина и описание", exact: true })).toHaveValue("Получено 8 вместо 10, упаковка целая");
  await expect(dialog(page).getByText("Недостаточно прав для действия", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape"); state.allowed = false; await page.getByRole("button", { name: "Обновить список расхождений" }).click();
  await expect(page.getByRole("button", { name: "Сообщить о расхождении · PART-1", exact: true })).toBeDisabled();
});

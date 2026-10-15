import { test, expect, type Page } from "@playwright/test";
import { productFixture, organizationId, id, noOverflow } from "./supplier-products.fixture";
import invoice from "./order-invoice.fixture.json";
import { shipmentWaybillSnapshotSchema, type ShipmentWaybillView } from "@marketplace/schemas";

async function fixture(page: Page, allowed = true) {
  await productFixture(page, ["order.confirm", "order.view", "shipment.manage", "document.view", ...(allowed ? ["document.issue"] : [])]);
  const shipmentId = id(160), orderId = invoice.orderId;
  const snapshot = shipmentWaybillSnapshotSchema.parse({ templateVersion: "PM_WAYBILL_PREVIEW_V1", orderId, orderNumber: "WAYBILL-TEST", orderVersion: 1,
    shipmentId, shipmentNumber: "PART-1", shipmentVersion: 1, number: "WB-PART-1", version: 1, date: "2026-10-15",
    supplier: invoice.supplier, buyer: invoice.buyer, preparedBy: { id: id(91), name: "Тестовый сотрудник" },
    warehouse: { id: id(50), name: "Склад Алматы", address: "Тестовый адрес склада" },
    recipient: { name: "Тестовая клиника", address: "Тестовый адрес клиники" }, carrierName: null, trackingNumber: null,
    lines: [{ ...invoice.lines[0], shipmentItemId: id(161), orderedQuantity: "2", quantity: "1", unitPriceMinor: "5800", totalMinor: "5800", tax: invoice.lines[0].tax ? { ...invoice.lines[0].tax, grossMinor: "5800", baseMinor: "5000", vatMinor: "800" } : null }],
    totalMinor: "5800", baseMinor: "5000", vatMinor: "800", currency: "KZT" });
  const state = { failRead: false, failPrepare: false, conflict: false, rows: [] as ShipmentWaybillView[], requests: [] as Record<string, unknown>[] };
  const shipment = { id: shipmentId, shipmentNumber: "PART-1", status: "PACKING", version: 1, method: "CARRIER", trackingNumber: null, carrierName: null, updatedAt: "2026-10-15T00:00:00Z",
    warehouse: { name: "Склад Алматы", code: "ALM" }, items: [{ id: id(161), supplierOrderItemId: invoice.lines[0].id, quantity: "1", deliveredQuantity: "0" }] };
  await page.route(`**/api/supplier-orders/${orderId}/workflow`, route => route.fulfill({ json: { orderId, version: 1, status: "ASSEMBLING", paymentStatus: "PAID", invoiceDocumentId: null, claims: [], events: [], actions: [],
    order: { id: orderId, orderNumber: "WAYBILL-TEST", version: 1, supplierOrganizationId: organizationId, buyerOrganizationId: id(104), buyer: { displayName: "Тестовая клиника" }, status: "ASSEMBLING", paymentStatus: "PAID", currency: "KZT", subtotalAmountMinor: "11600", createdAt: "2026-10-15T00:00:00Z", shipments: [shipment],
      items: [{ ...invoice.lines[0], warehouseId: id(50), warehouse: { name: "Склад Алматы", code: "ALM" }, quantity: "2", acceptedQuantity: "2", status: "CONFIRMED", unitPriceMinor: "5800", totalPriceMinor: "11600", currency: "KZT", offerSnapshot: { pricing: { tax: invoice.lines[0].tax } }, offer: { productVariant: { product: { canonicalName: invoice.lines[0].name } } } }] } } }));
  await page.route(`**/api/supplier-orders/${orderId}/invoices`, route => route.fulfill({ json: { orderId, orderVersion: 1, currentDocumentId: null, canPrepare: false, issues: [], invoices: [] } }));
  const endpoint = `**/api/supplier-orders/${orderId}/shipments/${shipmentId}/waybills`;
  await page.route(endpoint, route => route.fulfill(state.failRead ? { status: 503, json: { message: "Партия временно недоступна" } } : { json: { orderId, shipmentId, orderVersion: 1, shipmentVersion: 1,
    canPrepare: true, issues: [], waybills: state.rows, deliveryDocuments: [] } }));
  await page.route(endpoint + "/prepare", route => {
    state.requests.push(route.request().postDataJSON());
    if (state.failPrepare || state.conflict) return route.fulfill({ status: state.conflict ? 409 : 503, json: { message: state.conflict ? "Партия изменилась" : "Ответ формирования не получен" } });
    const row: ShipmentWaybillView = { documentId: id(170 + state.rows.length), number: snapshot.number, version: state.rows.length + 1, status: "PREVIEW", checksum: "a".repeat(64), snapshot };
    state.rows.unshift(row); return route.fulfill({ status: 201, json: row });
  });
  return { orderId, state };
}

for (const width of [1440, 390]) test(`waybill preparation recovery and preview ${width}`, async ({ page }, info) => {
  const { orderId, state } = await fixture(page); state.failRead = true;
  await page.setViewportSize({ width, height: 1000 }); await page.goto(`/supplier/orders/${orderId}`);
  const trigger = page.getByRole("button", { name: "Накладная партии", exact: true }); await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Накладная партии" });
  await expect(dialog.getByText("Партия временно недоступна", { exact: true })).toBeVisible(); state.failRead = false;
  await dialog.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect(dialog.getByText("Накладная этой партии ещё не подготовлена.")).toBeVisible();
  state.failPrepare = true; await dialog.getByRole("button", { name: "Подготовить предпросмотр", exact: true }).click();
  await expect(dialog.getByText("Ответ формирования не получен", { exact: true })).toBeVisible(); state.failPrepare = false;
  const retry = dialog.getByRole("button", { name: "Повторить формирование", exact: true }); await retry.focus(); await page.keyboard.press("Enter");
  await expect(dialog.getByText("Черновик готов", { exact: true })).toBeVisible();
  expect(state.requests).toHaveLength(2); expect(state.requests[0]).toEqual(state.requests[1]);
  await expect(dialog).toContainText("Сумма партии: 58"); await expect(dialog).toContainText("В заказе: 2");
  await expect(dialog.getByRole("button", { name: /^Подписать/ })).toHaveCount(0);
  const computed = await dialog.getByRole("button", { name: "Новая версия", exact: true }).evaluate(element => { const s = getComputedStyle(element); return { font: s.fontFamily, size: s.fontSize, height: s.height, radius: s.borderRadius }; });
  expect(computed).toMatchObject({ font: expect.stringContaining("Manrope"), size: "14px", height: "44px", radius: "8px" });
  await noOverflow(page); await page.screenshot({ path: info.outputPath(`waybill-preview-${width}.png`), fullPage: true, animations: "disabled" });
  state.conflict = true; await dialog.getByRole("button", { name: "Новая версия", exact: true }).click();
  await expect(dialog.getByText("Партия изменилась", { exact: true })).toBeVisible(); state.conflict = false;
  await dialog.getByRole("button", { name: "Новая версия", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Открыть R1", exact: true })).toBeVisible();
  expect(state.requests[2].idempotencyKey).not.toBe(state.requests[3].idempotencyKey);
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click(); await expect(trigger).toBeFocused();
});

test("waybill action requires document issue permission", async ({ page }) => {
  const { orderId } = await fixture(page, false); await page.goto(`/supplier/orders/${orderId}`);
  await expect(page.getByRole("region", { name: "Отгрузки заказа WAYBILL-TEST" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Накладная партии", exact: true })).toBeDisabled();
});

test("mobile preview downloads PDF and labels an outdated saved version", async ({ page }, info) => {
  const { orderId, state } = await fixture(page);
  await page.route("**/api/documents/*/download", route => route.fulfill({ contentType: "application/pdf", headers: { "content-disposition": 'attachment; filename="waybill-preview.pdf"' }, body: "%PDF-1.4\nfixture-only" }));
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`/supplier/orders/${orderId}`);
  const trigger = page.getByRole("button", { name: "Накладная партии", exact: true }); await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Накладная партии" });
  await dialog.getByRole("button", { name: "Подготовить предпросмотр", exact: true }).click();
  const download = page.waitForEvent("download"); await dialog.getByRole("button", { name: "Скачать предпросмотр PDF" }).click();
  expect((await download).suggestedFilename()).toBe("waybill-preview.pdf");
  await page.screenshot({ path: info.outputPath("waybill-mobile-totals.png"), animations: "disabled" });
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click(); state.rows[0].status = "STALE";
  await trigger.click(); await expect(dialog.getByText("Предпросмотр устарел", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
});

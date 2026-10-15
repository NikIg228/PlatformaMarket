import { test, expect, type Page } from "@playwright/test";
import { productFixture, organizationId, id, noOverflow } from "./supplier-products.fixture";
import rawSnapshot from "./order-invoice.fixture.json";
import { orderInvoiceSnapshotSchema, type OrderInvoiceView } from "@marketplace/schemas";

async function invoiceFixture(page: Page, buyer = false) {
  const base = await productFixture(page, buyer ? ["order.create", "order.view", "document.view"] : ["order.confirm", "order.view", "document.issue", "document.view"]);
  if (buyer) {
    await page.addInitScript(({ organizationId }) => sessionStorage.setItem("dentmarket:buyer-session", JSON.stringify({ capability: "BUYER", organizationId, sessionId: "22222222-2222-4222-8222-222222222222", accessToken: "invoice-ui-fixture", accessTokenExpiresAt: Date.now() + 3600000 })), { organizationId });
    await page.route("**/api/auth/workspace-context", route => route.fulfill({ json: { organizationId, organizationDisplayName: "Тестовая клиника", capabilities: ["BUYER"] } }));
    await page.route("**/api/catalog/cities", route => route.fulfill({ json: [{ id: id(90), nameRu: "Алматы" }] }));
    await page.route("**/api/organizations/current/profile", route => route.fulfill({ json: { organizationId, legalName: "Тестовая клиника", displayName: "Тестовая клиника", bin: "970000000001", version: 1, canEdit: true, complete: true,
      profile: { contactName: "Тестовый сотрудник", phone: "+77000000000", email: "fixture@example.invalid", legalAddress: { cityId: id(90), line1: "Тестовый адрес", postalCode: null }, deliveryAddress: { cityId: id(90), line1: "Тестовый адрес", postalCode: null } } } }));
  }
  const snapshot = orderInvoiceSnapshotSchema.parse(rawSnapshot), orderId = snapshot.orderId;
  const state = { version: 1, failRead: false, failPrepare: false, failConfirm: false, stale: false, drafts: [] as OrderInvoiceView[], writes: [] as Record<string, unknown>[], preparations: [] as Record<string, unknown>[] };
  const order = () => ({ id: orderId, orderNumber: "INVOICE-TEST", version: state.version, supplierOrganizationId: buyer ? id(104) : organizationId, buyerOrganizationId: buyer ? organizationId : id(104), status: state.version > 1 ? "AWAITING_PAYMENT" : "CONFIRMED", paymentStatus: "UNPAID", currency: "KZT", subtotalAmountMinor: snapshot.totalMinor, shipments: [],
    items: snapshot.lines.map(line => ({ id: line.id, quantity: line.quantity, acceptedQuantity: line.quantity, unitPriceMinor: line.unitPriceMinor, totalPriceMinor: line.totalMinor, currency: "KZT", offerSnapshot: { pricing: { tax: line.tax } }, offer: { productVariant: { product: { canonicalName: line.name } } } })) });
  const current = () => state.drafts.find(row => row.status === "CONFIRMED")?.documentId ?? null;
  await page.route(`**/api/supplier-orders/${orderId}/workflow`, route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { orderId, order: order(), version: state.version, status: order().status, paymentStatus: "UNPAID", invoiceDocumentId: current(), claims: [], events: [], reductions: [], returns: [] } });
    const command = route.request().postDataJSON(); state.writes.push(command);
    if (state.failConfirm || state.stale) return route.fulfill({ status: state.stale ? 409 : 503, json: { message: state.stale ? "Реквизиты изменились" : "Ответ подтверждения не получен" } });
    const row = state.drafts.find(item => item.documentId === command.documentId)!;
    row.status = "CONFIRMED"; row.confirmedAt = "2026-10-15T10:00:00.000Z"; row.confirmedByName = "Сотрудник"; state.version++;
    return route.fulfill({ json: { orderId, version: state.version, eventId: id(111), status: "AWAITING_PAYMENT", paymentStatus: "UNPAID" } });
  });
  await page.route(`**/api/supplier-orders/${orderId}/invoices`, route => route.fulfill(state.failRead ? { status: 503, json: { message: "Список счетов временно недоступен" } } : { json: { orderId, orderVersion: state.version, currentDocumentId: current(), canPrepare: !buyer, issues: [], invoices: state.drafts } }));
  await page.route(`**/api/supplier-orders/${orderId}/invoices/prepare`, route => {
    state.preparations.push(route.request().postDataJSON());
    if (state.failPrepare) return route.fulfill({ status: 503, json: { message: "Ответ формирования не получен" } });
    const row: OrderInvoiceView = { documentId: id(120 + state.drafts.length), number: snapshot.number, version: state.drafts.length + 1, status: "PREVIEW", checksum: "a".repeat(64), snapshot: { ...snapshot, orderVersion: state.version }, confirmedAt: null, confirmedByName: null };
    state.drafts.unshift(row); return route.fulfill({ status: 201, json: row });
  });
  return { state, base, orderId, snapshot };
}

for (const width of [1440, 390]) test(`invoice preview retry confirm and buyer history ${width}`, async ({ page }, info) => {
  const { state, base, orderId } = await invoiceFixture(page); state.failRead = true;
  await page.setViewportSize({ width, height: 1000 }); await page.goto(`/supplier/orders/${orderId}`);
  await expect(page.getByText("Не удалось загрузить данные счёта", { exact: true })).toBeVisible(); state.failRead = false;
  await page.getByRole("button", { name: "Повторить загрузку счетов" }).first().click();
  state.failPrepare = true; await page.getByRole("button", { name: "Сформировать счёт", exact: true }).click();
  await expect(page.getByText("Ответ формирования не получен", { exact: true })).toBeVisible(); state.failPrepare = false;
  await page.getByRole("button", { name: "Повторить формирование счёта", exact: true }).click();
  expect(state.preparations).toHaveLength(2); expect(state.preparations[0]).toEqual(state.preparations[1]);
  const dialog = page.getByRole("dialog"), confirm = dialog.getByRole("button", { name: "Выставить счёт", exact: true });
  await expect(dialog).toBeVisible(); await expect(confirm).toBeDisabled();
  await expect(dialog).toContainText("К оплате: 116");
  const computed = await confirm.evaluate(element => { const style = getComputedStyle(element); return { font: style.fontFamily, size: style.fontSize, height: style.height, radius: style.borderRadius }; });
  expect(computed).toMatchObject({ font: expect.stringContaining("Manrope"), size: "14px", height: "44px", radius: "8px" });
  await noOverflow(page); await page.screenshot({ path: info.outputPath(`invoice-preview-${width}.png`), fullPage: true, animations: "disabled" });
  await dialog.getByRole("checkbox", { name: "Проверил реквизиты, состав и сумму счёта" }).check();
  state.failConfirm = true; await confirm.focus(); await page.keyboard.press("Enter");
  await expect(dialog.getByText("Ответ подтверждения не получен")).toBeVisible(); state.failConfirm = false;
  await dialog.getByRole("button", { name: "Повторить подтверждение", exact: true }).click();
  await expect(dialog).toHaveCount(0); expect(state.writes).toHaveLength(2); expect(state.writes[0]).toEqual(state.writes[1]);
  await expect(page.getByText("Счёт выставлен и доступен покупателю.")).toBeVisible();
  await page.getByRole("tab", { name: "Документы", exact: true }).click();
  await expect(page.getByRole("button", { name: "Скачать R1", exact: true })).toBeVisible();
  expect(base.unexpected).toEqual([]);

  const clinic = await invoiceFixture(page, true); clinic.state.version = 2; clinic.state.drafts = structuredClone(state.drafts);
  await page.goto(`/clinic/orders/${orderId}`); await page.getByRole("tab", { name: "Документы", exact: true }).click();
  await expect(page.getByRole("button", { name: "Скачать R1", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Сформировать счёт", exact: true })).toHaveCount(0);
  await noOverflow(page); await page.screenshot({ path: info.outputPath(`invoice-buyer-${width}.png`), fullPage: true, animations: "disabled" });
  expect(clinic.base.unexpected).toEqual([]);
});

test("invoice stale confirmation requires a new preview", async ({ page }) => {
  const { state, orderId } = await invoiceFixture(page);
  await page.goto(`/supplier/orders/${orderId}`); await page.getByRole("button", { name: "Сформировать счёт", exact: true }).click();
  await page.getByRole("checkbox", { name: "Проверил реквизиты, состав и сумму счёта" }).check(); state.stale = true;
  await page.getByRole("button", { name: "Выставить счёт", exact: true }).click();
  await expect(page.getByText("Предпросмотр устарел", { exact: true })).toBeVisible(); state.stale = false;
  await page.getByRole("button", { name: "Сформировать актуальный счёт", exact: true }).click();
  await expect(page.getByRole("button", { name: "Выставить счёт", exact: true })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Проверил реквизиты, состав и сумму счёта" }).check();
  await page.getByRole("button", { name: "Выставить счёт", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0); expect(state.writes[0]?.idempotencyKey).not.toBe(state.writes[1]?.idempotencyKey);
});

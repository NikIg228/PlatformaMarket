import { test, expect, type Page } from "@playwright/test";
import { operatorOrderView, orderViewId as id, orderViewDate as at } from "../fixtures/operator-order-view";

async function fixture(page: Page) {
  const { items, detail, document } = operatorOrderView();
  const state = { listStatus: 200, detailStatus: 200, docStatus: 200, requests: [] as string[], unexpected: [] as string[], errors: [] as string[], hold: "", held: false, release: () => {}, detail };
  page.on("pageerror", error => state.errors.push(error.message));
  await page.addInitScript(({ actor, org, session }) => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "synthetic-orders-ui-fixture", sessionId: session, activeOrganizationId: org, user: { id: actor, displayName: "Оператор заказов" }, expiresAt: Date.now() + 3600000 })), { actor: id(1), org: id(40), session: id(41) });
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, ""); state.requests.push(path + url.search);
    if (path === "/organizations") return route.fulfill({ json: [{ id: id(40), capabilities: [{ capability: "MARKETPLACE_OPERATOR" }] }] });
    if (path.startsWith("/notifications/")) return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null, asOf: at } });
    if (path === "/operations/orders") {
      const q = url.searchParams.get("q") ?? "", offset = Number(url.searchParams.get("offset") ?? 0);
      const rows = items.filter(row => (!q || row.orderNumber.includes(q)) && (!url.searchParams.get("paymentStatus") || row.paymentStatus === url.searchParams.get("paymentStatus")));
      if (q && state.hold === q) { state.held = true; await new Promise<void>(resolve => { state.release = resolve; }); }
      return route.fulfill({ status: state.listStatus, json: state.listStatus === 200 ? { items: rows.slice(offset, offset + 25), total: rows.length, offset, limit: 25 } : { code: "UNAVAILABLE", message: "Fixture unavailable" } });
    }
    if (path.startsWith("/operations/orders/")) return route.fulfill({ status: state.detailStatus, json: state.detailStatus === 200 ? state.detail : { code: "NOT_FOUND", message: "Fixture unavailable" } });
    if (path === "/documents/archive") return route.fulfill({ status: state.docStatus, json: state.docStatus === 200 ? { items: [document], nextCursor: null } : { code: "FORBIDDEN", message: "No documents" } });
    if (path.startsWith("/documents/archive/")) return route.fulfill({ json: path.endsWith(id(22)) ? { ...document, id: id(22), version: 1, status: "SUPERSEDED" } : document });
    if (path.endsWith("/download")) return route.fulfill({ contentType: "application/pdf", headers: { "content-disposition": "attachment; filename=fixture.pdf" }, body: "%PDF-1.4\n%%EOF" });
    if (path === "/access-control/permissions") return route.fulfill({ json: ["support.ticket.view"] });
    if (path === "/support/tickets/assignees" || path === "/operations/work-queue/assignees") return route.fulfill({ json: [] });
    if (path === "/support/tickets") return route.fulfill({ json: [{ ...detail.tickets[0], description: "Заявление о недостаче", priority: "NORMAL", assigneeId: null, slaDueAt: null }] });
    if (path === `/support/tickets/${id(16)}`) return route.fulfill({ json: { ...detail.tickets[0], description: "Заявление о недостаче", priority: "NORMAL", version: 1, assigneeId: null, slaDueAt: null, messages: [], nextMessageCursor: null, links: [{ id: id(42), entityType: "SupplierOrder", entityId: detail.workflow.orderId }] } });
    state.unexpected.push(path); return route.fulfill({ status: 500, json: { code: "UNEXPECTED", message: path } });
  });
  return state;
}

for (const width of [1440, 390]) test(`order registry and complete read-only card, documents, support and keyboard ${width}`, async ({ page }, info) => {
  const state = await fixture(page); await page.setViewportSize({ width, height: 1000 });
  await page.goto("/admin?section=orders"); await expect(page.getByText("Найдено заказов: 31", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Далее", exact: true }).click(); await expect(page.getByText("Страница 2", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Открыть заказ ORD-31", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Заказ ORD-31", exact: true })).toBeVisible();
  await page.goBack(); await expect(page.getByText("Страница 2", { exact: true })).toBeVisible();
  await page.goForward(); await expect(page.getByRole("heading", { name: "Заказ ORD-31", exact: true })).toBeVisible();
  await expect(page.getByText("Готовность полного документального комплекта не подтверждена.", { exact: false })).toBeVisible();
  await expect(page.getByText("90 071 992 547 409,93 ₸", { exact: true })).toBeVisible();
  await expect(page.getByText("исходно получено 8; к довозу 2; получено по допоставке 2", { exact: false })).toBeVisible();
  for (const action of ["Подтвердить оплату", "Отправить", "Подтвердить получение", "Согласовать", "Подписать"]) await expect(page.getByRole("button", { name: action, exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(`order-detail-${width}.png`), fullPage: true });
  const docTrigger = page.getByRole("button", { name: "Открыть документ DOC-10 · 2", exact: true }); await docTrigger.click();
  const dialog = page.getByRole("dialog"); await expect(dialog.getByText("Подписи отсутствуют.")).toBeVisible();
  await dialog.getByRole("button", { name: /Редакция 1/ }).click(); await expect(dialog.getByText(/DOC-10 · редакция 1/)).toBeVisible();
  const download = page.waitForEvent("download"); await dialog.getByRole("button", { name: "Скачать оригинальный файл" }).click(); await download;
  await expect(dialog.getByRole("button", { name: "Скачать оригинальный файл" })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(docTrigger).toBeFocused();
  await page.getByRole("link", { name: "Открыть обращение T-31" }).click();
  await expect(page.getByRole("dialog")).toBeVisible(); await page.getByRole("button", { name: "Открыть связанный заказ" }).click();
  await expect(page.getByRole("heading", { name: "Заказ ORD-31", exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("orderId")).toBe(id(130));
  await page.getByRole("link", { name: "К списку заказов" }).click(); await expect(page.getByText("Страница 2", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Номер заказа или участник" }).fill("ORD-31"); await page.getByRole("button", { name: "Найти", exact: true }).click();
  await expect(page.getByText("Найдено заказов: 1", { exact: true })).toBeVisible(); await page.reload(); await expect(page.getByRole("textbox", { name: "Номер заказа или участник" })).toHaveValue("ORD-31");
  await page.screenshot({ path: info.outputPath(`order-registry-${width}.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const styles = await page.getByRole("button", { name: "Найти", exact: true }).evaluate(element => { const css = getComputedStyle(element); return { height: css.minHeight, radius: css.borderRadius, font: css.fontFamily }; });
  expect(styles.height).toBe("44px"); expect(styles.radius).toBe("8px"); expect(styles.font).toContain("Manrope");
  expect(state.errors).toEqual([]); expect(state.unexpected).toEqual([]);
});

test("order registry recovery, empty result, stale request, forbidden detail and legacy queue destination", async ({ page }) => {
  const state = await fixture(page); state.listStatus = 503;
  await page.goto("/admin?section=orders"); await expect(page.getByText("Реестр заказов недоступен")).toBeVisible();
  state.listStatus = 200; await page.getByRole("button", { name: "Повторить загрузку", exact: true }).click(); await expect(page.getByText("Найдено заказов: 31", { exact: true })).toBeVisible();
  const input = page.getByRole("textbox", { name: "Номер заказа или участник" });
  await input.fill("NONE"); await page.getByRole("button", { name: "Найти", exact: true }).click(); await expect(page.getByText("Заказы не найдены", { exact: true })).toBeVisible();
  state.hold = "ORD-01"; await input.fill("ORD-01"); await page.getByRole("button", { name: "Найти", exact: true }).click(); await expect.poll(() => state.held).toBe(true);
  await input.fill("ORD-31"); await page.getByRole("button", { name: "Найти", exact: true }).click(); await expect(page.getByRole("link", { name: "Открыть заказ ORD-31", exact: true })).toBeVisible(); state.release();
  await expect(page.getByRole("link", { name: "Открыть заказ ORD-01", exact: true })).toHaveCount(0);
  state.detailStatus = 403; await page.getByRole("link", { name: "Открыть заказ ORD-31", exact: true }).click(); await expect(page.getByText("Нет доступа к данным.", { exact: false })).toBeVisible(); await expect(page.getByRole("heading", { name: "Заказ ORD-31", exact: true })).toHaveCount(0);
  state.detailStatus = 404; await page.getByRole("button", { name: "Повторить загрузку карточки" }).click(); await expect(page.getByText("Заказ не найден", { exact: true })).toBeVisible();
  state.detailStatus = 200;
  await page.goto(`/admin?section=orders&queueType=SUPPLIER_CONFIRMATION&object=${id(130)}`); await expect(page.getByRole("heading", { name: "Заказ ORD-31", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Объект из очереди" })).toHaveCount(0);
  expect(state.errors).toEqual([]); expect(state.unexpected).toEqual([]);
});

test("analytics and operational queue reach the same order", async ({ page }) => {
  const state = await fixture(page);
  const totals = { createdOrders: 1, confirmedOrders: 0, receivedOrders: 0, fulfilledOrders: 0, cancelledOrders: 0, refusedPriceOrders: 0, refusedStockOrders: 0, refusedOtherOrders: 0, createdGoodsMinor: "1000", confirmedGoodsMinor: "0", receivedGoodsMinor: "0", returnedGoodsMinor: "0", netReceivedGoodsMinor: "0", preliminaryCommissionMinor: "0", accruedCommissionMinor: "0", collectedCommissionMinor: null, commissionDebtMinor: null };
  await page.route("**/api/commerce-analytics?**", route => route.fulfill({ json: {
    period: { from: at, to: at, timezone: "Asia/Qyzylorda", boundary: "FROM_INCLUSIVE_TO_EXCLUSIVE" }, dataset: "BUSINESS", currency: "KZT", generatedAt: at, commissionRateBps: 1000, commissionRuleVersion: "GOODS_RECEIPT_V1", totals,
    repeatBuyers30Days: 0, repeatBuyers60Days: 0, overdueShipmentsAsOfNow: 0, coverage: { untrackedOrdersInPeriod: 0, historyComplete: true, note: "Fixture" }, organizations: [], organizationsTruncated: false,
    events: [{ id: id(70), orderId: id(130), orderNumber: "ORD-31", kind: "CREATED", occurredAt: at, buyerOrganizationId: id(10), supplierOrganizationId: id(11), goodsAmountMinor: "1000", commissionAmountMinor: "0", currency: "KZT", dataset: "BUSINESS" }], totalEvents: 1, page: 1, pageSize: 25,
  } }));
  await page.goto("/admin?section=analytics");
  await page.getByRole("link", { name: "ORD-31", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Заказ ORD-31", exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("orderId")).toBe(id(130));
  await page.route("**/api/operations/dashboard", route => route.fulfill({ json: { observedAt: at, scope: "PLATFORM_CURRENT_ALL_STATUSES", organizations: { status: "AVAILABLE", value: 2 }, masterProducts: { status: "AVAILABLE", value: 1 }, effectivePermissions: { status: "AVAILABLE", value: 1 } } }));
  await page.route("**/api/operations/work-queue?**", route => route.fulfill({ json: { generatedAt: at, operatorOrganizationId: id(40), totalOpenItems: 1, sections: [{ type: "SUPPLIER_CONFIRMATION", priority: "NORMAL", count: 1, hasMore: false, items: [{ id: id(130), orderNumber: "ORD-31", reason: "Подтверждение поставщика", href: `/admin?section=orders&queueType=SUPPLIER_CONFIRMATION&object=${id(130)}`, assignment: null }] }] } }));
  await page.goto("/admin?section=overview");
  await page.getByRole("link", { name: "Открыть объект", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Заказ ORD-31", exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("orderId")).toBe(id(130));
  expect(state.errors).toEqual([]); expect(state.unexpected).toEqual([]);
});

test("supplier admission remains available from the organization registry", async ({ page }) => {
  const state = await fixture(page);
  await page.route("**/api/operations/organizations?**", route => route.fulfill({ json: { items: [], total: 0, offset: 0, limit: 25 } }));
  let admissionReads = 0;
  await page.route("**/api/supplier-terms/operator/acceptances", route => { admissionReads++; return route.fulfill({ json: { items: [] } }); });
  await page.goto("/admin?section=organizations");
  await expect(page.getByRole("heading", { name: "Реестр организаций", exact: true })).toBeVisible();
  expect(admissionReads).toBe(0);
  await page.getByText("Договорный допуск поставщиков", { exact: true }).click();
  await expect(page.getByText("Заявок пока нет", { exact: true })).toBeVisible();
  expect(admissionReads).toBe(1);
  expect(state.errors).toEqual([]); expect(state.unexpected).toEqual([]);
});

import { expect, test, type Page } from "@playwright/test";
import type { OperatorDocumentException, OperatorExceptionReview } from "@marketplace/schemas";
import { operatorOrderView, orderViewId as id, orderViewDate as at } from "../fixtures/operator-order-view";
import { queueItem, queuePage } from "../fixtures/operation-queue-view";

const reason = "Проверены количества исходной партии и заявление клиники", nextStep = "Поставщику согласовать довоз недостающих двух единиц";
async function fixture(page: Page) {
  const { detail, document } = operatorOrderView();
  const view: OperatorDocumentException = { id: id(20), version: 2, status: "SUBMITTED", kind: "SHORTAGE", reason: "Получено 8 вместо 10", resolution: null,
    order: { id: id(130), number: "ORD-31", version: 3 }, shipment: { id: id(11), number: "SHP-10", version: 2, status: "PARTIALLY_DELIVERED" },
    buyer: { id: id(2), name: "Клиника проверки" }, supplier: { id: id(3), name: "Поставщик проверки" }, sourceDocument: { id: id(9), version: 2 },
    canViewDocuments: true, canViewSupport: true, canPublish: true, reviewStatus: "PENDING",
    lines: [{ id: id(12), name: "Композит", uom: "шт", sentQuantity: "10", reportedQuantity: "8", damagedQuantity: "0", receivedQuantity: "8" }],
    events: [{ id: id(23), action: "SUBMIT", at, version: 2, reason: null, nextStep: null, decision: null, accepted: null }], tickets: detail.tickets };
  const state = { view, readStatus: 200, commandStatus: 201, refreshFailure: false, uncertain: false, commits: 0, writes: [] as OperatorExceptionReview[], queueReads: [] as string[],
    errors: [] as string[], unexpected: [] as string[], hold: false, held: false, release: () => {} };
  const keys = new Set<string>();
  await page.addInitScript(org => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "synthetic-exception-fixture", activeOrganizationId: org, sessionId: org, user: { id: org }, expiresAt: Date.now() + 3600000 })), id(40));
  page.on("pageerror", error => state.errors.push(error.message));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, "");
    if (path === "/organizations") return route.fulfill({ json: [{ id: id(40), capabilities: [{ capability: "MARKETPLACE_OPERATOR" }] }] });
    if (path === "/access-control/permissions") return route.fulfill({ json: ["order.confirm", "support.ticket.manage", "support.ticket.view", "document.view"] });
    if (path.startsWith("/notifications/")) return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null, asOf: at } });
    if (path === "/operations/work-queue/assignees") return route.fulfill({ json: [] });
    if (path === "/operations/work-queue") {
      state.queueReads.push(url.search);
      const item = queueItem({ id: view.id, queueType: "DOCUMENT_EXCEPTION", title: "ORD-31 · SHP-10", href: `/admin?section=orders&queueType=DOCUMENT_EXCEPTION&object=${view.id}` });
      return route.fulfill({ json: queuePage(view.reviewStatus === "PENDING" ? [item] : [], { operatorOrganizationId: id(40), offset: Number(url.searchParams.get("offset") ?? 0) }) });
    }
    if (["/operations/dashboard", "/operations/capabilities"].includes(path)) return route.fulfill({ status: 503, json: { message: "Unrelated fixture summary" } });
    if (path.startsWith("/operations/document-exceptions/")) {
      if (route.request().method() === "GET") {
        const selectedId = path.split("/").at(-1)!;
        const json = { ...structuredClone(view), id: selectedId, order: { ...view.order, number: selectedId === id(20) ? "ORD-31" : "ORD-SECOND" } };
        if (state.hold && selectedId === id(20)) { state.held = true; await new Promise<void>(resolve => { state.release = resolve; }); }
        return route.fulfill({ status: state.readStatus, json: state.readStatus === 200 ? json : { message: "Нет доступа или соединения" } });
      }
      const command = route.request().postDataJSON() as OperatorExceptionReview; state.writes.push(command);
      if (state.commandStatus !== 201) return route.fulfill({ status: state.commandStatus, json: { message: "Данные изменились" } });
      if (!keys.has(command.idempotencyKey)) {
        keys.add(command.idempotencyKey); state.commits++; view.version++; view.reviewStatus = "REVIEWED"; view.canPublish = false;
        view.events.push({ id: id(24), action: "OPERATOR_REVIEW", at, version: view.version, reason: command.reason, nextStep: command.nextStep, decision: null, accepted: null });
      }
      if (state.uncertain) { state.uncertain = false; return route.fulfill({ status: 503, json: { message: "Ответ не получен" } }); }
      if (state.refreshFailure) state.readStatus = 503;
      return route.fulfill({ status: 201, json: { orderId: view.order.id, discrepancyId: view.id, version: view.version, status: view.status, eventId: id(24), reviewStatus: "REVIEWED" } });
    }
    if (path === `/operations/orders/${id(130)}`) return route.fulfill({ json: detail });
    if (path === "/documents/archive") return route.fulfill({ json: { items: [document], nextCursor: null } });
    if (path.startsWith("/documents/archive/")) return route.fulfill({ json: document });
    if (path === "/support/tickets/assignees") return route.fulfill({ json: [] });
    if (path === "/support/tickets") return route.fulfill({ json: [{ ...detail.tickets[0], description: "Недостача", priority: "NORMAL", assigneeId: null, slaDueAt: null }] });
    if (path === `/support/tickets/${id(16)}`) return route.fulfill({ json: { ...detail.tickets[0], description: "Недостача", priority: "NORMAL", version: 1, assigneeId: null, slaDueAt: null, messages: [], links: [], hasOlder: false } });
    state.unexpected.push(path); return route.fulfill({ status: 500, json: { message: "Unexpected fixture endpoint" } });
  });
  return { state, url: `/admin?section=orders&queueType=DOCUMENT_EXCEPTION&object=${id(20)}&queueKind=DOCUMENT_EXCEPTION&queueQ=ORD-31&queueOffset=50` };
}
async function fill(page: Page) {
  await page.getByRole("textbox", { name: "Рекомендация оператора", exact: true }).fill(reason);
  await page.getByRole("textbox", { name: "Следующий шаг для сторон", exact: true }).fill(nextStep);
}
async function publish(page: Page) {
  await page.getByRole("button", { name: "Опубликовать рекомендацию", exact: true }).click();
  await page.getByRole("dialog", { name: "Публикация рекомендации" }).getByRole("button", { name: "Подтвердить публикацию" }).click();
}
for (const width of [1440, 390]) test(`document exception queue, confirmation, focus and publication ${width}`, async ({ page }, info) => {
  const { state } = await fixture(page); await page.setViewportSize({ width, height: 1000 });
  await page.goto("/admin?section=overview&queueKind=DOCUMENT_EXCEPTION&queueQ=ORD-31&queueOffset=50");
  await page.getByRole("link", { name: "Открыть объект", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Документальное расхождение · ORD-31", exact: true })).toBeVisible();
  await expect(page.getByRole("table", { name: "Сравнение количеств по расхождению" })).toContainText("8");
  await fill(page); const button = page.getByRole("button", { name: "Опубликовать рекомендацию", exact: true });
  await button.click(); await expect(page.getByRole("dialog", { name: "Публикация рекомендации" })).toContainText("само расхождение не закрывается");
  await page.keyboard.press("Escape"); await expect(button).toBeFocused(); expect(state.writes).toHaveLength(0);
  await page.screenshot({ path: info.outputPath(`exception-form-${width}.png`), animations: "disabled" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath(`exception-${width}.png`), fullPage: true, animations: "disabled" });
  expect(await button.evaluate(el => { const s = getComputedStyle(el); return { height: s.height, radius: s.borderRadius, size: s.fontSize, font: s.fontFamily }; })).toMatchObject({ height: "44px", radius: "8px", size: "14px", font: expect.stringContaining("Manrope") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await publish(page); await expect(page.getByText("Редакция рассмотрена оператором", { exact: true })).toBeVisible();
  expect(state.writes[0]).toMatchObject({ reason, nextStep, expectedOrderVersion: 3, expectedShipmentVersion: 2, expectedExceptionVersion: 2 });
  await expect(page.getByText(`Следующий шаг: ${nextStep}`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Вернуться к очереди" }).click();
  await expect(page).toHaveURL(/queueKind=DOCUMENT_EXCEPTION/); await expect(page).toHaveURL(/queueOffset=50/);
  expect(new URL(page.url()).searchParams.get("queueQ")).toBe("ORD-31");
  await expect(page.getByRole("link", { name: "Открыть объект", exact: true })).toHaveCount(0);
  expect(state.commits).toBe(1); expect(state.unexpected).toEqual([]); expect(state.errors).toEqual([]);
});
test("document exception keeps one command after an uncertain outcome", async ({ page }) => {
  const { state, url } = await fixture(page); state.uncertain = true; await page.goto(url); await fill(page); await publish(page);
  await expect(page.getByRole("button", { name: "Повторить публикацию" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Рекомендация оператора", exact: true })).toHaveValue(reason);
  await page.getByRole("button", { name: "Повторить публикацию" }).click();
  await expect(page.getByText("Редакция рассмотрена оператором", { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(2); expect(state.writes[1]).toEqual(state.writes[0]); expect(state.commits).toBe(1);
});
test("document exception preserves a conflict draft until explicit review", async ({ page }) => {
  const { state, url } = await fixture(page); state.commandStatus = 409; await page.goto(url); await fill(page); await publish(page);
  await expect(page.getByText(/Стороны или другой оператор изменили данные/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Рекомендация оператора", exact: true })).toHaveValue(reason);
  state.view.version = 3; state.commandStatus = 201;
  await page.getByRole("button", { name: "Обновить расхождение", exact: true }).click();
  await expect(page.getByRole("button", { name: "Опубликовать рекомендацию", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Данные проверены, продолжить" }).click(); await publish(page);
  await expect(page.getByText("Редакция рассмотрена оператором", { exact: true })).toBeVisible();
  expect(state.writes[1]).toMatchObject({ expectedExceptionVersion: 3, reason, nextStep }); expect(state.writes[1].idempotencyKey).not.toBe(state.writes[0].idempotencyKey);
});
test("document exception distinguishes committed publication from failed refresh", async ({ page }) => {
  const { state, url } = await fixture(page); state.refreshFailure = true; await page.goto(url); await fill(page); await publish(page);
  await expect(page.getByText("Операторская обработка этой редакции завершена. Документальное расхождение сохраняет свой статус.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Опубликовать рекомендацию", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Повторить публикацию" })).toHaveCount(0);
  state.readStatus = 200; await page.getByRole("button", { name: "Обновить расхождение", exact: true }).click();
  await expect(page.getByText("Редакция рассмотрена оператором", { exact: true })).toBeVisible(); expect(state.writes).toHaveLength(1);
});
test("document exception read recovery, denied write and exact linked objects", async ({ page }) => {
  const { state, url } = await fixture(page); state.readStatus = 503; await page.goto(url);
  await expect(page.getByRole("button", { name: "Повторить загрузку расхождения" })).toBeVisible();
  state.readStatus = 200; state.view.canPublish = false; await page.getByRole("button", { name: "Повторить загрузку расхождения" }).click();
  await expect(page.getByText("Для публикации рекомендации требуется право управления обращениями.", { exact: true })).toBeVisible();
  const document = page.getByRole("button", { name: "Открыть исходную накладную · редакция 2" }); await document.click();
  await expect(page.getByRole("dialog", { name: "Накладная SHP-10" })).toBeVisible(); await page.keyboard.press("Escape"); await expect(document).toBeFocused();
  await page.getByRole("link", { name: "Открыть заказ ORD-31" }).click(); await expect(page).toHaveURL(new RegExp(`orderId=${id(130)}`));
  await page.getByRole("link", { name: "Открыть расхождение · редакция 4" }).click();
  await page.getByRole("link", { name: "Открыть обращение T-31" }).click(); await expect(page).toHaveURL(new RegExp(`ticketId=${id(16)}`));
  expect(state.writes).toEqual([]); expect(state.unexpected).toEqual([]);
});
test("document exception ignores a late response for another selected case", async ({ page }) => {
  const { state, url } = await fixture(page); state.hold = true; await page.goto(url); await expect.poll(() => state.held).toBe(true);
  await page.evaluate(next => { history.pushState(null, "", next); window.dispatchEvent(new PopStateEvent("popstate")); }, url.replace(id(20), id(21)));
  await expect(page.getByRole("heading", { name: "Документальное расхождение · ORD-SECOND", exact: true })).toBeVisible();
  state.release(); await expect(page.getByRole("heading", { name: "Документальное расхождение · ORD-31", exact: true })).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

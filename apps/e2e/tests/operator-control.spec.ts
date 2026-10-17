import { expect, test, type Page } from "@playwright/test";
import type { OperatorAuditEntry, OperatorTechnical, OutboxDeadLetterItem, OutboxReplayInput } from "@marketplace/schemas";
const id = (n: number) => `73000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const at = "2026-10-17T03:00:00.000Z";
async function fixture(page: Page) {
  await page.addInitScript(org => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "synthetic-control", activeOrganizationId: org, sessionId: org, user: { id: org }, expiresAt: Date.now() + 3600000 })), id(1));
  const entries: OperatorAuditEntry[] = Array.from({ length: 27 }, (_, i) => ({ id: id(100 + i), action: "order.confirmed", entityType: "SupplierOrder", entityId: id(3), actor: { id: id(4), name: "Сотрудник теста" }, organization: { id: id(1), name: "Организация теста" }, createdAt: at, redacted: true, changes: [{ field: "status", label: "Статус", before: "NEW", after: "CONFIRMED" }], href: `/admin?section=orders&orderId=${id(3)}` }));
  const technical: OperatorTechnical = { observedAt: at, scope: "PLATFORM_CURRENT_STATE", canReplay: true, search: { status: "AVAILABLE", data: { products: 10, indexed: 8, missing: 2, lastIndexedAt: at } }, outbox: { status: "AVAILABLE", data: { pending: 2, processing: 0, failed: 1, deadLetter: 1, published: 5 } }, notifications: { status: "FORBIDDEN", data: null, reason: "INSUFFICIENT_PERMISSIONS" }, background: { status: "AVAILABLE", data: { scope: "CURRENT_PROCESS", status: "ok", configured: false, producer: "disabled", consumer: "disabled", counts: null } } };
  const event: OutboxDeadLetterItem = { id: id(2), aggregateType: "SupplierOrder", aggregateId: id(3), eventType: "order.confirmed", status: "DEAD_LETTER", attempts: 5, maxAttempts: 5, availableAt: at, lockedAt: null, publishedAt: null, lastError: "Обработка события завершилась ошибкой.", createdAt: at };
  const state = { auditStatus: 200, auditEmpty: false, listStatus: 200, commandStatus: 201, uncertain: false, refreshFailure: false, gone: false, hold: false, held: false, release: () => {}, auditQueries: [] as URLSearchParams[], writes: [] as OutboxReplayInput[], commits: 0, unexpectedWrites: [] as string[] };
  const keys = new Set<string>();
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, "");
    if (path === "/operations/audit") {
      state.auditQueries.push(url.searchParams); const offset = Number(url.searchParams.get("offset") ?? 0);
      if (state.hold) { state.held = true; state.hold = false; await new Promise<void>(resolve => { state.release = resolve; }); }
      return route.fulfill({ status: state.auditStatus, json: state.auditStatus === 200 ? { items: state.auditEmpty ? [] : entries.slice(offset, offset + 25), total: state.auditEmpty ? 0 : entries.length, offset, limit: 25 } : { message: "Недоступно" } });
    }
    if (path === "/operations/technical") return route.fulfill({ json: technical });
    if (path === "/operations/outbox/dead-letter") return route.fulfill({ status: state.listStatus, json: state.listStatus === 200 ? { items: state.gone ? [] : [event], total: state.gone ? 0 : 1, offset: Number(url.searchParams.get("offset") ?? 0), limit: 25, generatedAt: at } : { message: "Недоступно" } });
    if (path === `/operations/outbox/dead-letter/${event.id}/replay`) {
      const command = route.request().postDataJSON() as OutboxReplayInput; state.writes.push(command);
      if (state.commandStatus !== 201) return route.fulfill({ status: state.commandStatus, json: { message: "Состояние изменилось" } });
      if (!keys.has(command.idempotencyKey)) { keys.add(command.idempotencyKey); state.commits++; state.gone = true; }
      if (state.uncertain) { state.uncertain = false; return route.fulfill({ status: 503, json: { message: "Ответ потерян" } }); }
      if (state.refreshFailure) state.listStatus = 503;
      return route.fulfill({ status: 201, json: { eventId: event.id, status: "PENDING", attempts: 0, replayedAt: at } });
    }
    if (route.request().method() !== "GET") { state.unexpectedWrites.push(path); return route.fulfill({ status: 500, json: {} }); }
    if (path === "/organizations") return route.fulfill({ json: [{ id: id(1), capabilities: [{ capability: "MARKETPLACE_OPERATOR" }] }] });
    if (path === "/access-control/permissions") return route.fulfill({ json: ["audit.view", "operations.outbox.view", "operations.outbox.replay"] });
    if (path.startsWith("/notifications/")) return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null, asOf: at } });
    if (path.startsWith("/operations/orders/")) return route.fulfill({ status: 403, json: { message: "Fixture detail unavailable" } });
    return route.fulfill({ json: [] });
  });
  return { state, event, technical };
}
const technicalUrl = "/admin?section=security&controlView=technical";
test("operator control invalid filters preserve draft without requests or URL failure", async ({ page }) => {
  const { state } = await fixture(page); await page.goto("/admin?section=security");
  await page.getByRole("button", { name: "Изменения", exact: true }).first().waitFor(); const count = state.auditQueries.length;
  await page.getByLabel("ID сотрудника", { exact: true }).fill("bad-id"); await page.getByRole("button", { name: "Применить фильтры", exact: true }).click(); await expect(page.getByRole("alert").filter({ hasText: "Проверьте UUID" })).toBeVisible(); expect(state.auditQueries.length).toBe(count); await expect(page.getByLabel("ID сотрудника", { exact: true })).toHaveValue("bad-id");
  await page.getByRole("tab", { name: "Техническое состояние" }).click(); await page.getByLabel("Тип события", { exact: true }).fill("#bad"); await page.getByRole("button", { name: "Найти события", exact: true }).click(); await expect(page.getByText(/Укажите UUID события и тип до/)).toBeVisible(); await expect(page.getByLabel("Тип события", { exact: true })).toHaveValue("#bad"); await expect(page).not.toHaveURL(/outboxEventType/);
});
async function openReplay(page: Page) { await page.getByRole("button", { name: "Повторить событие", exact: true }).click(); await page.getByRole("textbox", { name: "Причина повтора", exact: true }).fill("Причина сбоя проверена оператором"); }
for (const width of [1440, 390]) test(`operator control audit filters, paging, diff and keyboard ${width}`, async ({ page }, info) => {
  const { state } = await fixture(page); await page.setViewportSize({ width, height: 1000 }); await page.goto("/admin?section=security");
  await expect(page.getByRole("status").filter({ hasText: "Найдено событий: 27" })).toBeVisible();
  await page.getByLabel("ID сотрудника", { exact: true }).fill(id(4)); await page.getByLabel("ID организации", { exact: true }).fill(id(1)); await page.getByLabel("Действие", { exact: true }).fill("order.confirmed"); await page.getByLabel("Дата с", { exact: true }).fill("2026-10-17"); await page.getByLabel("Дата по", { exact: true }).fill("2026-10-17");
  const apply = page.getByRole("button", { name: "Применить фильтры", exact: true }); await apply.click(); await expect(page).toHaveURL(/auditActor=/);
  await expect.poll(() => state.auditQueries.at(-1)?.get("dateFrom")).toBe("2026-10-17");
  await page.getByRole("navigation", { name: "Страницы журнала" }).getByRole("button", { name: "Далее", exact: true }).click(); await expect(page).toHaveURL(/auditOffset=25/); await expect(page.getByRole("button", { name: "Изменения", exact: true })).toHaveCount(2);
  const changes = page.getByRole("button", { name: "Изменения", exact: true }).first(); await changes.focus(); await page.keyboard.press("Enter"); const dialog = page.getByRole("dialog", { name: "Изменения события" }); await expect(dialog).toContainText("CONFIRMED"); await expect(dialog).toContainText("Часть полей скрыта");
  await page.screenshot({ path: info.outputPath(`audit-diff-${width}.png`), fullPage: true });
  expect(await dialog.evaluate(el => getComputedStyle(el).borderRadius)).toBe("16px");
  await page.keyboard.press("Escape"); await expect(changes).toBeFocused();
  await changes.click(); await dialog.getByRole("link", { name: "Открыть объект" }).click(); await expect(page).toHaveURL(/section=orders/); await expect(page).toHaveURL(/auditOffset=25/); await page.goBack(); await expect(page.getByRole("button", { name: "Изменения", exact: true })).toHaveCount(2);
  const styles = await apply.evaluate(el => { const s = getComputedStyle(el); return { font: s.fontFamily, size: s.fontSize, height: s.height, radius: s.borderRadius, overflow: document.documentElement.scrollWidth > innerWidth }; });
  expect(styles).toMatchObject({ size: "14px", height: "44px", radius: "8px", overflow: false }); expect(styles.font).toContain("Manrope");
  await page.screenshot({ path: info.outputPath(`audit-${width}.png`), fullPage: true }); expect(state.unexpectedWrites).toEqual([]);
});
test("operator control empty, error, retry, denied and late response", async ({ page }) => {
  const { state } = await fixture(page); state.auditStatus = 503; await page.goto("/admin?section=security"); await expect(page.getByText("Журнал не обновлён", { exact: true })).toBeVisible();
  state.auditStatus = 200; state.auditEmpty = true; await page.getByRole("button", { name: "Повторить загрузку журнала" }).click(); await expect(page.getByText("События не найдены", { exact: true })).toBeVisible();
  state.auditEmpty = false; await page.getByRole("button", { name: "Обновить журнал" }).click(); await expect(page.getByRole("button", { name: "Изменения", exact: true })).toHaveCount(25);
  state.auditStatus = 403; await page.getByRole("button", { name: "Обновить журнал" }).click(); await expect(page.getByRole("button", { name: "Изменения", exact: true })).toHaveCount(0);
  state.auditStatus = 200; state.hold = true; await page.getByRole("button", { name: "Повторить загрузку журнала" }).click(); await expect.poll(() => state.held).toBe(true);
  await page.getByRole("tab", { name: "Техническое состояние" }).click(); state.release(); await expect(page.getByRole("heading", { name: "Технический контроль", exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: "Изменения", exact: true })).toHaveCount(0);
});
for (const width of [1440, 390]) test(`operator control replay confirmation and refresh failure ${width}`, async ({ page }, info) => {
  const { state } = await fixture(page); state.refreshFailure = true; await page.setViewportSize({ width, height: 1000 }); await page.goto(technicalUrl);
  await expect(page.getByText("Нет прав на этот источник.", { exact: true })).toBeVisible(); await expect(page.getByText("Очередь не настроена", { exact: true })).toBeVisible();
  await openReplay(page); await page.keyboard.press("Escape"); expect(state.writes).toHaveLength(0); await expect(page.getByRole("button", { name: "Повторить событие", exact: true })).toBeFocused();
  await openReplay(page); await page.screenshot({ path: info.outputPath(`replay-${width}.png`), fullPage: true }); await page.getByRole("button", { name: "Подтвердить повтор", exact: true }).click();
  await expect(page.getByText("Событие поставлено в очередь", { exact: true })).toBeVisible(); await expect(page.getByText("Список событий не обновлён", { exact: true })).toBeVisible(); expect(state.commits).toBe(1); expect(state.writes[0]).toMatchObject({ expectedAvailableAt: at, expectedAttempts: 5 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false); await page.screenshot({ path: info.outputPath(`technical-${width}.png`), fullPage: true }); expect(state.unexpectedWrites).toEqual([]);
});
test("operator control uncertain replay survives reload with the same key and reason", async ({ page }) => {
  const { state } = await fixture(page); state.uncertain = true; await page.goto(technicalUrl); await openReplay(page); await page.getByRole("button", { name: "Подтвердить повтор", exact: true }).click(); await expect(page.getByText("Повтор не подтверждён", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Вернуться к запросу" })).toBeVisible(); await page.reload(); await page.getByRole("button", { name: "Вернуться к запросу" }).click(); await expect(page.getByRole("textbox", { name: "Причина повтора", exact: true })).toBeDisabled(); await page.getByRole("button", { name: "Повторить тот же запрос", exact: true }).click(); await expect(page.getByText("Событие поставлено в очередь", { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(2); expect(state.writes[0]).toEqual(state.writes[1]); expect(state.commits).toBe(1);
});
test("operator control conflict requires explicit refreshed selection and read only rights", async ({ page }) => {
  const { state, event, technical } = await fixture(page); state.commandStatus = 409; await page.goto(technicalUrl); await openReplay(page); await page.getByRole("button", { name: "Подтвердить повтор", exact: true }).click(); await expect(page.getByRole("button", { name: "Проверить событие" })).toBeVisible();
  event.availableAt = "2026-10-17T04:00:00.000Z"; event.attempts = 6; await page.getByRole("button", { name: "Проверить событие" }).click(); expect(state.writes).toHaveLength(1); await page.getByRole("button", { name: "Принять актуальное состояние" }).click(); state.commandStatus = 201; await page.getByRole("button", { name: "Подтвердить повтор", exact: true }).click(); await expect(page.getByText("Событие поставлено в очередь", { exact: true })).toBeVisible(); expect(state.writes[1].idempotencyKey).not.toBe(state.writes[0].idempotencyKey); expect(state.writes[1].expectedAttempts).toBe(6);
  state.gone = false; technical.canReplay = false; technical.search = { status: "UNAVAILABLE", data: null, reason: "SOURCE_UNAVAILABLE" }; await page.reload(); await expect(page.getByRole("button", { name: "Повторить событие", exact: true })).toBeDisabled(); await expect(page.getByText("Источник недоступен. Повторите обновление.", { exact: true })).toBeVisible();
});

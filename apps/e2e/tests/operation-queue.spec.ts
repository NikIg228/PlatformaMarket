import { test, expect, type Page } from "@playwright/test";
import type { OperationAssignmentResult } from "@marketplace/schemas";
import { queueItem, queuePage } from "../fixtures/operation-queue-view";

const actor = "30000000-0000-4000-8000-000000000001";
const organization = "20000000-0000-4000-8000-000000000001";
const caseId = "40000000-0000-4000-8000-000000000001";
async function queueFixture(page: Page) {
  const state = { status: 200, historyError: false, conflict: true, readOnly: false, assignment: null as OperationAssignmentResult | null, writes: [] as Record<string, unknown>[] };
  await page.addInitScript(({ actor, organization }) => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "synthetic-queue-ui", sessionId: actor, activeOrganizationId: organization, user: { id: actor, displayName: "Оператор" }, expiresAt: Date.now() + 3600000 })), { actor, organization });
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, "");
    let json: unknown = [];
    if (path === "/organizations") json = [{ id: organization, capabilities: [{ capability: "MARKETPLACE_OPERATOR" }] }];
    else if (path.startsWith("/notifications/")) json = { items: [], unreadCount: 0, nextCursor: null, asOf: new Date().toISOString() };
    else if (path === "/access-control/permissions") json = state.readOnly ? ["support.ticket.view"] : ["support.ticket.view", "support.ticket.manage"];
    else if (path === "/operations/work-queue/assignees") json = [{ id: actor, displayName: "Оператор проверки" }];
    else if (path === "/operations/dashboard") json = { observedAt: new Date().toISOString(), scope: "PLATFORM_CURRENT_ALL_STATUSES", organizations: { status: "AVAILABLE", value: 1 }, masterProducts: { status: "AVAILABLE", value: 0 }, effectivePermissions: { status: "AVAILABLE", value: 2 } };
    else if (path.endsWith("/history")) {
      if (state.historyError) return route.fulfill({ status: 503, json: { message: "История временно недоступна" } });
      json = state.assignment ? [{ id: actor, actorId: actor, action: "ASSIGNED", createdAt: state.assignment.updatedAt, before: null, after: state.assignment }] : [];
    } else if (path.endsWith("/assignment")) {
      const input = route.request().postDataJSON(); state.writes.push(input);
      state.assignment = { id: actor, version: state.assignment ? state.assignment.version + 1 : 2, priority: input.priority, assigneeId: actor, assigneeName: "Оператор проверки", dueAt: null, reason: input.reason, updatedAt: new Date().toISOString() };
      if (state.conflict) { state.conflict = false; return route.fulfill({ status: 409, json: { message: "Назначение изменено другим сотрудником" } }); }
      return route.fulfill({ status: 201, json: state.assignment });
    } else if (path === "/operations/work-queue") {
      if (state.status !== 200) return route.fulfill({ status: state.status, json: { message: state.status === 403 ? "Доступ к очереди запрещён" : "Очередь временно недоступна" } });
      const q = url.searchParams.get("q") ?? "", offset = Number(url.searchParams.get("offset") ?? 0);
      const items = Array.from({ length: 53 }, (_, index) => queueItem({ id: index === 0 ? caseId : `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, title: `Случай ${index + 1}`, assignment: index === 0 ? state.assignment : null })).filter(item => (!q || item.title === q || item.id === q) && (url.searchParams.get("assignment") !== "MINE" || item.assignment?.assigneeId === actor));
      json = queuePage(items.slice(offset, offset + 50), { totalOpenItems: 53, total: items.length, offset, hasMore: offset + 50 < items.length });
    }
    return route.fulfill({ json });
  });
  await page.goto("/admin?section=overview");
  const panel = page.getByRole("region", { name: "Операционная очередь" });
  await expect(panel.getByText("Найдено случаев: 53 · Всего открыто: 53")).toBeVisible();
  return { state, panel };
}

for (const width of [1440, 390]) test(`queue filters, global pages, recovery and assignment conflict ${width}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  const { state, panel } = await queueFixture(page);
  await panel.getByRole("button", { name: "Следующие", exact: true }).click();
  await expect(page).toHaveURL(/queueOffset=50/);
  await expect(panel.getByText("Случаи 51–53 из 53", { exact: true })).toBeVisible();
  await panel.getByLabel("Случай или организация", { exact: true }).fill("Случай 53");
  await panel.getByRole("button", { name: "Найти случаи", exact: true }).click();
  await expect(panel.getByText("Найдено случаев: 1 · Всего открыто: 53")).toBeVisible();
  await expect(page).not.toHaveURL(/queueOffset=50/);
  await page.reload();
  await expect(panel.getByLabel("Случай или организация", { exact: true })).toHaveValue("Случай 53");
  await panel.getByLabel("Раздел очереди", { exact: true }).selectOption("CATALOG_REVIEW");
  await expect(page).toHaveURL(/queueKind=CATALOG_REVIEW/);
  await page.goBack();
  await expect(panel.getByLabel("Раздел очереди", { exact: true })).toHaveValue("ALL");
  await panel.getByRole("button", { name: "Сбросить фильтры очереди" }).click();
  await panel.getByLabel("Назначение", { exact: true }).selectOption("MINE");
  await expect(panel.getByText("Случаи не найдены", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Сбросить фильтры очереди" }).click();
  await panel.getByLabel("Случай или организация", { exact: true }).fill("Случай 1");
  await panel.getByRole("button", { name: "Найти случаи", exact: true }).click();
  await expect(panel.getByText("Найдено случаев: 1 · Всего открыто: 53")).toBeVisible();
  for (const status of [503, 403]) {
    state.status = status;
    await panel.getByRole("button", { name: "Обновить очередь", exact: true }).click();
    await expect(page.getByText("Очередь недоступна", { exact: true })).toBeVisible();
    await expect(panel.getByText(/Найдено случаев:/)).toHaveCount(0);
    await expect(panel.getByLabel("Случай или организация", { exact: true })).toHaveValue("Случай 1");
    state.status = 200;
    await page.getByRole("button", { name: "Повторить загрузку очереди", exact: true }).click();
    await expect(panel.getByText("Найдено случаев: 1 · Всего открыто: 53")).toBeVisible();
  }
  await expect(panel.getByRole("link", { name: "Открыть объект" })).toHaveAttribute("href", /object=40000000-0000-4000-8000-000000000001/);
  await page.getByRole("button", { name: "Закрыть уведомление", exact: true }).click();
  await expect(page.locator(".dm-save-toast")).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath(`queue-${width}.png`), fullPage: true });
  const control = panel.getByRole("button", { name: "Найти случаи", exact: true });
  const computed = await control.evaluate(el => { const s = getComputedStyle(el); return { height: el.getBoundingClientRect().height, radius: s.borderRadius, font: s.fontFamily, size: s.fontSize }; });
  expect(computed.height).toBe(44); expect(computed.radius).toBe("8px"); expect(computed.font).toContain("Manrope");
  await info.attach("computed-controls", { body: JSON.stringify(computed), contentType: "application/json" });
  const opener = panel.getByRole("button", { name: "Назначение и история", exact: true });
  state.historyError = true;
  await opener.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(page.getByRole("button", { name: "Повторить загрузку истории" })).toBeVisible();
  state.historyError = false;
  await page.getByRole("button", { name: "Повторить загрузку истории" }).click();
  await expect(dialog.getByText("Назначение ещё не менялось.", { exact: true })).toBeVisible();
  const reason = dialog.getByLabel("Причина изменения (не менее 10 символов)", { exact: true });
  await reason.fill("Проверка назначения после конфликта");
  await dialog.getByLabel("Ответственный", { exact: true }).selectOption(actor);
  await dialog.getByRole("button", { name: "Сохранить назначение", exact: true }).click();
  await expect(page.getByText(/Ввод сохранён/)).toBeVisible();
  await dialog.getByRole("button", { name: "Загрузить актуальное назначение" }).click();
  await expect(dialog.getByText(/Текущее назначение \(версия 2\)/)).toBeVisible();
  await expect(reason).toHaveValue("Проверка назначения после конфликта");
  await page.getByRole("button", { name: "Закрыть уведомление", exact: true }).click();
  await expect(page.locator(".dm-save-toast")).toBeHidden();
  await dialog.screenshot({ path: info.outputPath(`assignment-conflict-${width}.png`) });
  await dialog.getByRole("button", { name: "Сохранить назначение", exact: true }).click();
  await expect(page.getByText("Назначение сохранено.", { exact: true })).toBeVisible();
  expect(state.writes.map(input => input.expectedVersion)).toEqual([0, 2]);
  await expect(reason).toHaveValue("");
  await expect(reason).toBeFocused();
  await page.keyboard.press("Escape"); await expect(dialog).toBeHidden(); await expect(opener).toBeFocused();
  state.readOnly = true;
  await panel.getByRole("button", { name: "Обновить очередь", exact: true }).click();
  await expect(panel).toHaveAttribute("aria-busy", "false");
  await opener.click();
  await expect(dialog.getByRole("button", { name: "Сохранить назначение", exact: true })).toBeDisabled();
  await expect(dialog.getByText("Для назначения требуется право управления обращениями.")).toBeVisible();
});

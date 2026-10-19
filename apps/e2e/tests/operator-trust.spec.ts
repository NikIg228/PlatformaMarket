import { expect, test, type Page } from "@playwright/test";
import type { OperatorTrust, OperatorTrustIncident } from "@marketplace/schemas";
const id = (n: number) => `74000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const at = "2026-10-19T03:00:00.000Z";
async function fixture(page: Page) {
  await page.addInitScript(org => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "synthetic-trust", activeOrganizationId: org, sessionId: org, user: { id: org }, expiresAt: Date.now() + 3600000 })), id(1));
  const incidents: OperatorTrustIncident[] = Array.from({ length: 26 }, (_, index) => ({ id: id(100 + index), version: 1, organizationId: id(2), organizationName: `Поставщик ${index + 1}`, subjectType: "SupplierOrder", subjectId: id(3), type: "INCOMPLETE_DOCUMENTS", severity: "MEDIUM", status: index === 1 ? "UNDER_APPEAL" : "OPEN", reasonCode: "documents_missing", explanation: "В заказе отсутствует подтверждающий документ.", actionType: "HOLD_FOR_REVIEW", actionExpiresAt: at, remediation: "Предоставить документ по заказу", restorationCondition: "Документ проверен оператором", hardBlockReason: null, resolution: null, createdAt: at, sourceEntityType: "SupplierOrder", sourceEntityId: id(3), appeals: index === 1 ? [{ id: id(4), status: "OPEN", reason: "Документ передан при выдаче заказа", decision: null, createdAt: at, decidedAt: null, hasEvidence: true }] : [], appealCount: index === 1 ? 1 : 0 }));
  const state = { overviewStatus: 200, incidentSource: "AVAILABLE", warehouseSource: "AVAILABLE", empty: false, canResolve: true, commandStatus: 201, failAfterWrite: false, uncertain: false, eventStatus: 200, writes: [] as unknown[], queries: [] as URLSearchParams[], holdNext: false, held: false, release: () => {}, unexpected: [] as string[] };
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, "");
    if (path === "/trust/operator") {
      state.queries.push(url.searchParams);
      const offset = Number(url.searchParams.get("incidentOffset") ?? 0), supplierOffset = Number(url.searchParams.get("supplierOffset") ?? 0);
      if (state.holdNext && offset === 25) { state.holdNext = false; state.held = true; await new Promise<void>(resolve => { state.release = resolve; }); }
      const data: OperatorTrust = { observedAt: at, automaticFlow: "NOT_VERIFIED", canResolve: state.canResolve,
        incidents: state.incidentSource === "AVAILABLE" ? { status: "AVAILABLE", data: { items: state.empty ? [] : incidents.slice(offset, offset + 25), total: state.empty ? 0 : incidents.length, open: state.empty ? 0 : 26, hardBlocks: 0, pendingAppeals: 1, offset, limit: 25 } } : { status: state.incidentSource as "UNAVAILABLE" | "FORBIDDEN", data: null },
        suppliers: { status: "AVAILABLE", data: { items: state.empty ? [] : [{ id: id(2), name: "Поставщик с расчётом", snapshot: { status: "CALCULATED", score: "100", confidence: "1", eventCount: 27, computedAt: at, formulaVersion: "trust-v1", windowDays: 180 }, appeals: [], appealCount: 0 }], total: state.empty ? 0 : 1, offset: supplierOffset, limit: 25 } },
        warehouses: state.warehouseSource === "AVAILABLE" ? { status: "AVAILABLE", data: { total: 10, verified: 8 } } : { status: state.warehouseSource as "UNAVAILABLE" | "FORBIDDEN", data: null } };
      return route.fulfill({ status: state.overviewStatus, json: state.overviewStatus === 200 ? data : { message: "Недоступно" } });
    }
    if (path === `/trust/operator/suppliers/${id(2)}/events`) {
      const offset = Number(url.searchParams.get("offset") ?? 0);
      return route.fulfill({ status: state.eventStatus, json: state.eventStatus === 200 ? { total: 27, offset, limit: 25, automaticFlow: "NOT_VERIFIED", items: [{ id: id(300 + offset), metricCode: "delivery_ontime", value: "1", occurredAt: at, sourceEntityType: "SupplierOrder", sourceEntityId: id(3), origin: offset ? "UNVERIFIED" : "MANUAL_RECORDED", disputed: true, excludedAt: null }] } : { message: "Недоступно" } });
    }
    if (path === `/trust/operator/incidents/${incidents[0].id}/resolve`) {
      state.writes.push(route.request().postDataJSON());
      if (state.commandStatus !== 201) return route.fulfill({ status: state.commandStatus, json: { message: "Конфликт" } });
      incidents[0] = { ...incidents[0], status: "RESOLVED", actionType: "NONE", resolution: route.request().postDataJSON().resolution, version: 2 };
      if (state.failAfterWrite) state.overviewStatus = 503;
      if (state.uncertain) return route.fulfill({ status: 503, json: { message: "Ответ потерян" } });
      return route.fulfill({ status: 201, json: { id: incidents[0].id, status: "RESOLVED", version: 2 } });
    }
    if (route.request().method() !== "GET") { state.unexpected.push(path); return route.fulfill({ status: 500, json: {} }); }
    if (path === "/organizations") return route.fulfill({ json: [{ id: id(1), capabilities: [{ capability: "MARKETPLACE_OPERATOR" }] }] });
    if (path === "/access-control/permissions") return route.fulfill({ json: ["audit.view", "trust.incident.view", "trust.rating.view", "trust.incident.manage"] });
    if (path.startsWith("/notifications/")) return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null, asOf: at } });
    if (path === "/operations/audit") return route.fulfill({ json: { items: [], total: 0, offset: 0, limit: 25 } });
    state.unexpected.push(path); return route.fulfill({ json: [] });
  });
  return state;
}
const trust = (page: Page) => page.getByRole("region", { name: "Контроль доверия", exact: true });
async function open(page: Page) { await page.goto("/admin?section=security"); await trust(page).getByRole("heading", { name: "Поставщик 1", exact: true }).waitFor(); }
async function openResolution(page: Page) { await trust(page).getByRole("button", { name: "Подтвердить восстановление", exact: true }).first().click(); await page.getByRole("textbox", { name: "Результат проверки", exact: true }).fill("Документ проверен оператором по исходному заказу"); }

test("trust pages and tabs restore from URL; rating exposes unverified and manual origins", async ({ page }) => {
  const state = await fixture(page); await open(page);
  await expect(trust(page).getByText("Полнота событий не подтверждена", { exact: true })).toBeVisible();
  await trust(page).getByRole("button", { name: "Следующая страница Trust", exact: true }).click();
  await expect(trust(page).getByRole("heading", { name: "Поставщик 26", exact: true })).toBeVisible(); await expect(page).toHaveURL(/trustIncidentOffset=25/);
  await page.goBack(); await expect(trust(page).getByRole("heading", { name: "Поставщик 1", exact: true })).toBeVisible();
  await trust(page).getByRole("tab", { name: "Репутация", exact: true }).click(); await expect(page).toHaveURL(/trustView=reputation/); await page.reload();
  await expect(trust(page).getByText(/Расчётный сигнал: 100/)).toBeVisible(); await trust(page).getByRole("button", { name: "Происхождение событий", exact: true }).click();
  await expect(trust(page).getByText(/Зарегистрировано ручной командой/)).toBeVisible();
  await trust(page).getByRole("button", { name: "Следующие события", exact: true }).click(); await expect(trust(page).getByText(/Происхождение не подтверждено;/)).toBeVisible();
  expect(state.unexpected).toEqual([]);
});
test("trust source failure is partial, empty is explicit and permission denial clears stale data", async ({ page }) => {
  const state = await fixture(page); state.incidentSource = "UNAVAILABLE"; state.warehouseSource = "FORBIDDEN";
  await page.goto("/admin?section=security"); await expect(trust(page).getByText("Источник недоступен", { exact: true })).toBeVisible();
  await expect(trust(page).getByText("Нет прав на просмотр складов", { exact: true })).toBeVisible();
  await trust(page).getByRole("tab", { name: "Репутация", exact: true }).click(); await expect(trust(page).getByRole("heading", { name: "Поставщик с расчётом" })).toBeVisible();
  state.incidentSource = "AVAILABLE"; state.empty = true; await trust(page).getByRole("button", { name: "Обновить Trust", exact: true }).click(); await expect(trust(page).getByText("Поставщики не найдены", { exact: true })).toBeVisible();
  state.empty = false; await trust(page).getByRole("button", { name: "Обновить Trust", exact: true }).click(); await expect(trust(page).getByRole("heading", { name: "Поставщик с расчётом" })).toBeVisible();
  state.overviewStatus = 403; await trust(page).getByRole("button", { name: "Обновить Trust", exact: true }).click(); await expect(trust(page).getByText(/Нет доступа к данным/)).toBeVisible(); await expect(trust(page).getByRole("heading", { name: "Поставщик с расчётом" })).toHaveCount(0);
  state.overviewStatus = 200; await trust(page).getByRole("button", { name: "Повторить загрузку Trust", exact: true }).click(); await expect(trust(page).getByRole("heading", { name: "Поставщик с расчётом" })).toBeVisible();
});
test("trust restoration preserves reason on conflict and cannot repeat after success with failed refresh", async ({ page }) => {
  const state = await fixture(page); await open(page); state.commandStatus = 409; await openResolution(page);
  await page.getByRole("button", { name: "Закрыть инцидент", exact: true }).click(); await expect(page.getByRole("alert").filter({ hasText: "Инцидент изменился" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Закрыть инцидент", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0);
  await trust(page).getByRole("button", { name: "Обновить Trust", exact: true }).click(); await expect(trust(page).getByRole("button", { name: "Обновить Trust", exact: true })).toBeEnabled();
  await trust(page).getByRole("button", { name: "Подтвердить восстановление", exact: true }).first().click(); await expect(page.getByRole("textbox", { name: "Результат проверки", exact: true })).toHaveValue("Документ проверен оператором по исходному заказу");
  state.commandStatus = 201; state.failAfterWrite = true; await page.getByRole("button", { name: "Закрыть инцидент", exact: true }).click();
  await expect(trust(page).getByText("Восстановление подтверждено", { exact: true })).toBeVisible(); await expect(trust(page).getByText("Trust не обновлён", { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(2); expect(state.writes[0]).toMatchObject({ version: 1, resolution: "Документ проверен оператором по исходному заказу" });
  await expect(trust(page).getByRole("button", { name: "Подтвердить восстановление", exact: true }).first()).toBeDisabled();
});
test("trust delayed page response cannot replace browser Back state", async ({ page }) => {
  const state = await fixture(page); await open(page); state.holdNext = true;
  await trust(page).getByRole("button", { name: "Следующая страница Trust", exact: true }).click(); await expect.poll(() => state.held).toBe(true);
  await page.goBack(); await expect(trust(page).getByRole("heading", { name: "Поставщик 1", exact: true })).toBeVisible(); state.release();
  await expect(trust(page).getByRole("heading", { name: "Поставщик 26", exact: true })).toHaveCount(0); await expect(page).not.toHaveURL(/trustIncidentOffset=25/);
});
test("trust uncertain restoration reconciles before retry and denied event access clears old provenance", async ({ page }) => {
  const state = await fixture(page); await open(page); state.uncertain = true; await openResolution(page);
  await page.getByRole("button", { name: "Закрыть инцидент", exact: true }).click(); await expect(page.getByRole("alert").filter({ hasText: "Результат не подтверждён" })).toBeVisible();
  await page.keyboard.press("Escape"); await trust(page).getByRole("button", { name: "Обновить Trust", exact: true }).click();
  await expect(trust(page).getByText(/Результат проверки: Документ проверен оператором/)).toBeVisible(); expect(state.writes).toHaveLength(1);
  await trust(page).getByRole("tab", { name: "Репутация", exact: true }).click(); await trust(page).getByRole("button", { name: "Происхождение событий", exact: true }).click(); await expect(trust(page).getByText(/Зарегистрировано ручной командой/)).toBeVisible();
  state.eventStatus = 403; await trust(page).getByRole("button", { name: "Следующие события", exact: true }).click(); await expect(trust(page).getByText(/Нет доступа к данным/)).toBeVisible(); await expect(trust(page).getByText(/Зарегистрировано ручной командой/)).toHaveCount(0);
  state.eventStatus = 200; await trust(page).getByRole("button", { name: "Повторить загрузку событий", exact: true }).click(); await expect(trust(page).getByText(/Происхождение не подтверждено;/)).toBeVisible();
});
for (const width of [1440, 390]) test(`trust ${width}: keyboard, appeal restriction and shared control geometry`, async ({ page }) => {
  const state = await fixture(page); await page.setViewportSize({ width, height: 1000 }); await open(page);
  const buttons = trust(page).getByRole("button", { name: "Подтвердить восстановление", exact: true }); await expect(buttons.nth(1)).toBeDisabled();
  await buttons.first().focus(); await page.keyboard.press("Enter"); await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("textbox", { name: "Результат проверки", exact: true }).fill("Документ проверен оператором");
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); });
  const geometry = await page.getByRole("button", { name: "Закрыть инцидент", exact: true }).evaluate(el => { const s = getComputedStyle(el); return { height: parseFloat(s.height), radius: s.borderRadius, font: s.fontFamily, size: s.fontSize, overflow: document.documentElement.scrollWidth > innerWidth }; });
  expect(geometry.height).toBeGreaterThanOrEqual(44); expect(geometry.radius).toBe("8px"); expect(geometry.font).toContain("Manrope"); expect(geometry.size).toBe("14px"); expect(geometry.overflow).toBe(false);
  await page.getByRole("dialog").screenshot({ path: `.tmp/operator-trust/dialog-${width}.png` });
  await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0); await expect(buttons.first()).toBeFocused();
  await trust(page).getByRole("heading", { name: "Инциденты и репутация", exact: true }).scrollIntoViewIfNeeded(); await page.screenshot({ path: `.tmp/operator-trust/incidents-${width}.png` });
  await trust(page).getByRole("heading", { name: "Поставщик 1", exact: true }).locator("..").locator("..").locator("..").screenshot({ path: `.tmp/operator-trust/incident-card-${width}.png` });
  await trust(page).getByRole("tab", { name: "Репутация", exact: true }).click(); await trust(page).getByRole("button", { name: "Происхождение событий", exact: true }).click(); await expect(trust(page).getByText(/Зарегистрировано ручной командой/)).toBeVisible();
  await page.screenshot({ path: `.tmp/operator-trust/reputation-${width}.png` }); expect(state.writes).toHaveLength(0);
  await trust(page).getByRole("heading", { name: "Поставщик с расчётом", exact: true }).locator("..").locator("..").screenshot({ path: `.tmp/operator-trust/reputation-card-${width}.png` });
});

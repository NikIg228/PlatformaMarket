import { expect, test, type Page } from "@playwright/test";
const id = (n: number) => `70000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const at = "2026-10-17T00:00:00.000Z";
async function fixture(page: Page, kind: "IMPORT" | "RECONCILIATION" = "IMPORT", status = "COMPLETED_WITH_ERRORS") {
  const state = { status, canManage: true, failObject: false, failDiagnostics: false, failCommand: false, failRefresh: false, holdObject: false, objectHeld: false, releaseObject: () => {}, queueReads: [] as string[], writes: [] as { path: string; body: unknown }[], unexpected: [] as string[], errors: [] as string[], resolution: null as string | null, diagnosticsReads: 0 };
  page.on("pageerror", error => state.errors.push(error.message));
  await page.addInitScript(({ actor, organization }) => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "synthetic-import-proof", sessionId: actor, activeOrganizationId: organization, user: { id: actor, displayName: "Оператор" }, expiresAt: Date.now() + 3_600_000 })), { actor: id(1), organization: id(2) });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    if (path === "/organizations") return route.fulfill({ json: [{ id: id(2), capabilities: [{ capability: "MARKETPLACE_OPERATOR" }] }] });
    if (path.startsWith("/notifications/")) return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null, asOf: at } });
    if (path === "/access-control/permissions") return route.fulfill({ json: state.canManage ? ["import.manage", "integration.reconcile"] : [] });
    if (path === "/operations/work-queue/assignees") return route.fulfill({ json: [] });
    if (path === "/operations/work-queue") {
      state.queueReads.push(route.request().url());
      return route.fulfill({ json: { generatedAt: at, operatorOrganizationId: id(2), totalOpenItems: 0, total: 0, offset: 50, limit: 50, hasMore: false, items: [] } });
    }
    if (["/operations/dashboard", "/operations/capabilities"].includes(path)) return route.fulfill({ status: 503, json: { message: "Synthetic unrelated summary unavailable" } });
    if (/^\/operations\/work-queue\/(IMPORT_ATTENTION|INTEGRATION_RECONCILIATION)\//.test(path)) {
      if (state.failObject) return route.fulfill({ status: 503, json: { message: "Объект временно недоступен" } });
      const context = kind === "IMPORT"
        ? { kind, supplierOrganizationId: id(3), status: state.status, updatedAt: at, canProcess: state.canManage && state.status === "MAPPED", canRollback: state.canManage && ["COMPLETED", "COMPLETED_WITH_ERRORS"].includes(state.status) }
        : { kind, supplierOrganizationId: id(3), connectionId: id(4), connectionName: "Склад поставщика", status: state.status, updatedAt: at, resolution: state.resolution, canResolve: state.canManage && !["MATCHED", "RESOLVED"].includes(state.status) };
      const selectedId = path.split("/").at(-1)!;
      const json = { id: selectedId, queueType: kind === "IMPORT" ? "IMPORT_ATTENTION" : "INTEGRATION_RECONCILIATION", title: kind === "IMPORT" ? selectedId === id(5) ? "Прайс поставщика.csv" : "Другой импорт.csv" : "Расхождение данных", fields: [{ label: "Статус", value: state.status }, { label: "Поставщик", value: "Проверочный поставщик" }, ...(kind === "IMPORT" ? [{ label: "Строк", value: "12" }, { label: "Ошибки", value: "2" }] : [{ label: "Тип", value: "INVENTORY" }, { label: "Подключение", value: "Склад поставщика" }])], context };
      if (state.holdObject && selectedId === id(5)) { state.objectHeld = true; await new Promise<void>(resolve => { state.releaseObject = resolve; }); }
      return route.fulfill({ json });
    }
    if (path.endsWith("/diagnostics")) {
      state.diagnosticsReads++;
      if (state.failDiagnostics) return route.fulfill({ status: 503, json: { message: "Unavailable" } });
      return route.fulfill({ json: { batchId: id(5), status: state.status, totalRows: 12, processedRows: 10, errorRows: 2, byStatus: {}, conflictCount: 2, conflicts: [{ rowNumber: 4, status: "MATCH_PENDING", code: "SECRET", message: "SECRET", data: { token: "SECRET" } }, { rowNumber: 9, status: "REJECTED", code: "PROCESSING_ERROR", message: "SECRET", data: null }], idempotency: "Persisted result" } });
    }
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { resolution?: string };
      state.writes.push({ path, body });
      if (state.failCommand) return route.fulfill({ status: 503, json: { message: "Подтверждение команды не получено" } });
      state.status = path.endsWith("/rollback") ? "ROLLED_BACK" : path.endsWith("/resolve") ? "RESOLVED" : "COMPLETED";
      state.resolution = body.resolution ?? null;
      if (state.failRefresh) state.failObject = true;
      return route.fulfill({ json: { id: id(5), batchId: id(5), status: state.status, resolution: state.resolution, resolvedAt: at } });
    }
    state.unexpected.push(path); return route.fulfill({ status: 500, json: { message: "Unexpected fixture endpoint" } });
  });
  const url = `/admin?section=imports&queueType=${kind === "IMPORT" ? "IMPORT_ATTENTION" : "INTEGRATION_RECONCILIATION"}&object=${id(5)}&queueQ=прайс&queueOffset=50`;
  return { state, url };
}

for (const width of [1440, 390]) test(`import context confirms rollback and preserves exact retry ${width}`, async ({ page }, info) => {
  const { state, url } = await fixture(page); state.failCommand = true;
  await page.setViewportSize({ width, height: 1000 }); await page.goto(url);
  const region = page.getByRole("region", { name: "Контекст импорта и сверки" });
  await expect(region.getByText("Завершён с ошибками", { exact: true })).toBeVisible();
  await expect(region.getByText("Строка 4: Нужно сопоставить товар", { exact: true })).toBeVisible();
  expect(await page.getByText("SECRET", { exact: false }).count()).toBe(0);
  const reason = region.getByRole("textbox", { name: "Причина отката" }); await reason.fill("Неверное сопоставление товара в файле");
  const button = region.getByRole("button", { name: "Откатить импорт", exact: true });
  await button.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Откат импорта", exact: true }); await expect(dialog).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(button).toBeFocused();
  await button.click(); await dialog.getByRole("button", { name: "Подтвердить откат" }).click();
  await expect(region.getByRole("button", { name: "Повторить ту же команду" })).toBeEnabled();
  await expect(region).toContainText("Неверное сопоставление товара в файле");
  expect(state.writes[0]).toEqual({ path: `/suppliers/${id(3)}/import-batches/${id(5)}/rollback`, body: { reason: "Неверное сопоставление товара в файле", expectedUpdatedAt: at } });
  state.failCommand = false;
  await region.getByRole("button", { name: "Повторить ту же команду" }).click();
  await expect(region.getByText("Отменён", { exact: true })).toBeVisible();
  expect(state.writes[1]).toEqual(state.writes[0]);
  await expect(button).toHaveCount(0);
  const styles = await region.getByRole("button", { name: "Обновить состояние" }).evaluate(element => { const s = getComputedStyle(element); return { height: s.height, radius: s.borderRadius, font: s.fontFamily, size: s.fontSize }; });
  expect(styles).toMatchObject({ height: "44px", radius: "8px", size: "14px" }); expect(styles.font).toContain("Manrope");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const toastDismiss = page.locator(".dm-save-toast").getByRole("button", { name: "Закрыть уведомление" });
  if (await toastDismiss.isVisible()) await toastDismiss.click();
  await page.screenshot({ path: info.outputPath(`import-${width}.png`), fullPage: true, animations: "disabled" });
  expect(state.unexpected).toEqual([]); expect(state.errors).toEqual([]);
});

test("reconciliation context recovers initial load, preserves draft and submits exact connection", async ({ page }) => {
  const { state, url } = await fixture(page, "RECONCILIATION", "MISMATCH"); state.failObject = true;
  await page.goto(url); const region = page.getByRole("region", { name: "Контекст импорта и сверки" });
  await expect(page.getByRole("alert").filter({ hasText: "Объект временно недоступен" })).toBeVisible(); state.failObject = false;
  await region.getByRole("button", { name: "Обновить состояние" }).click();
  const field = region.getByRole("textbox", { name: "Решение по расхождению" }); await field.fill("Сверили остаток по документам поставщика");
  state.failObject = true; await region.getByRole("button", { name: "Обновить состояние" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Объект временно недоступен" })).toBeVisible(); await expect(field).toHaveValue("Сверили остаток по документам поставщика");
  state.failObject = false; state.failCommand = true; await region.getByRole("button", { name: "Сохранить решение" }).click();
  await expect(region.getByRole("button", { name: "Повторить ту же команду" })).toBeEnabled(); state.failCommand = false;
  await region.getByRole("button", { name: "Повторить ту же команду" }).click();
  await expect(region.getByText("Решение сохранено", { exact: true })).toBeVisible();
  expect(state.writes[0]).toEqual({ path: `/suppliers/${id(3)}/integrations/${id(4)}/reconciliation/${id(5)}/resolve`, body: { resolution: "Сверили остаток по документам поставщика", expectedUpdatedAt: at } });
  expect(state.writes[1]).toEqual(state.writes[0]); expect(state.unexpected).toEqual([]); expect(state.errors).toEqual([]);
});

test("import context has no forced failed retry and recovers diagnostics", async ({ page }) => {
  const { state, url } = await fixture(page, "IMPORT", "FAILED"); state.failDiagnostics = true; await page.goto(url);
  const region = page.getByRole("region", { name: "Контекст импорта и сверки" });
  await expect(region).toContainText("Автоматический повтор из этого состояния недоступен");
  await expect(page.getByRole("alert").filter({ hasText: "Не удалось загрузить строки" })).toBeVisible();
  await expect(region.getByRole("button", { name: /Обработать импорт|Откатить импорт/ })).toHaveCount(0);
  state.failDiagnostics = false; await region.getByRole("button", { name: "Обновить состояние" }).click();
  await expect(region).toContainText("Строка 9: Нужно исправить данные"); expect(state.writes).toEqual([]);
  expect(state.unexpected).toEqual([]); expect(state.errors).toEqual([]);
});

test("import context denies commands without rights and does not fetch raw diagnostics", async ({ page }) => {
  const { state, url } = await fixture(page); state.canManage = false; await page.goto(url);
  const region = page.getByRole("region", { name: "Контекст импорта и сверки" });
  await expect(region.getByText("Завершён с ошибками", { exact: true })).toBeVisible();
  await expect(region.getByRole("textbox")).toHaveCount(0); expect(state.diagnosticsReads).toBe(0);
  expect(state.writes).toEqual([]); expect(state.unexpected).toEqual([]);
});

test("import context does not offer a second command after success with a failed refresh", async ({ page }) => {
  const { state, url } = await fixture(page, "IMPORT", "MAPPED"); state.failRefresh = true;
  await page.goto(url); const region = page.getByRole("region", { name: "Контекст импорта и сверки" });
  await region.getByRole("button", { name: "Обработать импорт" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Действие уже выполнено" })).toBeVisible();
  await expect(region.getByRole("button", { name: /Обработать импорт|Повторить ту же команду/ })).toHaveCount(0);
  state.failObject = false; await region.getByRole("button", { name: "Обновить состояние" }).click();
  await expect(region.getByText("Завершён", { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1); expect(state.unexpected).toEqual([]); expect(state.errors).toEqual([]);
});

test("import context discards a late previous object and returns to the same server filters", async ({ page }) => {
  const { state, url } = await fixture(page); state.holdObject = true; await page.goto(url);
  await expect.poll(() => state.objectHeld).toBe(true);
  state.holdObject = false;
  await page.evaluate(next => { const url = new URL(location.href); url.searchParams.set("object", next); history.pushState(null, "", url); dispatchEvent(new PopStateEvent("popstate")); }, id(6));
  await expect(page.getByRole("heading", { name: "Другой импорт.csv", exact: true })).toBeVisible();
  state.releaseObject();
  await expect(page.getByRole("heading", { name: "Прайс поставщика.csv", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Вернуться к очереди", exact: true }).click();
  await expect.poll(() => state.queueReads.length).toBeGreaterThan(0);
  const query = new URL(state.queueReads.at(-1)!).searchParams;
  expect(query.get("q")).toBe("прайс"); expect(query.get("offset")).toBe("50");
  expect(new URL(page.url()).searchParams.has("object")).toBe(false);
  expect(state.unexpected).toEqual([]); expect(state.errors).toEqual([]);
});

import { test, expect, type Page } from "@playwright/test";
import type { OrganizationProfileFields, OrganizationProfileResponse, SaveOrganizationProfileInput } from "@marketplace/schemas";

const orgId = "11111111-1111-4111-8111-111111111111", sessionId = "22222222-2222-4222-8222-222222222222", cityId = "33333333-3333-4333-8333-333333333333", otherSessionId = "44444444-4444-4444-8444-444444444444";
const permissions = ["organization.view", "organization.members.manage", "inventory.view", "supplier.warehouse.manage", "import.manage", "support.ticket.view", "notification.view"];

async function fixture(page: Page, role: "clinic" | "supplier") {
  const capability = role === "clinic" ? "BUYER" : "SUPPLIER";
  const state = {
    profile: { organizationId: orgId, legalName: role === "clinic" ? "ТОО «Демо Клиника»" : "ТОО «Демо Снабжение»", displayName: "Демо организация", bin: "000000000001", version: 1, canEdit: true, complete: true,
      profile: { contactName: "Контакт для заказов", phone: "+77000000000", email: "office@example.invalid", legalAddress: { cityId, line1: "Тестовая улица, 1", postalCode: "050000" }, deliveryAddress: { cityId, line1: "Тестовая улица, 2", postalCode: "050000" } } } as OrganizationProfileResponse & { profile: OrganizationProfileFields },
    permissions: [...permissions], saves: [] as SaveOrganizationProfileInput[], failSave: false, conflict: false, failProfile: false, failSessions: false, failIdentity: false, failRevoke: false,
    currentRevoked: false, revoked: [] as string[], unknown: [] as string[], warehouseWrites: [] as unknown[], warehouses: [] as { id: string; name: string; status: string }[], failWarehouse: false, failSources: false,
    extraSessions: [] as { id: string; userAgent: string; createdAt: string; lastUsedAt: null }[],
  };
  await page.addInitScript(({ capability, orgId, sessionId }) => sessionStorage.setItem(`dentmarket:${capability.toLowerCase()}-session`, JSON.stringify({ capability, organizationId: orgId, sessionId, actorId: orgId, accessToken: "fixture-not-a-real-token", accessTokenExpiresAt: Date.now() + 3600000, displayName: "Тестовый сотрудник", organizationDisplayName: "Демо организация" })), { capability, orgId, sessionId });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, ""), method = route.request().method();
    const fail = (message: string, status = 503) => route.fulfill({ status, json: { message, code: status === 409 ? "CONFLICT" : "UNAVAILABLE" } });
    if (path === "/auth/workspace-context") return route.fulfill({ json: { organizationId: orgId, organizationDisplayName: "Демо организация", capabilities: [capability] } });
    if (path === "/access-control/policy") return route.fulfill({ json: { mode: "ROLE_BASED", permissions: state.permissions } });
    if (path === "/organizations/current/profile") {
      if (method === "POST") {
        const input = route.request().postDataJSON() as SaveOrganizationProfileInput; state.saves.push(input);
        if (state.conflict) return fail("Реквизиты изменились. Обновите анкету перед сохранением", 409);
        if (state.failSave) return fail("Временно недоступно. Повторите сохранение.");
        const { expectedVersion, idempotencyKey: _key, ...fields } = input;
        if (expectedVersion !== state.profile.version) return fail("Неверная версия", 409);
        state.profile = { ...state.profile, version: expectedVersion + 1, profile: fields };
      } else if (state.failProfile) return fail("Настройки временно недоступны");
      return route.fulfill({ json: state.profile });
    }
    if (path === "/catalog/cities") return route.fulfill({ json: [{ id: cityId, nameRu: "Алматы" }] });
    if (path === "/auth/current") return state.failIdentity ? fail("Данные аккаунта недоступны") : route.fulfill({ json: state.currentRevoked || !new URL(route.request().url()).searchParams.has("workspace") ? null : { sessionId, user: { id: orgId, displayName: "Тестовый сотрудник", email: "user@example.invalid" } } });
    if (path === "/auth/sessions") return state.failSessions ? fail("Сеансы временно недоступны") : route.fulfill({ json: [
      { id: sessionId, userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0", createdAt: "2026-10-07T05:24:00Z", lastUsedAt: null },
      { id: otherSessionId, userAgent: "Mozilla/5.0 (Macintosh) Safari/605.1", createdAt: "2026-10-06T13:40:00Z", lastUsedAt: null },
      ...state.extraSessions,
    ].filter(item => !state.revoked.includes(item.id)) });
    if (/^\/auth\/sessions\/[^/]+\/revoke$/.test(path)) {
      const id = path.split("/")[3];
      if (state.failRevoke) return fail("Не удалось завершить сеанс");
      state.revoked.push(id); if (id === sessionId) state.currentRevoked = true;
      return route.fulfill({ json: { id, status: "REVOKED" } });
    }
    if (path === "/auth/logout") return route.fulfill({ json: { ok: true } });
    if (path === `/suppliers/${orgId}/warehouses`) {
      if (method === "POST") {
        const input = route.request().postDataJSON(); state.warehouseWrites.push(input);
        if (state.failWarehouse) return fail("Склад не сохранён");
        state.warehouses.push({ id: otherSessionId, name: input.name, status: "ACTIVE" });
        return route.fulfill({ status: 201, json: state.warehouses[0] });
      }
      return route.fulfill({ json: state.warehouses });
    }
    if (path === `/suppliers/${orgId}/data-sources`) return state.failSources ? fail("Источники временно недоступны") : route.fulfill({ json: [] });
    if (path === "/conversations") return route.fulfill({ json: { items: [], hasMore: false, unreadCount: 0 } });
    if (path.startsWith("/notifications/organizations/")) return route.fulfill({ json: { items: [], unreadCount: 0, hasMore: false, nextCursor: null } });
    state.unknown.push(path); return fail(`Unexpected fixture request: ${path}`);
  });
  return state;
}

for (const role of ["clinic", "supplier"] as const) for (const width of [1440, 1024, 390]) {
  test(`settings-design ${role} reference layouts and keyboard ${width}`, async ({ page }, info) => {
    const state = await fixture(page, role); await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/${role}/settings`);
    await expect(page.getByLabel("Юридическое название", { exact: true })).toHaveValue(state.profile.legalName);
    await expect(page.getByLabel("БИН", { exact: true })).toHaveAttribute("readonly", "");
    const city = page.getByRole("combobox", { name: "Юридический адрес: город", exact: true });
    await city.focus(); await page.keyboard.press("Enter"); await expect(page.getByRole("option", { name: "Алматы", exact: true })).toBeVisible();
    await page.keyboard.press("Escape"); await expect(city).toBeFocused();
    await expect(page.getByRole("button", { name: "Сохранить изменения", exact: true })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`settings-${role}-${width}.png`), fullPage: true });
    await page.goto(`/${role}/profile`);
    await expect(page.getByRole("region", { name: "Данные аккаунта", exact: true })).toContainText("user@example.invalid");
    await expect(page.getByText("Текущий сеанс", { exact: true })).toBeVisible();
    await expect(page.getByText("Chrome · Windows", { exact: true })).toBeVisible();
    await expect(page.getByText("Safari · macOS", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`profile-${role}-${width}.png`), fullPage: true });
    expect(state.unknown).toEqual([]);
  });
}

for (const width of [1440, 390]) test(`settings-unified long session list navigation and last-page revoke ${width}`, async ({ page }, info) => {
  const state = await fixture(page, "supplier");
  state.extraSessions = Array.from({ length: 9 }, (_, index) => ({ id: `55555555-5555-4555-8555-${String(index).padStart(12, "0")}`, userAgent: "Mozilla/5.0 Android Chrome/120.0", createdAt: "2026-10-06T13:40:00Z", lastUsedAt: null }));
  await page.setViewportSize({ width, height: 1000 }); await page.goto("/supplier/profile");
  const sessions = page.getByRole("region", { name: "Активные сеансы", exact: true }), nav = sessions.getByRole("navigation");
  await expect(sessions.getByRole("listitem")).toHaveCount(5);
  await expect(sessions.getByRole("listitem").first()).toContainText("Текущий сеанс");
  await expect(nav).toContainText("Страница 1 из 3 · Всего 11");
  await nav.getByRole("button", { name: "Далее", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(nav).toContainText("Страница 2 из 3");
  await nav.getByRole("button", { name: "Далее", exact: true }).click(); await expect(sessions.getByRole("listitem")).toHaveCount(1);
  await sessions.getByRole("button", { name: "Завершить сеанс", exact: true }).click();
  await page.getByRole("button", { name: "Подтвердить завершение", exact: true }).click();
  await expect(nav).toContainText("Страница 2 из 2 · Всего 10"); await expect(sessions.getByRole("listitem")).toHaveCount(5);
  expect(state.revoked).toEqual([state.extraSessions[8].id]);
  await nav.getByRole("button", { name: "Назад", exact: true }).click();
  await expect(sessions.getByRole("listitem").first()).toContainText("Текущий сеанс");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`profile-long-${width}.png`), fullPage: true });
});

for (const role of ["clinic", "supplier"] as const) test(`settings-design ${role} validates cancels retries and versions saved settings`, async ({ page }) => {
  const state = await fixture(page, role); await page.goto(`/${role}/settings`);
  const contact = page.getByLabel("Контактное лицо", { exact: true }), save = page.getByRole("button", { name: "Сохранить изменения", exact: true });
  await contact.fill("Новый контакт"); await page.getByRole("button", { name: "Отмена", exact: true }).click(); await expect(contact).toHaveValue("Контакт для заказов");
  await contact.fill("А"); await save.click(); await expect(contact).toHaveAttribute("aria-invalid", "true"); expect(state.saves).toHaveLength(0);
  await contact.fill("Новый контакт"); state.failSave = true; await save.click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Изменения не сохранены"); await expect(contact).toHaveValue("Новый контакт");
  state.failSave = false; await save.click(); await expect(page.getByText("Изменения сохранены", { exact: true })).toBeVisible();
  expect(state.saves).toHaveLength(2); expect(state.saves[0].idempotencyKey).toBe(state.saves[1].idempotencyKey); expect(state.saves[1].expectedVersion).toBe(1);
  await page.getByLabel("Адрес получения: адрес", { exact: true }).fill("Другой адрес, 10"); await save.click();
  await expect.poll(() => state.profile.version).toBe(3); await expect(save).toBeDisabled(); expect(state.saves[2].expectedVersion).toBe(2); expect(state.saves[2].idempotencyKey).not.toBe(state.saves[1].idempotencyKey);
  await page.reload(); await expect(contact).toHaveValue("Новый контакт"); await expect(page.getByLabel("Адрес получения: адрес", { exact: true })).toHaveValue("Другой адрес, 10");
});

test("settings-design conflict retains draft and explicit reload recovers", async ({ page }) => {
  const state = await fixture(page, "supplier"); await page.goto("/supplier/settings");
  const contact = page.getByLabel("Контактное лицо", { exact: true }); await contact.fill("Мой черновик");
  state.conflict = true; await page.getByRole("button", { name: "Сохранить изменения", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Реквизиты изменились"); await expect(contact).toHaveValue("Мой черновик");
  page.once("dialog", dialog => dialog.dismiss()); await page.getByRole("tab", { name: "Склады", exact: true }).click(); await expect(contact).toHaveValue("Мой черновик");
  state.profile.profile.contactName = "Сохранено коллегой"; state.profile.version = 3;
  page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", { name: "Загрузить сохранённые настройки", exact: true }).click();
  await expect(contact).toHaveValue("Сохранено коллегой"); await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});

test("settings-design loading errors read-only and denied tabs", async ({ page }) => {
  const state = await fixture(page, "supplier"); state.failProfile = true; await page.goto("/supplier/settings");
  await expect(page.getByText("Настройки временно недоступны", { exact: true })).toBeVisible();
  state.failProfile = false; state.profile.canEdit = false; await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.getByLabel("Контактное лицо", { exact: true })).toBeDisabled(); await expect(page.getByRole("button", { name: "Сохранить изменения", exact: true })).toBeDisabled();
  state.permissions = ["organization.view"]; await page.reload(); await page.getByRole("tab", { name: "Склады", exact: true }).click();
  await expect(page.getByText("Этот раздел недоступен вашей роли.", { exact: false })).toBeVisible(); expect(state.warehouseWrites).toHaveLength(0);
});

test("settings-design supplier warehouse creation and source recovery", async ({ page }, info) => {
  const state = await fixture(page, "supplier"); await page.goto("/supplier/settings?tab=warehouses");
  await expect(page.getByText("Складов пока нет", { exact: true })).toBeVisible(); await page.getByRole("button", { name: "Добавить склад", exact: true }).click();
  const form = page.getByRole("form", { name: "Новый склад" });
  await form.getByRole("button", { name: "Добавить склад", exact: true }).click(); await expect(page.getByLabel("Название склада", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Название склада", { exact: true }).fill("Основной склад"); await page.getByLabel("Код склада", { exact: true }).fill("MAIN-01");
  state.failWarehouse = true; await form.getByRole("button", { name: "Добавить склад", exact: true }).click(); await expect(page.locator("main").getByRole("alert")).toContainText("Не удалось добавить склад");
  await expect(page.getByLabel("Название склада", { exact: true })).toHaveValue("Основной склад"); state.failWarehouse = false;
  await form.getByRole("button", { name: "Добавить склад", exact: true }).click(); await expect(page.getByText("Склад добавлен", { exact: true })).toBeVisible(); await expect(page.getByText("Основной склад", { exact: true })).toBeVisible();
  state.failSources = true; await page.getByRole("tab", { name: "Источники товаров", exact: true }).click(); await expect(page).toHaveURL(/tab=sources/);
  await expect(page.getByText("Источники временно недоступны", { exact: true })).toBeVisible(); state.failSources = false; await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.getByText("Источников пока нет", { exact: true })).toBeVisible(); await expect(page.getByRole("link", { name: "Загрузить прайс", exact: true })).toHaveAttribute("href", "/supplier/products/import");
  await page.reload(); await expect(page.getByRole("tab", { name: "Источники товаров", exact: true })).toHaveAttribute("aria-selected", "true");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("tab", { name: "Источники товаров", exact: true }).click();
    await expect(page.getByText("Источников пока нет", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`sources-${width}.png`), fullPage: true });
    await page.getByRole("tab", { name: "Склады", exact: true }).click();
    await expect(page.getByText("Основной склад", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`warehouses-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

for (const role of ["clinic", "supplier"] as const) test(`settings-design ${role} profile retries and confirms other session revocation`, async ({ page }) => {
  const state = await fixture(page, role); state.failIdentity = true; state.failSessions = true; await page.goto(`/${role}/profile`);
  const identity = page.getByRole("region", { name: "Данные аккаунта", exact: true }), sessions = page.getByRole("region", { name: "Активные сеансы", exact: true });
  await expect(identity.getByText("Данные аккаунта недоступны", { exact: true })).toBeVisible(); state.failIdentity = false; await identity.getByRole("button", { name: "Повторить", exact: true }).click(); await expect(identity).toContainText("user@example.invalid");
  state.failSessions = false; await sessions.getByRole("button", { name: "Повторить", exact: true }).click();
  const other = sessions.getByRole("listitem").filter({ hasText: "Safari · macOS" }); const action = other.getByRole("button", { name: "Завершить сеанс", exact: true });
  await action.click(); await page.keyboard.press("Escape"); await expect(action).toBeFocused(); expect(state.revoked).toHaveLength(0);
  await action.click(); state.failRevoke = true; await page.getByRole("button", { name: "Подтвердить завершение", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Сеанс не завершён"); expect(state.revoked).toHaveLength(0);
  state.failRevoke = false; await page.getByRole("button", { name: "Подтвердить завершение", exact: true }).click();
  await expect(other).toHaveCount(0); await expect(page.getByText("Текущий сеанс", { exact: true })).toBeVisible(); expect(state.revoked).toEqual([otherSessionId]);
  await expect(page.getByRole("button", { name: "Выйти из аккаунта", exact: true })).toBeEnabled();
});

test("settings-design current session revoke clears only confirmed session", async ({ page }) => {
  const state = await fixture(page, "supplier"); await page.route("**/login", route => route.fulfill({ contentType: "text/html", body: "<h1>Вход</h1>" }));
  await page.goto("/supplier/profile"); await page.getByRole("listitem").filter({ hasText: "Текущий сеанс" }).getByRole("button", { name: "Завершить сеанс", exact: true }).click();
  await page.getByRole("button", { name: "Подтвердить завершение", exact: true }).click(); await expect(page).toHaveURL(/\/login$/); expect(state.revoked).toEqual([sessionId]);
});

test("settings-design loading permission recovery and in-flight save keep draft", async ({ page }) => {
  const state = await fixture(page, "supplier");
  let releaseLoad!: () => void, releaseSave!: () => void;
  const loading = new Promise<void>(resolve => { releaseLoad = resolve; }), saving = new Promise<void>(resolve => { releaseSave = resolve; });
  let writes = 0;
  await page.route("**/api/organizations/current/profile", async route => {
    if (route.request().method() === "POST") { writes++; await saving; } else await loading;
    await route.fallback();
  });
  await page.goto("/supplier/settings");
  try { await expect(page.getByText("Загружаем настройки организации", { exact: true })).toBeVisible(); } finally { releaseLoad(); }
  const contact = page.getByLabel("Контактное лицо", { exact: true }); await contact.fill("Новый контакт");
  state.permissions = ["organization.view"]; await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(contact).toBeDisabled(); await expect(contact).toHaveValue("Новый контакт");
  state.permissions = [...permissions]; await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await expect(contact).toBeEnabled();
  const save = page.getByRole("button", { name: "Сохранить изменения", exact: true }); await save.click();
  try { await expect(page.getByRole("button", { name: "Сохраняем…", exact: true })).toBeDisabled(); await expect(contact).toBeDisabled(); expect(writes).toBe(1); } finally { releaseSave(); }
  await expect(page.getByText("Изменения сохранены", { exact: true })).toBeVisible(); expect(state.saves).toHaveLength(1);
});

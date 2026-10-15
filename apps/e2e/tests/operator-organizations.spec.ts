import { expect, test, type Page } from "@playwright/test";
import type { OperatorOrganization, OperatorOrganizationDetail, OrganizationOnboarding } from "@marketplace/schemas";

const id = (n: number) => `50000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const timestamp = "2026-10-14T00:00:00.000Z";
async function fixture(page: Page) {
  const items: OperatorOrganization[] = Array.from({ length: 31 }, (_, i) => ({ id: id(i + 10), displayName: `Организация ${i + 1}`, legalName: `ТОО Организация ${i + 1}`, bin: String(120000000000 + i), status: "ACTIVE", capabilities: [i === 0 ? "SUPPLIER" : "IMPORTER"], createdAt: timestamp }));
  const detail: OperatorOrganizationDetail = { ...items[0], version: 1, canEdit: false,
    profileCities: { legal: "Алматы", delivery: "Астана" },
    profile: { contactName: "Ирина Официальная", phone: "+77010000000", email: "official@example.invalid", additionalContacts: [1, 2].map(n => ({ contactName: `Резервный контакт ${n}`, phone: `+7701000000${n}`, email: `reserve${n}@example.invalid` })),
      legalAddress: { cityId: id(100), line1: "Улица Абая, 10", postalCode: "050000" }, deliveryAddress: { cityId: id(101), line1: "Проспект Республики, 20", postalCode: "010000" } } };
  const onboarding: OrganizationOnboarding = { capability: "SUPPLIER", ready: false, organization: { organizationId: detail.id, legalName: detail.legalName, displayName: detail.displayName, bin: detail.bin, version: 1, canEdit: false, complete: true, requiredReserveContacts: 2, profile: detail.profile },
    steps: [{ id: "organization", label: "Реквизиты и контакты", complete: true, reason: null, action: "profile" }, { id: "warehouse", label: "Склад", complete: false, reason: "Добавьте активный склад", action: "warehouse" }] };
  const state = { items, detail, onboarding, listStatus: 200, detailStatus: 200, hold: "", held: false, release: () => {}, requests: [] as string[], unexpected: [] as string[], errors: [] as string[] };
  page.on("pageerror", error => state.errors.push(error.message));
  await page.addInitScript(({ actor, organization, session }) => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "synthetic-organization-proof", sessionId: session, activeOrganizationId: organization, user: { id: actor, displayName: "Оператор реестра" }, expiresAt: Date.now() + 3600000 })), { actor: id(1), organization: id(2), session: id(3) });
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, "");
    state.requests.push(path + url.search);
    if (path === "/organizations") return route.fulfill({ json: [{ id: id(2), capabilities: [{ capability: "MARKETPLACE_OPERATOR" }] }] });
    if (path.startsWith("/notifications/")) return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null, asOf: timestamp } });
    if (path === "/operations/organizations") {
      const q = url.searchParams.get("q") ?? "", offset = Number(url.searchParams.get("offset") ?? 0), status = state.listStatus;
      const rows = state.items.filter(row => (!q || row.displayName.includes(q) || row.bin.includes(q)) && (!url.searchParams.get("status") || row.status === url.searchParams.get("status")) && (!url.searchParams.get("capability") || row.capabilities.includes(url.searchParams.get("capability") as never)));
      const body = { items: structuredClone(rows.slice(offset, offset + 25)), total: rows.length, offset, limit: 25 };
      if (state.hold === q) { state.held = true; await new Promise<void>(resolve => { state.release = resolve; }); }
      return route.fulfill({ status, json: status === 200 ? body : { code: "UNAVAILABLE", message: "Fixture error" } });
    }
    if (path.startsWith("/operations/organizations/")) {
      const selected = state.items.find(row => path.endsWith(row.id));
      return route.fulfill({ status: state.detailStatus, json: state.detailStatus === 200 ? { ...structuredClone(state.detail), ...selected } : { code: "NOT_FOUND", message: "Fixture error" } });
    }
    if (path === `/organizations/${id(10)}/onboarding`) return route.fulfill({ json: state.onboarding });
    if (path.startsWith("/operations/work-queue/")) return route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
    state.unexpected.push(path); return route.fulfill({ status: 500, json: { message: "Unexpected registry fixture endpoint" } });
  });
  state.hold = "never-held";
  return state;
}

test("organization registry preserves filters and pagination through detail, reload and browser Back", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/admin?section=organizations&orgOffset=25&supportQ=preserve&supportOffset=50");
  await expect(page.getByText("Найдено организаций: 31", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Организация 26", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Открыть Организация 26", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Карточка организации", exact: true })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Организация 26", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Готовность поставщика", exact: true })).toHaveCount(0);
  expect(state.requests.some(path => path === `/organizations/${id(35)}/onboarding`)).toBe(false);
  await page.reload(); await expect(page.getByRole("heading", { name: "Организация 26", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "К списку организаций" }).click();
  await expect(page.getByText("Страница 2", { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("supportQ")).toBe("preserve");
  await page.goBack(); await expect(page.getByRole("heading", { name: "Карточка организации", exact: true })).toBeVisible();
  await page.goBack(); await expect(page.getByText("Страница 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "В начало списка" }).click();
  await page.getByLabel("Название или БИН").fill("120000000007"); await page.getByRole("button", { name: "Найти", exact: true }).click();
  await expect(page.getByText("Найдено организаций: 1", { exact: true })).toBeVisible();
  await page.getByLabel("Статус организации", { exact: true }).click(); await page.getByRole("option", { name: "В архиве", exact: true }).click();
  await expect(page.getByText("Организации не найдены", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Сбросить", exact: true }).click();
  await expect(page.getByText("Найдено организаций: 31", { exact: true })).toBeVisible();
  expect(state.unexpected).toEqual([]); expect(state.errors).toEqual([]);
});

test("organization detail refreshes supplier readiness at the same version and removes disappeared or denied records", async ({ page }) => {
  const state = await fixture(page);
  await page.goto(`/admin?section=organizations&orgQ=Организация&queueType=ORGANIZATION_REVIEW&object=${id(90)}`);
  await page.getByRole("link", { name: "Открыть Организация 1", exact: true }).click();
  expect(new URL(page.url()).searchParams.has("object")).toBe(false);
  expect(new URL(page.url()).searchParams.has("queueType")).toBe(false);
  await expect(page.getByText("Алматы, Улица Абая, 10, 050000", { exact: true })).toBeVisible();
  await expect(page.getByText("Астана, Проспект Республики, 20, 010000", { exact: true })).toBeVisible();
  await expect(page.getByText("Добавьте активный склад", { exact: true })).toBeVisible();
  state.onboarding.ready = true; state.onboarding.steps[1].complete = true; state.onboarding.steps[1].reason = null;
  await page.reload();
  await expect(page.getByText("Готов к работе", { exact: true })).toBeVisible();
  state.detailStatus = 404; await page.reload();
  await expect(page.getByText("Организация не найдена", { exact: true })).toBeVisible();
  await expect(page.getByText("official@example.invalid", { exact: false })).toHaveCount(0);
  state.detailStatus = 200; await page.getByRole("button", { name: "Повторить загрузку карточки" }).click();
  await expect(page.getByText("official@example.invalid", { exact: false })).toBeVisible();
  state.detailStatus = 403; await page.reload();
  await expect(page.getByText("Нет доступа к данным. Проверьте вход и права оператора.", { exact: true })).toBeVisible();
  await expect(page.getByText("official@example.invalid", { exact: false })).toHaveCount(0);
  expect(state.unexpected).toEqual([]); expect(state.errors).toEqual([]);
});

test("organization registry handles loading, retry and stale search responses", async ({ page }) => {
  const state = await fixture(page); state.hold = "";
  await page.goto("/admin?section=organizations");
  await expect(page.getByText("Загружаем организации", { exact: true })).toBeVisible();
  await expect.poll(() => state.held).toBe(true);
  await page.getByLabel("Название или БИН").fill("120000000007"); await page.getByRole("button", { name: "Найти", exact: true }).click();
  await expect(page.getByText("Найдено организаций: 1", { exact: true })).toBeVisible();
  state.release(); state.hold = "never-held";
  await expect(page.getByRole("link", { name: /^Открыть Организация / })).toHaveCount(1);
  state.listStatus = 503; await page.getByLabel("Название или БИН").fill("Организация 8"); await page.getByRole("button", { name: "Найти", exact: true }).click();
  await expect(page.getByText("Реестр не обновлён", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Открыть Организация / })).toHaveCount(0);
  state.listStatus = 403; await page.getByRole("button", { name: "Повторить загрузку", exact: true }).click();
  await expect(page.getByRole("link", { name: /^Открыть Организация / })).toHaveCount(0);
  state.listStatus = 200; await page.getByRole("button", { name: "Повторить загрузку", exact: true }).click();
  await expect(page.getByText("Найдено организаций: 1", { exact: true })).toBeVisible();
  expect(state.unexpected).toEqual([]); expect(state.errors).toEqual([]);
});

test("organization visuals use shared controls at desktop and mobile with keyboard selectors and detail", async ({ page }, info) => {
  const state = await fixture(page); state.items = state.items.slice(0, 2);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await page.goto("/admin?section=organizations");
    await expect(page.getByRole("link", { name: "Открыть Организация 1", exact: true })).toBeVisible();
    const input = page.getByLabel("Название или БИН"); await input.focus(); await page.keyboard.press("Tab");
    const dropdown = page.getByRole("combobox", { name: "Статус организации", exact: true }); await expect(dropdown).toBeFocused();
    await page.keyboard.press("Enter"); await expect(page.getByRole("option", { name: "В архиве", exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`organization-dropdown-${width}.png`), fullPage: true });
    await page.keyboard.press("Escape"); await expect(dropdown).toBeFocused();
    const button = page.getByRole("button", { name: "Найти", exact: true });
    await expect(button).toHaveCSS("height", "44px"); await expect(button).toHaveCSS("border-radius", "8px"); await expect(button).toHaveCSS("font-family", /Manrope/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: info.outputPath(`organization-list-${width}.png`), fullPage: true });
    await page.getByRole("link", { name: "Открыть Организация 1", exact: true }).click();
    await expect(page.getByText("Алматы, Улица Абая, 10, 050000", { exact: true })).toBeVisible();
    await expect(page.getByText("Добавьте активный склад", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("link", { name: "К списку организаций" }).focus(); await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Обновить карточку" })).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: info.outputPath(`organization-detail-${width}.png`), fullPage: true });
  }
  expect(state.unexpected).toEqual([]); expect(state.errors).toEqual([]);
});

test("organization navigation keeps existing catalog attribute forms without fixed organization access requests", async ({ page }) => {
  const state = await fixture(page);
  await page.route("**/api/catalog/**", async route => {
    const path = new URL(route.request().url()).pathname;
    state.requests.push(path);
    if (path.endsWith("/quality")) return route.fulfill({ json: { cards: 0, indexed: 0, missingVariants: 0, missingCategories: 0, missingIndustries: 0, bySource: [] } });
    if (path.includes("manual")) return route.fulfill({ json: { items: [], nextCursor: null, options: { industries: [], categories: [], units: [] } } });
    return route.fulfill({ json: [] });
  });
  await page.route("**/api/marketplace/search/analytics**", route => route.fulfill({ json: { days: 30, queries: [] } }));
  await page.route("**/api/moderation/product-candidates/review-queue**", route => route.fulfill({ json: { items: [], nextCursor: null, options: { industries: [], categories: [], units: [] } } }));
  await page.route("**/api/moderation/product-corrections**", route => route.fulfill({ json: [] }));
  await page.route("**/api/promotions**", route => route.fulfill({ json: { items: [], total: 0, offset: 0, limit: 10 } }));
  await page.goto("/admin?section=catalog");
  const section = page.getByRole("region", { name: "Атрибуты и правила каталога", exact: true });
  await expect(section.getByRole("button", { name: "Создать атрибут" })).toBeVisible();
  await expect(section.getByRole("button", { name: "Сохранить правило" })).toBeVisible();
  await expect(section.getByRole("textbox", { name: /^Название RU/ })).toBeEditable();
  await expect(section.getByRole("heading", { name: "Роли и участники" })).toHaveCount(0);
  expect(state.requests.some(path => /\/organizations\/[^/]+\/(memberships|roles)/.test(path))).toBe(false);
  expect(state.unexpected).toEqual([]); expect(state.errors).toEqual([]);
});

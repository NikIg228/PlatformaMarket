import { expect, test, type Page } from "@playwright/test";
import type { OperatorCapabilities, OperatorDashboard } from "@marketplace/schemas";
import { queuePage } from "../fixtures/operation-queue-view";

const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const observedAt = "2026-10-14T00:00:00.000Z";
const available = (value: number) => ({ status: "AVAILABLE" as const, value });
const unavailable = { status: "UNAVAILABLE" as const, value: null, reason: "SOURCE_UNAVAILABLE" as const };
async function fixture(page: Page) {
  const dashboard: OperatorDashboard = { observedAt, scope: "PLATFORM_CURRENT_ALL_STATUSES", organizations: available(153), masterProducts: available(12001), effectivePermissions: available(4) };
  const capabilities: OperatorCapabilities = { observedAt, scope: "PLATFORM_CONFIGURATION", profile: "pilot", capabilities: [
    ...(["AI_ASSISTANT", "TRUST", "PROMOTIONS", "BILLING", "RECOMMENDATIONS"] as const).map(code => ({ id: code, status: "DISABLED_BY_PROFILE" as const, reason: "PROFILE_DISABLED" as const, section: code === "TRUST" ? "security" as const : code === "PROMOTIONS" ? "catalog" as const : null })),
    { id: "AI_MODEL", status: "DISABLED_BY_PROFILE", reason: "PROFILE_DISABLED", section: null },
    { id: "PAYMENT_CONNECTOR", status: "NOT_CONFIGURED", reason: "EXTERNAL_CONFIG_MISSING", section: "orders" },
  ], connectors: { status: "AVAILABLE", counts: { total: 0, readinessReady: 0, registeredLiveVerified: 0, externalDependencies: 0, blocked: 0 } }, activePaymentProviders: available(0), activeComplianceRules: available(3) };
  const state = { dashboard, capabilities, dashboardStatus: 200, capabilitiesStatus: 200, hold: false, held: false, release: () => {}, errors: [] as string[], unexpected: [] as string[] };
  page.on("pageerror", error => state.errors.push(error.message));
  await page.addInitScript(({ actor, organization, session }) => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "synthetic-projection-proof", sessionId: session, activeOrganizationId: organization, user: { id: actor, displayName: "Оператор показателей" }, expiresAt: Date.now() + 3600000 })), { actor: id(1), organization: id(2), session: id(3) });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    if (path === "/operations/dashboard" || path === "/operations/capabilities") {
      const isDashboard = path.endsWith("dashboard"), status = isDashboard ? state.dashboardStatus : state.capabilitiesStatus;
      const body = structuredClone(isDashboard ? state.dashboard : state.capabilities);
      if (state.hold) { state.held = true; await new Promise<void>(resolve => { state.release = resolve; }); }
      return route.fulfill({ status, json: status === 200 ? body : { code: status === 403 ? "FORBIDDEN" : "UNAVAILABLE", message: "Synthetic failure" } });
    }
    if (path === "/organizations") return route.fulfill({ json: [{ id: id(2), capabilities: [{ capability: "MARKETPLACE_OPERATOR" }] }] });
    if (path.startsWith("/notifications/")) return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null, asOf: observedAt } });
    if (path === "/operations/work-queue") return route.fulfill({ json: queuePage([], { operatorOrganizationId: id(2) }) });
    if (["/operations/work-queue/assignees", "/access-control/permissions", "/auth/sessions", "/support/tickets"].includes(path)) return route.fulfill({ json: [] });
    if (path === "/access-control/policy") return route.fulfill({ json: { mode: "ROLE_BASED", permissions: [] } });
    state.unexpected.push(path); return route.fulfill({ status: 500, json: { message: "Unexpected projection fixture endpoint" } });
  });
  return state;
}

test("dashboard preserves real counts, unknown/zero, load failure and access recovery", async ({ page }) => {
  const state = await fixture(page); state.hold = true;
  await page.goto("/admin?section=overview&supportQ=abc&supportOffset=50");
  const panel = page.getByRole("region", { name: "Показатели данных" });
  await expect.poll(() => state.held).toBe(true); await expect(panel.getByText("Загружаем показатели", { exact: true })).toBeVisible();
  state.hold = false; state.release();
  await expect(panel.getByText("12 001", { exact: true })).toBeVisible();
  const href = await panel.getByRole("link", { name: "Каталог", exact: true }).getAttribute("href");
  expect(new URL(href!, page.url()).searchParams.get("supportQ")).toBe("abc");
  expect(new URL(href!, page.url()).searchParams.get("supportOffset")).toBe("50");
  state.dashboard.masterProducts = unavailable; state.dashboard.organizations = available(0);
  await page.reload();
  await expect(panel.getByText("Нет данных", { exact: true })).toBeVisible();
  await expect(panel.locator("dd").filter({ hasText: /^0$/ })).toHaveCount(1);
  state.dashboardStatus = 503; await page.reload();
  await expect(panel.getByText("Показатели недоступны", { exact: true })).toBeVisible();
  await expect(panel.getByText(/Последняя загрузка|Обновлено/)).toHaveCount(0);
  state.dashboardStatus = 403; await page.reload();
  await expect(panel.getByText("Показатели недоступны", { exact: true })).toBeVisible(); await expect(panel.locator("dd")).toHaveCount(0);
  state.dashboardStatus = 200; state.dashboard.masterProducts = available(12001);
  await panel.getByRole("button", { name: "Повторить загрузку показателей" }).click();
  await expect(panel.getByText("12 001", { exact: true })).toBeVisible();
  expect(state.errors).toEqual([]); expect(state.unexpected).toEqual([]);
});

test("capabilities distinguish disabled, configured unverified, source failure and profile mismatch", async ({ page }) => {
  const state = await fixture(page); state.capabilitiesStatus = 503;
  await page.goto("/admin?section=settings&supportQ=abc&supportOffset=50");
  const panel = page.getByRole("region", { name: "Возможности платформы" });
  await expect(panel.getByText("Возможности недоступны", { exact: true })).toBeVisible();
  state.capabilitiesStatus = 200; await panel.getByRole("button", { name: "Повторить загрузку возможностей" }).click();
  await expect(panel.getByText("Отключено профилем", { exact: true })).toHaveCount(6);
  await expect(panel.getByText("Реестр каналов пока пуст.")).toBeVisible();
  const href = await panel.getByRole("link", { name: "Каталог", exact: true }).getAttribute("href");
  expect(new URL(href!, page.url()).searchParams.get("supportOffset")).toBe("50");
  const initialMismatch = await panel.getByText("Профили интерфейса и API различаются", { exact: true }).count();
  state.capabilities.profile = "go_live";
  state.capabilities.capabilities = state.capabilities.capabilities.map(item => ({ ...item, status: item.id === "AI_MODEL" || item.id === "PAYMENT_CONNECTOR" ? "EXTERNAL_CONFIRMATION_REQUIRED" : "AVAILABLE", reason: item.id === "AI_MODEL" || item.id === "PAYMENT_CONNECTOR" ? "EXTERNAL_VERIFICATION_MISSING" : "PROFILE_ENABLED" }));
  state.capabilities.connectors = { status: "UNAVAILABLE", counts: null, reason: "SOURCE_UNAVAILABLE" };
  await page.reload();
  await expect(panel.getByText("Профили интерфейса и API различаются", { exact: true })).toHaveCount(initialMismatch ? 0 : 1);
  await expect(panel.getByText("Нужна внешняя проверка", { exact: true })).toHaveCount(2);
  await expect(panel.getByText("Включено в профиле", { exact: true })).toHaveCount(5);
  await expect(panel.getByText("Нет данных", { exact: true })).toHaveCount(2);
  expect(state.errors).toEqual([]); expect(state.unexpected).toEqual([]);
});

test("projection panels fit desktop/mobile with shared controls and keyboard links", async ({ page }, info) => {
  const state = await fixture(page);
  for (const section of ["overview", "settings"]) {
    await page.goto(`/admin?section=${section}`);
    const panel = page.getByRole("region", { name: section === "overview" ? "Показатели данных" : "Возможности платформы" });
    await expect(panel).toHaveAttribute("aria-busy", "false");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => document.fonts.ready);
      await expect(panel.getByRole("button", { name: /^Обновить/ })).toHaveCount(0);
      const refresh = panel.getByRole("link", { name: "Каталог", exact: true });
      await refresh.focus(); await expect(refresh).toBeFocused(); await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(refresh).toHaveCSS("height", "44px"); await expect(refresh).toHaveCSS("border-radius", "8px"); await expect(refresh).toHaveCSS("font-family", /Manrope/);
      // Capture the page at its top: locator screenshots can include a sticky
      // header across the middle after keyboard focus scrolls a long panel.
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: info.outputPath(`${section}-${width}.png`), fullPage: true });
    }
  }
  expect(state.errors).toEqual([]); expect(state.unexpected).toEqual([]);
});

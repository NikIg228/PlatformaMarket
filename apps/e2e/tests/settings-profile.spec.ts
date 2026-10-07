import { test, expect, type Page } from "@playwright/test";

// Intentional empty root pages. Every API call is intercepted; no database writes.
async function fixture(page: Page, role: "clinic" | "supplier") {
  const capability = role === "clinic" ? "BUYER" : "SUPPLIER";
  const organizationId = "11111111-1111-4111-8111-111111111111";
  const sessionId = "22222222-2222-4222-8222-222222222222";
  const unexpected: string[] = [];
  await page.addInitScript(({ capability, organizationId, sessionId }) => {
    sessionStorage.setItem(`dentmarket:${capability.toLowerCase()}-session`, JSON.stringify({
      capability, organizationId, sessionId, actorId: organizationId,
      accessToken: "fixture-not-a-real-token", accessTokenExpiresAt: Date.now() + 3600000,
      displayName: "Тестовый сотрудник", organizationDisplayName: "Демо организация",
    }));
  }, { capability, organizationId, sessionId });
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    if (path === "/auth/workspace-context") return route.fulfill({ json: { organizationId, organizationDisplayName: "Демо организация", capabilities: [capability] } });
    if (path === "/access-control/policy") return route.fulfill({ json: { mode: "ROLE_BASED", permissions: ["organization.view", "support.ticket.view", "notification.view"] } });
    if (path === "/auth/current") return route.fulfill({ json: new URL(route.request().url()).searchParams.has("workspace") ? { sessionId, user: { id: organizationId, displayName: "Тестовый сотрудник", email: "user@example.invalid" } } : null });
    // Clinic's existing organization/delivery gates still read their own context.
    if (role === "clinic" && route.request().method() === "GET" && path === "/organizations/current/profile") return route.fulfill({ json: { organizationId, legalName: "Демо клиника", displayName: "Демо клиника", bin: "000000000001", version: 1, canEdit: true, complete: true, profile: null } });
    if (role === "clinic" && path === "/catalog/cities") return route.fulfill({ json: [] });
    if (path === "/conversations") return route.fulfill({ json: { items: [], hasMore: false, unreadCount: 0 } });
    if (path.startsWith("/notifications/organizations/")) return route.fulfill({ json: { items: [], unreadCount: 0, hasMore: false, nextCursor: null } });
    unexpected.push(`${route.request().method()} ${path}`);
    return route.fulfill({ status: 503, json: { code: "UNEXPECTED_FIXTURE_REQUEST", message: "Неожиданный запрос" } });
  });
  return unexpected;
}

for (const role of ["clinic", "supplier"] as const) for (const width of [1440, 390]) {
  test(`settings-reset ${role} empty roots preserve shell and keyboard ${width}`, async ({ page }, info) => {
    const unexpected = await fixture(page, role);
    await page.setViewportSize({ width, height: 1000 });
    const routes = role === "supplier" ? ["settings", "settings?tab=warehouses", "settings?tab=sources", "profile"] : ["settings", "profile"];
    for (const route of routes) {
      await page.goto(`/${role}/${route}`);
      const main = page.locator("#workspace-content");
      await expect(main.getByRole("heading", { level: 1 })).toHaveText(route === "profile" ? "Мой профиль" : "Настройки организации");
      await expect(main.getByRole("heading", { level: 2 })).toHaveCount(0);
      await expect(main.locator("form, section, input, textarea, select, [role=tablist], [role=region]")).toHaveCount(0);
      // Only the shared header may remain; no placeholder or hidden page content.
      await expect(main.locator(":scope > :not(header)")).toHaveCount(0);
      const avatar = page.getByRole("button", { name: "Меню профиля", exact: true });
      await avatar.focus(); await page.keyboard.press("Enter");
      const menu = page.getByRole("menu");
      await expect(menu.getByRole("menuitem", { name: "Мой профиль", exact: true })).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(menu.getByRole("menuitem", { name: "Выйти", exact: true })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden(); await expect(avatar).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`${role}-${route.replace(/\W/g, "-")}-${width}.png`), fullPage: true, animations: "disabled" });
    }
    expect(unexpected).toEqual([]);
  });
}

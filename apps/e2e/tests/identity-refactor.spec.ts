import { expect, test } from "@playwright/test";

test("revoking the current admin session clears identity and opens the profile login", async ({ page }) => {
  const legacy = process.env.REFACTOR_LEGACY_ADMIN === "1";
  const base = legacy ? "http://127.0.0.1:3004" : "http://127.0.0.1:3000";
  const session = "11111111-1111-4111-8111-111111111111";
  const organization = "22222222-2222-4222-8222-222222222222";
  const writes: unknown[] = [];
  await page.addInitScript(({ session, organization }) => {
    if (!sessionStorage.getItem("refactor-initialized")) {
      sessionStorage.setItem("refactor-initialized", "1");
      sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ accessToken: "synthetic-session-revocation", sessionId: session, activeOrganizationId: organization, user: { id: session, displayName: "Оператор" }, expiresAt: Date.now() + 3_600_000 }));
    }
  }, { session, organization });
  await page.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, "");
    if (request.method() === "POST" && path === `/auth/sessions/${session}/revoke`) {
      writes.push(request.postDataJSON());
      return route.fulfill({ json: { id: session, status: "REVOKED" } });
    }
    if (request.method() !== "GET") throw new Error(`Unexpected write ${path}`);
    if (path === "/organizations") return route.fulfill({ json: [{ id: organization, capabilities: [{ capability: "MARKETPLACE_OPERATOR" }] }] });
    if (path === "/access-control/policy") return route.fulfill({ json: { mode: "ROLE_BASED", permissions: [] } });
    if (path === "/access-control/permissions") return route.fulfill({ json: [] });
    if (path.startsWith("/notifications/")) return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null, asOf: "2026-10-30T00:00:00.000Z" } });
    if (path === "/auth/sessions") return route.fulfill({ json: [{ id: session, status: "ACTIVE", ipAddress: null, userAgent: "Isolated browser fixture", lastUsedAt: null, expiresAt: "2026-10-31T00:00:00.000Z", createdAt: "2026-10-30T00:00:00.000Z" }] });
    return route.fulfill({ status: 503, json: { message: "Adjacent fixture unavailable" } });
  });
  await page.goto(`${base}${legacy ? "/" : "/admin"}?section=settings`);
  const region = page.getByRole("region", { name: "Сессии аккаунта", exact: true });
  await expect(region.getByText("Текущая сессия", { exact: true })).toBeVisible();
  await region.getByRole("button", { name: "Завершить сессию", exact: true }).click();
  await region.getByRole("button", { name: "Подтвердить завершение", exact: true }).click();
  await expect(page).toHaveURL(`${base}${legacy ? "/login" : "/admin/login"}`);
  expect(await page.evaluate(() => sessionStorage.getItem("dentmarket_admin_session"))).toBeNull();
  expect(writes).toEqual([{ reason: "user_security_settings" }]);
});

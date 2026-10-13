import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { passwordHash } from "../../api/src/modules/identity/password-codec";

test.afterEach(async ({ page }) => { await page.goto("about:blank"); });
test("real operator password, cookie recovery, tenant denial and logout without MFA", async ({ page, context, request }, info) => {
  const target = new URL(process.env.DATABASE_URL!);
  if (target.pathname !== "/dentmarket_audit_20260914" || !["localhost", "127.0.0.1"].includes(target.hostname)) throw new Error("Isolated database required");
  const db = new PrismaClient();
  const password = randomBytes(24).toString("base64url");
  const email = `operator-auth-${randomUUID()}@example.invalid`;
  const org = await db.organization.create({ data: { bin: String(randomInt(100000000000, 999999999999)), legalName: "Synthetic operator sign-in", displayName: "Оператор проверки", capabilities: { create: { capability: "MARKETPLACE_OPERATOR" } } } });
  const role = await db.role.create({ data: { organizationId: org.id, code: "operator-auth", name: "Оператор проверки", permissions: { create: ["organization.view", "support.ticket.view", "support.ticket.create", "support.ticket.manage", "notification.view", "catalog.product.view"].map(code => ({ permission: { connect: { code } } })) } } });
  const user = await db.user.create({ data: { email, displayName: "Оператор проверки", emailVerifiedAt: new Date(), passwordHash: passwordHash(password), memberships: { create: { organizationId: org.id, status: "ACTIVE", roles: { create: { roleId: role.id } } } } } });
  const tenant = await db.user.create({ data: { email: `tenant-${randomUUID()}@example.invalid`, displayName: "Участник проверки", emailVerifiedAt: new Date(), passwordHash: passwordHash(password) } });
  const api = "http://127.0.0.1:4413/api";
  await context.route("**/api/**", async route => { const url = new URL(route.request().url()); const response = await route.fetch({ url: `http://127.0.0.1:4413${url.pathname}${url.search}` }); await route.fulfill({ response }); });
  try {
    expect((await request.post(`${api}/auth/operator/login`, { data: { email: tenant.email, password } })).status()).toBe(401);
    expect((await request.post(`${api}/auth/operator/login`, { data: { email, password: "incorrect-password" } })).status()).toBe(401);
    expect((await request.post(`${api}/auth/operator/login`, { data: { email, password, organizationId: org.id } })).status()).toBe(400);
    // The same account through the ordinary endpoint does not bypass the global MFA rule.
    const ordinary = await (await request.post(`${api}/auth/login`, { data: { email, password } })).json();
    expect((await request.get(`${api}/organizations`, { headers: { authorization: `Bearer ${ordinary.accessToken}` } })).status()).toBe(401);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 }); await page.goto("/admin/login");
      await expect(page.getByRole("heading", { name: "Вход в кабинет" })).toBeVisible();
      await page.getByLabel("Email оператора").fill(email); await page.getByLabel("Пароль оператора").fill(password);
      await page.getByRole("button", { name: "Войти", exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/?$/);
      await page.goto("/admin?section=support");
      await expect(page.getByRole("heading", { name: "Обращения и споры", exact: true })).toBeVisible();
      await expect(page.getByLabel("Код подтверждения")).toHaveCount(0);
      const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem("dentmarket_admin_session")!));
      expect(session.activeOrganizationId).toBe(org.id);
      expect((await request.get(`${api}/organizations`, { headers: { authorization: `Bearer ${session.accessToken}` } })).status()).toBe(200);
      const cookies = await context.cookies();
      expect(cookies.some(cookie => cookie.name === "mp_refresh_admin" && cookie.httpOnly)).toBe(true);
      // Reload/new tab restores staff only, never the unrelated sign-in cookie.
      await page.evaluate(() => sessionStorage.removeItem("dentmarket_admin_session")); await page.reload();
      await expect(page.getByRole("heading", { name: "Обращения и споры", exact: true })).toBeVisible();
      expect(await page.evaluate(() => Boolean(sessionStorage.getItem("dentmarket_admin_session")))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`operator-cabinet-${width}.png`), fullPage: true, animations: "disabled" });
      const denied = await page.evaluate(async () => (await fetch("/api/auth/operator/logout", { method: "POST" })).status);
      expect(denied).toBe(401);
      if (width === 390) await page.getByRole("button", { name: "Открыть меню", exact: true }).click();
      await page.getByRole("button", { name: "Выйти", exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/login$/);
      expect((await request.get(`${api}/organizations`, { headers: { authorization: `Bearer ${session.accessToken}` } })).status()).toBe(401);
      expect(await page.evaluate(() => sessionStorage.getItem("dentmarket_admin_session") === null)).toBe(true);
    }
    expect(await db.userMfaFactor.count({ where: { userId: user.id } })).toBe(0);
  } finally {
    await db.authSession.updateMany({ where: { userId: { in: [user.id, tenant.id] } }, data: { status: "REVOKED", revokedAt: new Date(), revokeReason: "operator_auth_verification_finished" } });
    await db.$disconnect();
  }
});

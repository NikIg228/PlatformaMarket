import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { workspaceFixture } from "../fixtures/workspace-session";

test.use({ trace: "off", screenshot: "off" });
const mailDirectory = path.resolve("../api/.tmp/auth-mail");
async function invitationMail(email: string) {
  const found: Array<{ file: string; link: string; createdAt: string }> = [];
  for (const file of await readdir(mailDirectory)) {
    if (!/^[a-f0-9-]{36}\.json$/.test(file)) continue;
    const message = JSON.parse(await readFile(path.join(mailDirectory, file), "utf8"));
    if (message.to !== email) continue;
    expect(message.delivery).toBe("LOCAL_FILE");
    const link = String(message.text).match(/http:\/\/127\.0\.0\.1:3000\/invitation#token=[A-Za-z0-9_-]+/)?.[0];
    if (link) found.push({ file, link, createdAt: message.createdAt });
  }
  return found.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

for (const capability of ["BUYER", "SUPPLIER", "MARKETPLACE_OPERATOR"] as const) test(`${capability}: invitation, colleague access and session revocation`, async ({ page, browser, request }) => {
  const width = capability === "SUPPLIER" ? 390 : 1440;
  const operator = capability === "MARKETPLACE_OPERATOR";
  await page.setViewportSize({ width, height: 900 });
  const db = new PrismaClient();
  const key = randomUUID(), email = `core05-${key}@example.invalid`;
  let userId: string | undefined;
  const colleague = await browser.newContext({ viewport: { width, height: 900 } });
  const invitePage = await colleague.newPage();
  try {
    // workspaceFixture verifies the disposable DB before creating auth state.
    const target = new URL(process.env.DATABASE_URL!);
    expect(target.pathname).toBe(process.env.GITHUB_ACTIONS === "true" ? "/marketplace" : "/dentmarket_audit_20260914");
    const organization = await db.organization.create({ data: { bin: `96${String(Date.now()).slice(-10)}`, legalName: `Core05 ${key}`, displayName: `Core05 ${capability}`, capabilities: { create: { capability } } } });
    if (capability === "SUPPLIER") await db.supplierProfile.create({ data: { organizationId: organization.id } });
    const user = await db.user.create({ data: { email: `owner-${email}`, displayName: "Synthetic manager", emailVerifiedAt: new Date() } }); userId = user.id;
    const managerRole = await db.role.create({ data: { organizationId: organization.id, code: "manager", name: "Администратор", permissions: { create: ["organization.view", "organization.members.manage", "organization.roles.manage", "catalog.product.view"].map(code => ({ permission: { connect: { code } } })) } } });
    const memberRole = await db.role.create({ data: { organizationId: organization.id, code: "employee", name: "Сотрудник", permissions: { create: ["organization.view", "catalog.product.view"].map(code => ({ permission: { connect: { code } } })) } } });
    await db.organizationMembership.create({ data: { organizationId: organization.id, userId: user.id, status: "ACTIVE", acceptedAt: new Date(), roles: { create: { roleId: managerRole.id } } } });
    const session = await workspaceFixture(db, capability, { userId: user.id, organizationId: organization.id, displayName: organization.displayName });
    await page.addInitScript(({ session, capability, actorId, operator }) => sessionStorage.setItem(operator ? "dentmarket_admin_session" : `dentmarket:${capability.toLowerCase()}-session`, JSON.stringify({ ...session, actorId, user: { id: actorId }, activeOrganizationId: session.organizationId })), { session, capability, actorId: user.id, operator });
    const route = operator ? "/admin" : capability === "BUYER" ? "/clinic/settings" : "/supplier/settings";
    await page.goto(route);
    if (operator) await page.getByRole("button", { name: "Настройки", exact: true }).click();
    const management = page.getByRole("region", { name: "Сотрудники и доступ" });
    await management.getByLabel("Email сотрудника").fill(email);
    await management.getByLabel("Роль приглашённого").selectOption(memberRole.id);
    await management.getByRole("button", { name: "Пригласить сотрудника", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(management.getByText("Приглашение сохранено в локальной тестовой почте. Внешнее письмо не отправлялось.")).toBeVisible();
    const messages = await invitationMail(email); expect(messages.length).toBe(1);
    await invitePage.goto(messages[0].link);
    await expect(invitePage).toHaveURL("http://127.0.0.1:3000/invitation");
    await invitePage.getByLabel("Ваше имя").fill("Synthetic colleague");
    await invitePage.getByLabel("Создайте пароль", { exact: false }).fill(randomBytes(24).toString("base64url"));
    await invitePage.getByRole("button", { name: "Принять приглашение" }).click();
    await expect(invitePage.getByRole("link", { name: "Войти в аккаунт" })).toBeVisible();
    await invitePage.screenshot({ path: test.info().outputPath(`accepted-${width}.png`) });
    await management.getByRole("button", { name: "Обновить сотрудников" }).click();
    const member = management.getByRole("article", { name: email, exact: true });
    await expect(member.getByText("Доступ открыт", { exact: true })).toBeVisible();
    const added = await db.user.findUniqueOrThrow({ where: { email } });
    const memberSession = await workspaceFixture(db, capability, { userId: added.id, organizationId: organization.id, displayName: organization.displayName });
    await invitePage.evaluate(({ memberSession, capability, actorId, operator }) => sessionStorage.setItem(operator ? "dentmarket_admin_session" : `dentmarket:${capability.toLowerCase()}-session`, JSON.stringify({ ...memberSession, actorId, user: { id: actorId }, activeOrganizationId: memberSession.organizationId })), { memberSession, capability, actorId: added.id, operator });
    await invitePage.goto(route);
    if (operator) await invitePage.getByRole("button", { name: "Настройки", exact: true }).click();
    await expect(invitePage.getByText("Управление сотрудниками доступно администратору организации.")).toBeVisible();
    await member.getByRole("button", { name: "Отключить доступ" }).click();
    await management.getByRole("button", { name: "Подтвердить изменение" }).click();
    await expect(member.getByText("Доступ отключён", { exact: true })).toBeVisible();
    expect(await db.authSession.count({ where: { userId: added.id, status: "ACTIVE" } })).toBe(0);
    expect((await request.get("/api/auth/sessions", { headers: { authorization: `Bearer ${memberSession.accessToken}` } })).status()).toBe(401);
    if (!operator) {
      await invitePage.reload();
      await expect(invitePage.getByRole("link", { name: "Войти", exact: true })).toBeVisible();
    }
    await member.getByRole("button", { name: "Восстановить доступ" }).click();
    await management.getByRole("button", { name: "Подтвердить изменение" }).click();
    await expect(member.getByText("Доступ открыт", { exact: true })).toBeVisible();
    await member.getByLabel("Дополнительная роль").selectOption(managerRole.id);
    await member.getByRole("button", { name: "Назначить роль", exact: true }).click();
    await expect(member.getByRole("button", { name: "Снять роль Администратор" })).toBeVisible();
    await member.getByRole("button", { name: "Снять роль Администратор" }).click();
    await management.getByRole("button", { name: "Подтвердить изменение" }).click();
    await expect(member.getByRole("button", { name: "Снять роль Администратор" })).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`members-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await invitePage.goto("about:blank"); await colleague.close(); await page.goto("about:blank");
    for (const message of await invitationMail(email).catch(() => [])) await unlink(path.join(mailDirectory, message.file));
    const users = await db.user.findMany({ where: { OR: [{ email }, ...(userId ? [{ id: userId }] : [])] }, select: { id: true } });
    await db.authSession.updateMany({ where: { userId: { in: users.map(user => user.id) } }, data: { status: "REVOKED", revokedAt: new Date(), revokeReason: "core05_browser_finished" } });
    await db.$disconnect();
  }
});

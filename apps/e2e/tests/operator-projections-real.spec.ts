import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { workspaceFixture } from "../fixtures/workspace-session";

test("real operator sees database totals and profile projection through the unified UI", async ({ page }) => {
  const db = new PrismaClient(); let organizationId: string | undefined, userId: string | undefined;
  try {
    const target = new URL(process.env.DATABASE_URL!);
    const expectedDatabase = process.env.GITHUB_ACTIONS === "true" ? "marketplace" : "dentmarket_audit_20260914";
    expect(target.pathname).toBe(`/${expectedDatabase}`);
    const [database] = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    expect(database.name).toBe(expectedDatabase);
    const key = randomUUID();
    const organization = await db.organization.create({ data: { bin: `93${String(Date.now()).slice(-10)}`, legalName: `Projection UI ${key}`, displayName: "Проверка показателей", capabilities: { create: { capability: "MARKETPLACE_OPERATOR" } } } }); organizationId = organization.id;
    const user = await db.user.create({ data: { email: `projection-ui-${key}@example.invalid`, displayName: "Оператор показателей", emailVerifiedAt: new Date() } }); userId = user.id;
    const role = await db.role.create({ data: { organizationId, code: "projection-ui", name: "Projection UI", permissions: { create: ["organization.view", "notification.view"].map(code => ({ permission: { connect: { code } } })) } } });
    await db.organizationMembership.create({ data: { userId, organizationId, status: "ACTIVE", acceptedAt: new Date(), roles: { create: { roleId: role.id } } } });
    const session = await workspaceFixture(db, "MARKETPLACE_OPERATOR", { userId, organizationId, displayName: organization.displayName });
    await page.addInitScript(({ session, userId }) => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ ...session, activeOrganizationId: session.organizationId, user: { id: userId }, expiresAt: Date.now() + 3600000 })), { session, userId });
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const products = await db.product.count(), organizations = await db.organization.count();
    await page.goto("/admin?section=overview&supportQ=real-context&supportOffset=50");
    const metrics = page.getByRole("region", { name: "Показатели данных" });
    await expect(metrics.getByText(new Intl.NumberFormat("ru-KZ").format(products), { exact: true })).toBeVisible();
    await expect(metrics.getByText(new Intl.NumberFormat("ru-KZ").format(organizations), { exact: true })).toBeVisible();
    await metrics.getByRole("link", { name: "Настройки доступа" }).click();
    expect(new URL(page.url()).searchParams.get("supportQ")).toBe("real-context");
    const settings = page.getByRole("region", { name: "Возможности платформы" });
    await expect(settings.getByText("Отключено профилем", { exact: true })).toHaveCount(6);
    await expect(settings.getByText("Профили интерфейса и API различаются", { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    if (userId) {
      await db.authSession.deleteMany({ where: { userId } });
      await db.organizationMembership.deleteMany({ where: { userId } });
    }
    if (organizationId) {
      await db.role.deleteMany({ where: { organizationId } });
      await db.organizationProfile.deleteMany({ where: { organizationId } });
      await db.address.deleteMany({ where: { organizationId } });
      await db.organizationCapability.deleteMany({ where: { organizationId } });
      await db.organization.delete({ where: { id: organizationId } });
    }
    if (userId) await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  }
});

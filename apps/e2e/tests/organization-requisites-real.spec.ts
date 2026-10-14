import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { workspaceFixture } from "../fixtures/workspace-session";

test("real supplier requisites save confirmation reload and immutable history", async ({ page }) => {
  const db = new PrismaClient(); let organizationId: string | undefined, userId: string | undefined;
  try {
    const target = new URL(process.env.DATABASE_URL!), expected = process.env.GITHUB_ACTIONS === "true" ? "marketplace" : "dentmarket_audit_20260914";
    expect(["localhost", "127.0.0.1"]).toContain(target.hostname); expect(target.pathname).toBe(`/${expected}`);
    const [identity] = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`; expect(identity.name).toBe(expected);
    const key = randomUUID();
    const org = await db.organization.create({ data: { bin: `934${String(Date.now()).slice(-9)}`, legalName: `Synthetic requisites ${key}`, displayName: "Проверка реквизитов", commerceDataset: "TEST", capabilities: { create: { capability: "SUPPLIER" } } } }); organizationId = org.id;
    const user = await db.user.create({ data: { email: `requisites-${key}@example.invalid`, displayName: "Представитель организации", emailVerifiedAt: new Date() } }); userId = user.id;
    const role = await db.role.create({ data: { organizationId, code: "requisites-ui", name: "Requisites UI", permissions: { create: ["organization.view", "organization.members.manage", "notification.view", "support.ticket.view"].map(code => ({ permission: { connect: { code } } })) } } });
    await db.organizationMembership.create({ data: { userId, organizationId, status: "ACTIVE", acceptedAt: new Date(), roles: { create: { roleId: role.id } } } });
    const session = await workspaceFixture(db, "SUPPLIER", { userId, organizationId, displayName: org.displayName });
    await page.addInitScript(session => sessionStorage.setItem("dentmarket:supplier-session", JSON.stringify(session)), session);
    if (process.env.REQUISITES_TEST_API) {
      const upstream = new URL(process.env.REQUISITES_TEST_API);
      expect(upstream.origin).toBe("http://127.0.0.1:4115");
      await page.route("**/api/**", async route => {
        const original = new URL(route.request().url());
        const response = await route.fetch({ url: `${upstream.origin}${original.pathname}${original.search}` });
        await route.fulfill({ response });
      });
    }
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto("/supplier/settings?tab=requisites");
    await page.getByLabel("Юридическая форма", { exact: true }).selectOption("LEGAL_ENTITY");
    await page.getByRole("button", { name: "Добавить счёт", exact: true }).click();
    await page.getByRole("textbox", { name: "Название банка", exact: true }).fill("Synthetic Bank");
    await page.getByRole("textbox", { name: "ИИК / IBAN", exact: true }).fill("KZ86125KZT5004100100");
    await page.getByRole("textbox", { name: "БИК", exact: true }).fill("FAKEKZXX");
    await page.getByRole("textbox", { name: "КБе", exact: true }).fill("17");
    await page.getByRole("button", { name: "Добавить период", exact: true }).click();
    await page.getByRole("combobox", { name: "Статус по НДС", exact: true }).selectOption("VAT_PAYER");
    await page.getByLabel("Действует с", { exact: false }).fill("2020-01-01");
    await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
    await page.getByRole("button", { name: "Проверить и подтвердить", exact: true }).click();
    const dialog = page.getByRole("dialog"); await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Подтвердить реквизиты", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    await expect(page.getByRole("region", { name: "Реквизиты организации", exact: true }).getByText("Реквизиты подтверждены", { exact: true })).toBeVisible();
    const first = await db.organizationRequisitesRevision.findUniqueOrThrow({ where: { organizationId_version: { organizationId, version: 1 } } });
    expect(first.confirmedById).toBe(userId); expect(first.confirmedAt).not.toBeNull();
    await page.getByRole("button", { name: "Изменить реквизиты", exact: true }).click();
    await page.getByRole("textbox", { name: "Название банка", exact: true }).fill("New Synthetic Bank");
    await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
    await expect(page.getByText("Версия 2 · сохранена", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Закрыть уведомление", exact: true }).click();
    await page.getByRole("button", { name: "Показать историю", exact: true }).click();
    await page.getByRole("button", { name: "Открыть версию 1", exact: true }).click();
    await expect(dialog.getByText("Synthetic Bank", { exact: true })).toBeVisible();
    expect(await db.organizationRequisitesRevision.findUniqueOrThrow({ where: { id: first.id } })).toEqual(first);
    expect(await db.organizationRequisitesRevision.count({ where: { organizationId } })).toBe(2);
    expect(await db.outboxEvent.count({ where: { aggregateId: organizationId, eventType: "OrganizationRequisitesConfirmed" } })).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    if (organizationId) {
      await db.organizationRequisitesRevision.deleteMany({ where: { organizationId } }); await db.organizationRequisites.deleteMany({ where: { organizationId } });
      await db.idempotencyRecord.deleteMany({ where: { scope: { in: [`organization-requisites:${organizationId}:save`, `organization-requisites:${organizationId}:confirm`] } } });
      await db.outboxEvent.deleteMany({ where: { aggregateId: organizationId } }); await db.auditLog.deleteMany({ where: { organizationId } });
      await db.organizationProfile.deleteMany({ where: { organizationId } }); await db.address.deleteMany({ where: { organizationId } });
      if (userId) await db.authSession.deleteMany({ where: { userId } });
      await db.organizationMembership.deleteMany({ where: { organizationId } }); await db.role.deleteMany({ where: { organizationId } });
      await db.organizationCapability.deleteMany({ where: { organizationId } }); await db.organization.delete({ where: { id: organizationId } });
    }
    if (userId) await db.user.delete({ where: { id: userId } }); await db.$disconnect();
  }
});

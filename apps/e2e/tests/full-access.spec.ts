import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { workspaceFixture } from "../fixtures/workspace-session";

// Real JWT + disposable PostgreSQL; no working demo data or role assignments changed.
test.use({ trace: "off", screenshot: "off" });
for (const capability of ["BUYER", "SUPPLIER", "MARKETPLACE_OPERATOR"] as const) {
  test(`${capability}: full access without assigned roles preserves organization boundaries`, async ({ page, request }) => {
    const db = new PrismaClient();
    let userId: string | undefined;
    try {
      const target = new URL(process.env.DATABASE_URL!);
      expect(target.pathname).toBe(process.env.GITHUB_ACTIONS === "true" ? "/marketplace" : "/dentmarket_audit_20260914");
      const key = randomUUID();
      const org = await db.organization.create({ data: { bin: `95${String(Date.now()).slice(-10)}`, legalName: `Full access ${key}`, displayName: `Full access ${capability}`, capabilities: { create: { capability } } } });
      if (capability === "SUPPLIER") await db.supplierProfile.create({ data: { organizationId: org.id } });
      const user = await db.user.create({ data: { email: `access-${key}@example.invalid`, displayName: "Сотрудник без роли", emailVerifiedAt: new Date() } });
      userId = user.id;
      const membership = await db.organizationMembership.create({ data: { organizationId: org.id, userId: user.id, status: "ACTIVE", acceptedAt: new Date() } });
      const session = await workspaceFixture(db, capability, { userId: user.id, organizationId: org.id, displayName: org.displayName });
      const headers = { authorization: `Bearer ${session.accessToken}` };
      const policy = await request.get("/api/access-control/policy", { headers });
      expect(policy.status()).toBe(200);
      expect(await policy.json()).toMatchObject({ mode: "FULL_ACCESS", permissions: expect.arrayContaining(["organization.members.manage", "notification.view", "support.ticket.view"]) });
      expect((await request.get(`/api/organizations/${org.id}/memberships`, { headers })).status()).toBe(200);
      expect((await request.get(`/api/organizations/${randomUUID()}/memberships`, { headers })).status()).toBe(403);
      expect((await request.post(`/api/organizations/${org.id}/roles`, { headers, data: { code: "disabled", name: "Disabled role", permissionCodes: ["organization.view"] } })).status()).toBe(409);
      if (capability !== "MARKETPLACE_OPERATOR") {
        expect((await request.get("/api/operations/work-queue/assignees", { headers })).status()).toBe(403);
        const profile = await request.get("/api/organizations/current/profile", { headers });
        expect(profile.status()).toBe(200);
        expect(await profile.json()).toMatchObject({ organizationId: org.id, canEdit: true });
      } else {
        const assignees = await request.get("/api/operations/work-queue/assignees", { headers });
        expect(assignees.status()).toBe(200);
        expect(await assignees.json()).toEqual(expect.arrayContaining([expect.objectContaining({ id: user.id })]));
      }
      if (capability === "SUPPLIER") {
        expect((await request.get("/api/supplier-terms/current", { headers })).status()).toBe(200);
        const paymentPolicy = await request.get("/api/suppliers/current/payment-review-policy", { headers });
        expect(paymentPolicy.status()).toBe(200);
        expect(await paymentPolicy.json()).toMatchObject({ eligibleMembers: expect.arrayContaining([expect.objectContaining({ userId: user.id })]) });
      }
      const operator = capability === "MARKETPLACE_OPERATOR";
      await page.setViewportSize({ width: capability === "SUPPLIER" ? 390 : 1440, height: 900 });
      await page.addInitScript(({ session, capability, actorId, operator }) => sessionStorage.setItem(operator ? "dentmarket_admin_session" : `dentmarket:${capability.toLowerCase()}-session`, JSON.stringify({ ...session, actorId, user: { id: actorId }, activeOrganizationId: session.organizationId })), { session, capability, actorId: user.id, operator });
      const base = capability === "BUYER" ? "/clinic" : "/supplier";
      await page.goto(operator ? "/admin" : `${base}/settings`);
      if (operator) await page.getByRole("button", { name: "Настройки", exact: true }).click();
      const management = page.getByRole("region", { name: "Сотрудники и доступ" });
      if (operator) {
        await expect(management.getByText("Все активные сотрудники имеют полный доступ", { exact: false })).toBeVisible();
        await expect(management.getByLabel("Роль приглашённого")).toHaveCount(0);
        await management.getByLabel("Email сотрудника").fill(`colleague-${key}@example.invalid`);
        await expect(management.getByRole("button", { name: "Пригласить сотрудника", exact: true })).toBeEnabled();
        const invitationRequest = page.waitForRequest(value => value.method() === "POST" && value.url().endsWith(`/organizations/${org.id}/invitations`));
        await management.getByRole("button", { name: "Пригласить сотрудника", exact: true }).focus();
        await page.keyboard.press("Enter");
        expect((await invitationRequest).postDataJSON().roleIds).toEqual([]);
        await expect(page.locator('.dm-save-toast[role="status"]')).toContainText("Приглашение сохранено в локальной тестовой почте. Внешнее письмо не отправлялось.");
        await expect(management.getByRole("button", { name: "Назначить роль", exact: true })).toHaveCount(0);
        await expect(management.getByRole("article", { name: user.email, exact: true }).getByText("Полный доступ", { exact: true })).toBeVisible();
      } else {
        // Participant Settings covers the organization profile; member/role
        // forms remain excluded. Prove those server invariants through the API.
        await expect(page.getByRole("heading", { name: "Настройки организации", exact: true })).toBeVisible();
        await expect(management).toHaveCount(0);
        const email = `colleague-${key}@example.invalid`;
        const created = await request.post(`/api/organizations/${org.id}/invitations`, { headers, data: { email, roleIds: [], expiresInHours: 72 } });
        expect(created.status()).toBe(201);
        const { invitationId } = await created.json();
        const delivered = await request.post(`/api/organizations/${org.id}/invitations/${invitationId}/deliver`, { headers });
        expect(delivered.ok()).toBe(true);
        expect(await delivered.json()).toMatchObject({ invitationId, delivery: "LOCAL_FILE" });
        const invitations = await request.get(`/api/organizations/${org.id}/invitations`, { headers });
        expect(invitations.status()).toBe(200);
        expect(await invitations.json()).toEqual(expect.arrayContaining([expect.objectContaining({ id: invitationId, email, roleIds: [] })]));
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (!operator) {
        for (const [route, heading] of [["notifications", "Уведомления"], ["messages", "Сообщения"], ["orders", "Заказы"]]) {
          await page.goto(`${base}/${route}`);
          await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
          await expect(page.getByText("Этот раздел недоступен вашей роли.", { exact: false })).toHaveCount(0);
        }
      }
      expect(await db.membershipRole.count({ where: { membershipId: membership.id } })).toBe(0);
      await db.organizationMembership.update({ where: { id: membership.id }, data: { status: "BLOCKED" } });
      const blockedPolicy = await request.get("/api/access-control/policy", { headers });
      expect(await blockedPolicy.json()).toMatchObject({ permissions: [] });
      expect((await request.get(`/api/organizations/${org.id}/memberships`, { headers })).status()).toBe(403);
    } finally {
      await page.goto("about:blank");
      if (userId) await db.authSession.updateMany({ where: { userId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date(), revokeReason: "full_access_browser_finished" } });
      await db.$disconnect();
    }
  });
}

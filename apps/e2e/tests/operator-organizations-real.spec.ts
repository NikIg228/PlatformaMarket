import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { workspaceFixture } from "../fixtures/workspace-session";

test("real operator reads another organization's profile and supplier readiness without changing active identity", async ({ page }) => {
  const db = new PrismaClient(), ids: string[] = []; let userId: string | undefined;
  try {
    const target = new URL(process.env.DATABASE_URL!), expected = process.env.GITHUB_ACTIONS === "true" ? "marketplace" : "dentmarket_audit_20260914";
    expect(["localhost", "127.0.0.1"]).toContain(target.hostname); expect(target.pathname).toBe(`/${expected}`);
    const [database] = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`; expect(database.name).toBe(expected);
    const key = randomUUID(), suffix = String(Date.now()).slice(-9);
    const operator = await db.organization.create({ data: { bin: `921${suffix}`, legalName: `Registry operator ${key}`, displayName: "Оператор реестра", capabilities: { create: { capability: "MARKETPLACE_OPERATOR" } } } }); ids.push(operator.id);
    const supplier = await db.organization.create({ data: { bin: `922${suffix}`, legalName: `Registry supplier ${key}`, displayName: `Поставщик ${key}`, capabilities: { create: [{ capability: "SUPPLIER" }, { capability: "IMPORTER" }] } } }); ids.push(supplier.id);
    const cities = await db.city.findMany({ take: 2, orderBy: { id: "asc" }, include: { region: true } }); expect(cities).toHaveLength(2);
    const addresses = await Promise.all(cities.map((city, i) => db.address.create({ data: { organizationId: supplier.id, cityId: city.id, regionId: city.regionId, countryId: city.region.countryId, line1: `Проверочная улица ${i + 1}`, geoEvidence: { private: "not-for-projection" } } })));
    await db.organizationProfile.create({ data: { organizationId: supplier.id, contactName: "Ответственный поставщика", phone: "+77010000000", email: "registry-supplier@example.invalid", additionalContacts: [1, 2].map(n => ({ contactName: `Резерв поставщика ${n}`, phone: `+7701000000${n}`, email: `reserve${n}@example.invalid` })), legalAddressId: addresses[0].id, deliveryAddressId: addresses[1].id } });
    const user = await db.user.create({ data: { email: `registry-ui-${key}@example.invalid`, displayName: "Оператор реестра", emailVerifiedAt: new Date() } }); userId = user.id;
    const role = await db.role.create({ data: { organizationId: operator.id, code: "registry-ui", name: "Registry UI", permissions: { create: ["organization.view", "notification.view"].map(code => ({ permission: { connect: { code } } })) } } });
    await db.organizationMembership.create({ data: { userId, organizationId: operator.id, status: "ACTIVE", acceptedAt: new Date(), roles: { create: { roleId: role.id } } } });
    const session = await workspaceFixture(db, "MARKETPLACE_OPERATOR", { userId, organizationId: operator.id, displayName: operator.displayName });
    await page.addInitScript(({ session, userId }) => sessionStorage.setItem("dentmarket_admin_session", JSON.stringify({ ...session, activeOrganizationId: session.organizationId, user: { id: userId }, expiresAt: Date.now() + 3600000 })), { session, userId });
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const before = await db.organizationProfile.findUniqueOrThrow({ where: { organizationId: supplier.id } });
    await page.goto(`/admin?section=organizations&orgQ=${supplier.bin}&supportQ=keep-context`);
    await expect(page.getByText("Найдено организаций: 1", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: `Открыть ${supplier.displayName}`, exact: true }).click();
    await expect(page.getByText("Ответственный поставщика", { exact: false })).toBeVisible();
    await expect(page.getByText(`${cities[0].nameRu}, Проверочная улица 1`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${cities[1].nameRu}, Проверочная улица 2`, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Готовность поставщика", exact: true })).toBeVisible();
    await expect(page.getByText("Общие условия приняты", { exact: true })).toBeVisible();
    await expect(page.getByText("Есть незавершённые этапы", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("dentmarket_admin_session")!).activeOrganizationId)).toBe(operator.id);
    await page.reload(); await expect(page.getByRole("heading", { name: supplier.displayName, exact: true })).toBeVisible();
    await page.getByRole("link", { name: "К списку организаций" }).click();
    expect(new URL(page.url()).searchParams.get("orgQ")).toBe(supplier.bin); expect(new URL(page.url()).searchParams.get("supportQ")).toBe("keep-context");
    expect(await db.organizationProfile.findUniqueOrThrow({ where: { organizationId: supplier.id } })).toEqual(before);
    expect(errors).toEqual([]);
  } finally {
    if (userId) { await db.authSession.deleteMany({ where: { userId } }); await db.organizationMembership.deleteMany({ where: { userId } }); }
    await db.role.deleteMany({ where: { organizationId: { in: ids } } });
    await db.organizationProfile.deleteMany({ where: { organizationId: { in: ids } } }); await db.address.deleteMany({ where: { organizationId: { in: ids } } });
    await db.organizationCapability.deleteMany({ where: { organizationId: { in: ids } } }); await db.organization.deleteMany({ where: { id: { in: ids } } });
    if (userId) await db.user.delete({ where: { id: userId } }); await db.$disconnect();
  }
});

import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { operatorCapabilitiesSchema, operatorDashboardSchema } from "@marketplace/schemas";
import { workspaceFixture } from "../fixtures/workspace-session";

test("operator projections count beyond one page and enforce real session, membership and role boundaries", async ({ request }) => {
  const db = new PrismaClient();
  const organizationIds: string[] = [], userIds: string[] = [], productIds = Array.from({ length: 151 }, () => randomUUID());
  const run = randomUUID();
  let databaseVerified = false;
  try {
    const target = new URL(process.env.DATABASE_URL!);
    const expectedDatabase = process.env.GITHUB_ACTIONS === "true" ? "marketplace" : "dentmarket_audit_20260914";
    expect(["localhost", "127.0.0.1"]).toContain(target.hostname);
    expect(target.pathname).toBe(`/${expectedDatabase}`);
    const [identity] = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    expect(identity.name).toBe(expectedDatabase);
    databaseVerified = true;
    const suffix = String(Date.now()).slice(-7);
    const organizations = Array.from({ length: 151 }, (_, index) => ({ id: randomUUID(), bin: `94${suffix}${String(index).padStart(3, "0")}`, legalName: `Projection ${run}`, displayName: `Projection ${index}`, status: index % 2 ? "ARCHIVED" as const : "ACTIVE" as const }));
    organizationIds.push(...organizations.map(item => item.id));
    await db.organization.createMany({ data: organizations });
    await db.product.createMany({ data: productIds.map((id, index) => ({ id, canonicalName: `Projection ${index}`, slug: `projection-${run}-${index}`, productType: "SYNTHETIC_TEST", status: index % 2 ? "ARCHIVED" as const : "DRAFT" as const })) });
    const createActor = async (capability: "MARKETPLACE_OPERATOR" | "SUPPLIER", index: number) => {
      const organization = await db.organization.create({ data: { bin: `94${suffix}${index}`, legalName: `Projection identity ${run}`, displayName: "Projection identity", capabilities: { create: { capability } } } });
      organizationIds.push(organization.id);
      const user = await db.user.create({ data: { email: `projection-${capability}-${run}@example.invalid`, displayName: "Projection fixture", emailVerifiedAt: new Date() } });
      userIds.push(user.id);
      const role = await db.role.create({ data: { organizationId: organization.id, code: "projection", name: "Projection read", permissions: { create: { permission: { connect: { code: "organization.view" } } } } } });
      const membership = await db.organizationMembership.create({ data: { userId: user.id, organizationId: organization.id, status: "ACTIVE", acceptedAt: new Date(), roles: { create: { roleId: role.id } } } });
      const session = await workspaceFixture(db, capability, { userId: user.id, organizationId: organization.id, displayName: organization.displayName });
      return { organization, user, membership, session, headers: { authorization: `Bearer ${session.accessToken}` } };
    };
    const operator = await createActor("MARKETPLACE_OPERATOR", 800), supplier = await createActor("SUPPLIER", 801);
    const paths = ["/api/operations/dashboard", "/api/operations/capabilities"];
    for (const path of paths) {
      expect((await request.get(path)).status()).toBe(401);
      expect((await request.get(path, { headers: supplier.headers })).status()).toBe(403);
      expect((await request.get(`${path}?organizationId=${supplier.organization.id}`, { headers: operator.headers })).status()).toBe(400);
    }
    // JWT context rejects conflicting identity headers; it never trusts them.
    const spoofed = await request.get(paths[0], { headers: { ...operator.headers, "x-user-id": supplier.user.id, "x-organization-id": supplier.organization.id } });
    expect(spoofed.status()).toBe(401);
    const response = await request.get(paths[0], { headers: operator.headers });
    expect(response.status()).toBe(200);
    const dashboard = operatorDashboardSchema.parse(await response.json());
    expect(dashboard.organizations).toEqual({ status: "AVAILABLE", value: await db.organization.count() });
    expect(dashboard.masterProducts).toEqual({ status: "AVAILABLE", value: await db.product.count() });
    expect(dashboard.masterProducts.value).toBeGreaterThan(150);
    expect(dashboard.effectivePermissions).toEqual({ status: "AVAILABLE", value: 1 });
    const registryBefore = await db.connectorReadiness.count();
    const capabilities = await request.get(paths[1], { headers: operator.headers });
    expect(capabilities.status()).toBe(200);
    const projection = operatorCapabilitiesSchema.parse(await capabilities.json());
    expect(projection.profile).toBe("pilot");
    expect(projection.capabilities.find(item => item.id === "AI_ASSISTANT")?.status).toBe("DISABLED_BY_PROFILE");
    expect(await db.connectorReadiness.count()).toBe(registryBefore);
    expect(JSON.stringify(projection)).not.toMatch(/JWT_SECRET|OPENAI_API_KEY|PAYMENT_GATEWAY|postgresql:|Bearer /);
    await db.organization.update({ where: { id: operator.organization.id }, data: { status: "INACTIVE" } });
    expect([401, 403]).toContain((await request.get(paths[0], { headers: operator.headers })).status());
    await db.organization.update({ where: { id: operator.organization.id }, data: { status: "ACTIVE" } });
    await db.organizationMembership.update({ where: { id: operator.membership.id }, data: { status: "BLOCKED" } });
    expect([401, 403]).toContain((await request.get(paths[1], { headers: operator.headers })).status());
    await db.organizationMembership.update({ where: { id: operator.membership.id }, data: { status: "ACTIVE" } });
    await db.membershipRole.deleteMany({ where: { membershipId: operator.membership.id } });
    for (const path of paths) expect((await request.get(path, { headers: operator.headers })).status()).toBe(403);
    await db.authSession.update({ where: { id: operator.session.sessionId }, data: { status: "REVOKED", revokedAt: new Date() } });
    expect((await request.get(paths[0], { headers: operator.headers })).status()).toBe(401);
  } finally {
    if (databaseVerified) {
    await db.product.deleteMany({ where: { id: { in: productIds } } });
    await db.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await db.organizationMembership.deleteMany({ where: { userId: { in: userIds } } });
    await db.role.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.organizationProfile.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await db.address.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await db.organizationCapability.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
    }
    await db.$disconnect();
  }
});

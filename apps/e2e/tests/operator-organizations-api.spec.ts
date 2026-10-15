import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { operatorOrganizationDetailSchema, operatorOrganizationsSchema } from "@marketplace/schemas";
import { workspaceFixture } from "../fixtures/workspace-session";

test("organization registry paginates all records, preserves classifications and enforces real operator authority", async ({ request }) => {
  const db = new PrismaClient(), ids: string[] = [], users: string[] = [];
  const run = randomUUID(); let verified = false;
  try {
    const target = new URL(process.env.DATABASE_URL!);
    const expected = process.env.GITHUB_ACTIONS === "true" ? "marketplace" : "dentmarket_audit_20260914";
    expect(["localhost", "127.0.0.1"]).toContain(target.hostname); expect(target.pathname).toBe(`/${expected}`);
    const [identity] = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    expect(identity.name).toBe(expected); verified = true;
    const prefix = `93${String(Date.now()).slice(-7)}`;
    const date = new Date("2026-10-14T00:00:00Z");
    const rows = Array.from({ length: 151 }, (_, i) => ({ id: randomUUID(), bin: `${prefix}${String(i).padStart(3, "0")}`, legalName: `Registry ${run}`, displayName: `Clinic ${i}`, createdAt: date, status: (["ACTIVE", "INACTIVE", "ARCHIVED"] as const)[i % 3] }));
    ids.push(...rows.map(row => row.id));
    await db.organization.createMany({ data: rows });
    await db.organizationCapability.createMany({ data: rows.map(row => ({ organizationId: row.id, capability: "IMPORTER" })) });
    const cities = await db.city.findMany({ take: 2, orderBy: { id: "asc" }, include: { region: true } });
    expect(cities).toHaveLength(2);
    const addresses = await Promise.all(cities.map((city, index) => db.address.create({ data: { organizationId: rows[0].id, cityId: city.id, regionId: city.regionId, countryId: city.region.countryId, line1: `Registry safe address ${index}`, geoEvidence: { secret: "excluded-address-metadata" } } })));
    await db.organizationProfile.create({ data: { organizationId: rows[0].id, contactName: "Registry Official", phone: "+77010000000", email: "registry@example.invalid", legalAddressId: addresses[0].id, deliveryAddressId: addresses[1].id } });
    const actor = async (capability: "MARKETPLACE_OPERATOR" | "SUPPLIER", suffix: string) => {
      const org = await db.organization.create({ data: { bin: prefix + suffix, legalName: "Registry identity", displayName: "Registry identity", capabilities: { create: { capability } } } }); ids.push(org.id);
      const user = await db.user.create({ data: { email: `registry-${suffix}-${run}@example.invalid`, displayName: "Registry fixture", emailVerifiedAt: new Date() } }); users.push(user.id);
      const role = await db.role.create({ data: { organizationId: org.id, code: "registry", name: "Registry read", permissions: { create: { permission: { connect: { code: "organization.view" } } } } } });
      const member = await db.organizationMembership.create({ data: { userId: user.id, organizationId: org.id, status: "ACTIVE", roles: { create: { roleId: role.id } } } });
      const session = await workspaceFixture(db, capability, { userId: user.id, organizationId: org.id, displayName: org.displayName });
      return { org, user, member, session, headers: { authorization: `Bearer ${session.accessToken}` } };
    };
    const operator = await actor("MARKETPLACE_OPERATOR", "800"), supplier = await actor("SUPPLIER", "801");
    const path = "/api/operations/organizations", detailPath = `${path}/${rows[0].id}`;
    for (const endpoint of [path, detailPath]) {
      expect((await request.get(endpoint)).status()).toBe(401);
      expect((await request.get(endpoint, { headers: supplier.headers })).status()).toBe(403);
      expect((await request.get(`${endpoint}?organizationId=${supplier.org.id}`, { headers: operator.headers })).status()).toBe(400);
    }
    expect((await request.get(path, { headers: { ...operator.headers, "x-organization-id": supplier.org.id } })).status()).toBe(401);
    for (const query of ["limit=0", "limit=101", "offset=-1", "offset=1000001", "status=DELETED", "capability=ADMIN", "limit=25&limit=50", "q=%00", "q=%0A", "q=" + "a".repeat(201)]) {
      expect((await request.get(`${path}?${query}`, { headers: operator.headers })).status()).toBe(400);
    }
    const before = await db.organization.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } });
    const getPage = async (query: string) => {
      const response = await request.get(`${path}?${query}`, { headers: operator.headers }); expect(response.status()).toBe(200);
      expect(response.headers()["cache-control"]).toContain("no-store");
      return operatorOrganizationsSchema.parse(await response.json());
    };
    const sorted = rows.map(row => row.id).sort(), collected: string[] = [];
    for (let offset = 0; offset < 151; offset += 25) {
      const page = await getPage(`q=${run}&offset=${offset}`);
      expect(page.total).toBe(151); expect(page.items.map(row => row.id)).toEqual(sorted.slice(offset, offset + 25));
      collected.push(...page.items.map(row => row.id));
    }
    expect(new Set(collected).size).toBe(151);
    for (const status of ["ACTIVE", "INACTIVE", "ARCHIVED"]) {
      const page = await getPage(`q=${run}&status=${status}&capability=IMPORTER`);
      expect(page.total).toBe(rows.filter(row => row.status === status).length);
      expect(page.items.every(row => row.status === status && row.capabilities.includes("IMPORTER"))).toBe(true);
    }
    expect((await getPage(`q=${rows[7].bin}`)).items.map(row => row.id)).toEqual([rows[7].id]);
    expect((await getPage(`q=${run}&capability=SUPPLIER`)).total).toBe(0);
    expect((await getPage(`q=${run}&offset=175`)).items).toEqual([]);
    const detailResponse = await request.get(detailPath, { headers: operator.headers }); expect(detailResponse.status()).toBe(200);
    const detail = operatorOrganizationDetailSchema.parse(await detailResponse.json());
    expect(detail).toMatchObject({ id: rows[0].id, capabilities: ["IMPORTER"], canEdit: false, profile: { contactName: "Registry Official" }, profileCities: { legal: cities[0].nameRu, delivery: cities[1].nameRu } });
    expect(JSON.stringify(detail)).not.toMatch(/commerceDataset|memberships|roles|BUYER|geoEvidence|excluded-address-metadata/);
    expect((await request.get(`${path}/${randomUUID()}`, { headers: operator.headers })).status()).toBe(404);
    expect((await request.get(`${path}/not-a-uuid`, { headers: operator.headers })).status()).toBe(400);
    expect(await db.organization.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } })).toEqual(before);
    const legacy = await request.get("/api/organizations", { headers: operator.headers }); expect(legacy.status()).toBe(200); expect(Array.isArray(await legacy.json())).toBe(true);
    await db.organizationMembership.update({ where: { id: operator.member.id }, data: { status: "BLOCKED" } });
    expect([401, 403]).toContain((await request.get(path, { headers: operator.headers })).status());
    await db.organizationMembership.update({ where: { id: operator.member.id }, data: { status: "ACTIVE" } });
    await db.membershipRole.deleteMany({ where: { membershipId: operator.member.id } });
    for (const endpoint of [path, detailPath]) expect((await request.get(endpoint, { headers: operator.headers })).status()).toBe(403);
    await db.authSession.update({ where: { id: operator.session.sessionId }, data: { status: "REVOKED", revokedAt: new Date() } });
    expect((await request.get(path, { headers: operator.headers })).status()).toBe(401);
  } finally {
    if (verified) {
      await db.authSession.deleteMany({ where: { userId: { in: users } } });
      await db.organizationMembership.deleteMany({ where: { userId: { in: users } } });
      await db.role.deleteMany({ where: { organizationId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.organizationProfile.deleteMany({ where: { organizationId: { in: ids } } });
      await db.address.deleteMany({ where: { organizationId: { in: ids } } });
      await db.organizationCapability.deleteMany({ where: { organizationId: { in: ids } } });
      await db.organization.deleteMany({ where: { id: { in: ids } } });
    }
    await db.$disconnect();
  }
});

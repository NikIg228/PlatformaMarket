import { randomInt, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { operatorTrustSchema, operatorTrustEventsSchema } from "@marketplace/schemas";
import { operatorControlFixture } from "../fixtures/operator-control";

test("operator trust real HTTP: permission isolation, full totals, provenance, invalid input and restoration", async ({ request }) => {
  const f = await operatorControlFixture(), supplierIds = Array.from({ length: 101 }, () => randomUUID()), incidentId = randomUUID();
  try {
    const trustRights = ["trust.incident.view", "trust.incident.manage", "trust.rating.view", "inventory.view"];
    for (const actor of [f.manager, f.outsider]) for (const code of trustRights) await f.db.rolePermission.create({ data: { role: { connect: { id: actor.role.id } }, permission: { connect: { code } } } });
    await f.db.rolePermission.create({ data: { role: { connect: { id: f.reader.role.id } }, permission: { connect: { code: "trust.rating.view" } } } });
    await f.db.organization.createMany({ data: supplierIds.map((id, index) => ({ id, bin: String(randomInt(100_000_000_000, 999_999_999_999)), legalName: `Trust test ${f.run} ${index}`, displayName: `Trust ${index}` })) });
    await f.db.supplierProfile.createMany({ data: supplierIds.map(organizationId => ({ organizationId })) });
    await f.db.productGapIncident.create({ data: { id: incidentId, impactedOrganizationId: supplierIds[0], subjectType: "SupplierOrder", subjectId: f.run, type: "OTHER", reasonCode: "test", explanation: "Проверка данных оператором", remediation: "Исправить источник", restorationCondition: "Источник проверен", idempotencyKey: f.run, createdAt: new Date("2090-01-01T00:00:00Z") } });
    const metric = await f.db.supplierTrustMetricEvent.create({ data: { supplierOrganizationId: supplierIds[0], metricCode: "delivery_ontime", value: "1", sourceEntityType: "SupplierOrder", sourceEntityId: f.run, occurredAt: new Date(), metadata: { token: "PRIVATE_METRIC" } } });
    await f.db.supplierTrustSnapshot.create({ data: { supplierOrganizationId: supplierIds[0], score: "100", status: "CALCULATED", eventCount: 1, indicators: {}, factors: {}, recommendations: {} } });
    const headers = f.manager.headers, overview = "/api/trust/operator", events = `/api/trust/operator/suppliers/${supplierIds[0]}/events`, resolve = `/api/trust/operator/incidents/${incidentId}/resolve`;
    for (const path of [overview, events]) {
      expect((await request.get(path)).status()).toBe(401);
      for (const actor of [f.outsider, f.denied]) expect((await request.get(path, { headers: actor.headers })).status()).toBe(403);
      expect((await request.get(path, { headers: { ...f.outsider.headers, "x-user-id": f.manager.user.id } })).status()).toBe(403);
      expect((await request.get(path, { headers: { ...headers, "x-organization-id": f.outsider.org.id } })).status()).toBe(401);
    }
    const response = await request.get(overview, { headers }); expect(response.status(), await response.text()).toBe(200);
    const first = operatorTrustSchema.parse(await response.json());
    expect(first.automaticFlow).toBe("NOT_VERIFIED"); expect(first.canResolve).toBe(true);
    expect(first.incidents.status).toBe("AVAILABLE"); expect(first.suppliers.status).toBe("AVAILABLE");
    if (first.suppliers.status !== "AVAILABLE") throw Error("Missing supplier source");
    expect(first.suppliers.data.total).toBe(await f.db.supplierProfile.count()); expect(first.suppliers.data.total).toBeGreaterThan(100);
    const found: string[] = [];
    for (let offset = 0; offset < first.suppliers.data.total; offset += 25) {
      const page = operatorTrustSchema.parse(await (await request.get(`${overview}?supplierOffset=${offset}`, { headers })).json());
      if (page.suppliers.status !== "AVAILABLE") throw Error("Missing page");
      found.push(...page.suppliers.data.items.map(row => row.id));
    }
    expect(new Set(found).size).toBe(first.suppliers.data.total); expect(supplierIds.every(id => found.includes(id))).toBe(true);
    const reader = operatorTrustSchema.parse(await (await request.get(overview, { headers: f.reader.headers })).json());
    expect(reader).toMatchObject({ canResolve: false, incidents: { status: "FORBIDDEN", data: null }, suppliers: { status: "AVAILABLE" }, warehouses: { status: "FORBIDDEN", data: null } });
    const unverified = operatorTrustEventsSchema.parse(await (await request.get(events, { headers })).json());
    expect(unverified.items[0]).toMatchObject({ id: metric.id, origin: "UNVERIFIED" }); expect(JSON.stringify(unverified)).not.toContain("PRIVATE_");
    await f.db.auditLog.create({ data: { organizationId: f.manager.org.id, actorId: f.manager.user.id, action: "trust.metric.recorded", entityType: "SupplierTrustMetricEvent", entityId: metric.id } });
    expect(operatorTrustEventsSchema.parse(await (await request.get(events, { headers })).json()).items[0].origin).toBe("MANUAL_RECORDED");
    for (const query of ["incidentOffset=-1", "supplierOffset=oops", "unexpected=true"]) expect((await request.get(`${overview}?${query}`, { headers })).status()).toBe(400);
    expect((await request.get("/api/trust/operator/suppliers/bad/events", { headers })).status()).toBe(400);
    expect((await request.get(`/api/trust/operator/suppliers/${randomUUID()}/events`, { headers })).status()).toBe(404);
    const data = { version: 1, resolution: "Источник проверен оператором" };
    for (const actor of [f.outsider, f.reader, f.denied]) expect((await request.post(resolve, { headers: actor.headers, data })).status()).toBe(403);
    expect((await request.post(resolve, { headers, data: { ...data, resolution: " " } })).status()).toBe(400);
    const replies = await Promise.all([request.post(resolve, { headers, data }), request.post(resolve, { headers, data })]);
    expect(replies.map(reply => reply.status()).sort()).toEqual([201, 409]);
    expect(await f.db.auditLog.count({ where: { entityId: incidentId } })).toBe(1);
    await f.db.organizationMembership.update({ where: { id: f.manager.member.id }, data: { status: "BLOCKED" } });
    expect([401, 403]).toContain((await request.get(overview, { headers })).status());
  } finally {
    await f.db.auditLog.deleteMany({ where: { entityId: incidentId } });
    await f.db.productGapIncident.deleteMany({ where: { id: incidentId } });
    await f.db.supplierTrustSnapshot.deleteMany({ where: { supplierOrganizationId: { in: supplierIds } } });
    await f.db.supplierTrustMetricEvent.deleteMany({ where: { supplierOrganizationId: { in: supplierIds } } });
    await f.db.supplierProfile.deleteMany({ where: { organizationId: { in: supplierIds } } });
    await f.db.organization.deleteMany({ where: { id: { in: supplierIds } } }); await f.dispose();
  }
});

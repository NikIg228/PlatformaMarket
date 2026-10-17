import { expect, test } from "@playwright/test";
import { operatorAuditPageSchema, operatorTechnicalSchema, outboxDeadLetterListResponseSchema } from "@marketplace/schemas";
import { operatorControlFixture } from "../fixtures/operator-control";

test("platform audit and exact dead-letter replay: real auth, redaction, paging, conflict and concurrent idempotency", async ({ request }) => {
  const f = await operatorControlFixture();
  try {
    const headers = f.manager.headers, auditPath = `/api/operations/audit?entityId=${f.run}&dateFrom=2026-10-17&dateTo=2026-10-17`, listPath = `/api/operations/outbox/dead-letter?eventType=${f.eventType}`;
    const readAudit = async (path = auditPath, actor = f.manager) => { const response = await request.get(path, { headers: actor.headers }); expect(response.status(), await response.text()).toBe(200); return operatorAuditPageSchema.parse(await response.json()); };
    for (const path of [auditPath, listPath, "/api/operations/technical"]) {
      expect((await request.get(path)).status()).toBe(401);
      for (const actor of [f.outsider, f.denied]) expect((await request.get(path, { headers: actor.headers })).status()).toBe(403);
      // JWT identity replaces untrusted actor headers; a forbidden actor cannot impersonate the manager.
      expect((await request.get(path, { headers: { ...f.outsider.headers, "x-user-id": f.manager.user.id } })).status()).toBe(403);
      expect((await request.get(path, { headers: { ...headers, "x-organization-id": f.outsider.org.id } })).status()).toBe(401);
    }
    const first = await readAudit(), next = await readAudit(`${auditPath}&offset=25`);
    expect(first.total).toBe(27); expect(first.items).toHaveLength(25); expect(next.items).toHaveLength(2);
    expect(new Set([...first.items, ...next.items].map(row => row.id)).size).toBe(27);
    expect(first.items[0]).toMatchObject({ actor: { id: f.manager.user.id, name: "Сотрудник manager" }, redacted: true, changes: [{ field: "status", before: "AWAITING_CONFIRMATION", after: "CONFIRMED" }, { field: "version", before: "1", after: "2" }], href: `/admin?section=orders&orderId=${f.run}` });
    expect(JSON.stringify(first)).not.toContain("PRIVATE_");
    expect((await readAudit(`${auditPath}&organizationId=${f.manager.org.id}&actorId=${f.manager.user.id}&entityType=SupplierOrder&action=confirmed`)).total).toBe(13);
    expect((await readAudit(`${auditPath}&actorId=${f.reader.user.id}`)).total).toBe(0);
    expect((await readAudit(auditPath, f.reader)).items.every(row => row.href === null)).toBe(true);
    for (const query of ["offset=-1", "actorId=bad", "dateFrom=2026-02-30", "dateFrom=2026-10-18&dateTo=2026-10-17", "unexpected=true"]) expect((await request.get(`/api/operations/audit?${query}`, { headers })).status()).toBe(400);
    const tenant = await request.get(`/api/audit?entityId=${f.run}&pageSize=100`, { headers }); expect(tenant.status()).toBe(200);
    expect((await tenant.json()).items.every((row: { organizationId: string }) => row.organizationId === f.manager.org.id)).toBe(true);
    const technicalResponse = await request.get("/api/operations/technical", { headers }); expect(technicalResponse.status()).toBe(200);
    const technical = operatorTechnicalSchema.parse(await technicalResponse.json());
    expect(technical).toMatchObject({ canReplay: true, outbox: { status: "AVAILABLE" }, search: { status: "AVAILABLE" }, background: { data: { scope: "CURRENT_PROCESS" } } });
    const restrictedTechnical = operatorTechnicalSchema.parse(await (await request.get("/api/operations/technical", { headers: f.reader.headers })).json());
    expect(restrictedTechnical).toMatchObject({ canReplay: false, search: { status: "FORBIDDEN", data: null }, notifications: { status: "FORBIDDEN", data: null } });
    const firstPage = outboxDeadLetterListResponseSchema.parse(await (await request.get(`${listPath}&limit=1`, { headers })).json());
    const secondPage = outboxDeadLetterListResponseSchema.parse(await (await request.get(`${listPath}&limit=1&offset=1`, { headers })).json());
    expect(firstPage.total).toBe(2); expect(firstPage.items[0].id).not.toBe(secondPage.items[0].id); expect(JSON.stringify(firstPage)).not.toContain("PRIVATE_");
    const event = firstPage.items[0], path = `/api/operations/outbox/dead-letter/${event.id}/replay`, before = await f.db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    const data = { idempotencyKey: f.key(), reason: "Обработчик тестового события проверен", expectedAvailableAt: event.availableAt, expectedAttempts: event.attempts };
    expect((await request.post(path, { data })).status()).toBe(401);
    for (const actor of [f.outsider, f.reader, f.denied]) expect((await request.post(path, { headers: actor.headers, data })).status()).toBe(403);
    expect((await request.post(path, { headers, data: { ...data, reason: " " } })).status()).toBe(400);
    expect((await request.post(path, { headers, data: { ...data, expectedAttempts: event.attempts + 1 } })).status()).toBe(409);
    const replies = await Promise.all(Array.from({ length: 4 }, () => request.post(path, { headers, data })));
    const bodies = []; for (const response of replies) { expect(response.status(), await response.text()).toBe(201); bodies.push(await response.json()); }
    for (const body of bodies) expect(body).toEqual(bodies[0]);
    const after = await f.db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } }); expect(after).toMatchObject({ status: "PENDING", attempts: 0, payload: before.payload, aggregateId: before.aggregateId, eventType: before.eventType });
    expect(await f.db.auditLog.count({ where: { entityId: event.id, action: "outbox.dead_letter.replayed" } })).toBe(1);
    expect((await request.post(path, { headers, data: { ...data, reason: "Изменена причина повтора" } })).status()).toBe(409);
    expect((await request.post(path, { headers, data: { ...data, idempotencyKey: f.key() } })).status()).toBe(409);
    const audit = await readAudit(`/api/operations/audit?entityType=OutboxEvent&entityId=${event.id}`); expect(audit.total).toBe(1); expect(JSON.stringify(audit)).not.toContain("PRIVATE_");
    const exact = await request.get(`/api/operations/outbox/dead-letter?eventId=${event.id}`, { headers }); expect((await exact.json()).items).toEqual([]);
    await f.db.organizationMembership.update({ where: { id: f.manager.member.id }, data: { status: "BLOCKED" } });
    expect([401, 403]).toContain((await request.get(auditPath, { headers })).status()); expect([401, 403]).toContain((await request.post(path, { headers, data })).status());
    await f.db.organizationMembership.update({ where: { id: f.manager.member.id }, data: { status: "ACTIVE" } });
    await f.db.rolePermission.deleteMany({ where: { roleId: f.manager.role.id, permission: { code: "operations.outbox.replay" } } });
    expect((await request.post(path, { headers, data })).status()).toBe(403);
    await f.db.authSession.update({ where: { id: f.manager.session.sessionId }, data: { status: "REVOKED", revokedAt: new Date() } });
    expect((await request.get(auditPath, { headers })).status()).toBe(401);
  } finally { await f.dispose(); }
});

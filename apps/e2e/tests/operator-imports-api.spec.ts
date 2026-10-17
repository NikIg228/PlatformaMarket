import { expect, test } from "@playwright/test";
import { operationObjectSchema, resolvedReconciliationSchema } from "@marketplace/schemas";
import { operationQueueFixture } from "../fixtures/operation-queue";

test("operator imports: exact context, role/tenant denials and transactional command replay over HTTP", async ({ request }) => {
  const f = await operationQueueFixture(); let connectionId: string | undefined;
  try {
    const permissions = await f.db.permission.findMany({ where: { code: { in: ["import.manage", "integration.reconcile"] } } });
    expect(permissions).toHaveLength(2);
    await f.db.rolePermission.createMany({ data: [f.manager.role.id, f.outsider.role.id].flatMap(roleId => permissions.map(p => ({ roleId, permissionId: p.id }))) });
    const batch = await f.db.importBatch.update({ where: { id: f.importIds[0] }, data: { status: "COMPLETED_WITH_ERRORS", columnMapping: { secret: "DO_NOT_PROJECT" } } });
    const objectUrl = `/api/operations/work-queue/IMPORT_ATTENTION/${batch.id}`;
    expect((await request.get(objectUrl)).status()).toBe(401);
    for (const actor of [f.denied, f.outsider]) expect((await request.get(objectUrl, { headers: actor.headers })).status()).toBe(403);
    const response = await request.get(objectUrl, { headers: f.manager.headers }); expect(response.status(), await response.text()).toBe(200);
    const object = operationObjectSchema.parse(await response.json());
    expect(object.context).toMatchObject({ supplierOrganizationId: f.supplier.id, status: "COMPLETED_WITH_ERRORS", canRollback: true, canProcess: false });
    expect(object.fields).toContainEqual({ label: "Поставщик", value: f.supplier.displayName });
    expect(JSON.stringify(object)).not.toContain("DO_NOT_PROJECT");
    const reader = operationObjectSchema.parse(await (await request.get(objectUrl, { headers: f.reader.headers })).json());
    expect(reader.context).toMatchObject({ canRollback: false, canProcess: false });
    const root = `/api/suppliers/${f.supplier.id}/import-batches/${batch.id}`, data = { reason: "Откат проверочного файла", expectedUpdatedAt: batch.updatedAt.toISOString() };
    expect((await request.post(`${root}/rollback`, { headers: f.reader.headers, data })).status()).toBe(403);
    expect((await request.post(`${root}/rollback`, { headers: f.outsider.headers, data })).status()).toBe(403);
    expect((await request.post(`${root}/rollback`, { headers: f.manager.headers, data: { ...data, reason: "no" } })).status()).toBe(400);
    expect((await request.post(`${root}/rollback`, { headers: f.manager.headers, data: { ...data, expectedUpdatedAt: "2026-01-01T00:00:00.000Z" } })).status()).toBe(409);
    for (const reply of await Promise.all(Array.from({ length: 3 }, () => request.post(`${root}/rollback`, { headers: f.manager.headers, data })))) {
      expect([200, 201, 409], await reply.text()).toContain(reply.status());
      if (reply.ok()) expect((await reply.json()).status).toBe("ROLLED_BACK");
    }
    const replayedRollback = await request.post(`${root}/rollback`, { headers: f.manager.headers, data });
    expect(replayedRollback.ok(), await replayedRollback.text()).toBe(true); expect((await replayedRollback.json()).status).toBe("ROLLED_BACK");
    expect(await f.db.auditLog.count({ where: { entityId: batch.id, action: "import.batch.rolled_back" } })).toBe(1);
    expect(await f.db.outboxEvent.count({ where: { aggregateId: batch.id, eventType: "ImportBatchRolledBack" } })).toBe(1);
    const after = operationObjectSchema.parse(await (await request.get(objectUrl, { headers: f.manager.headers })).json());
    expect(after.context).toMatchObject({ status: "ROLLED_BACK", canRollback: false, canProcess: false });

    const connection = await f.db.integrationConnection.create({ data: { supplierOrganizationId: f.supplier.id, sourceId: batch.sourceId, provider: "MOCK", mode: "API", displayName: "Проверочная сверка", encryptedCredentials: "DO_NOT_PROJECT" } }); connectionId = connection.id;
    const entry = await f.db.integrationReconciliationEntry.create({ data: { connectionId, kind: "INVENTORY", status: "MISMATCH", externalRef: "SKU-1234", actual: { token: "DO_NOT_PROJECT" }, expected: { secret: "DO_NOT_PROJECT" } } });
    const entryUrl = `/api/operations/work-queue/INTEGRATION_RECONCILIATION/${entry.id}`;
    const entryResponse = await request.get(entryUrl, { headers: f.manager.headers }); expect(entryResponse.status(), await entryResponse.text()).toBe(200);
    const view = operationObjectSchema.parse(await entryResponse.json());
    expect(view.context).toMatchObject({ supplierOrganizationId: f.supplier.id, connectionId, canResolve: true });
    expect(view.fields).toContainEqual({ label: "Внешняя ссылка", value: "SKU-1234" });
    expect(JSON.stringify(view)).not.toContain("DO_NOT_PROJECT");
    const resolveUrl = `/api/suppliers/${f.supplier.id}/integrations/${connectionId}/reconciliation/${entry.id}/resolve`;
    const resolution = { resolution: "Проверено по документам", expectedUpdatedAt: entry.updatedAt.toISOString() };
    expect((await request.post(resolveUrl, { headers: f.reader.headers, data: resolution })).status()).toBe(403);
    expect((await request.post(resolveUrl, { headers: f.outsider.headers, data: resolution })).status()).toBe(403);
    expect((await request.post(resolveUrl, { headers: f.manager.headers, data: { ...resolution, expectedUpdatedAt: "2026-01-01T00:00:00.000Z" } })).status()).toBe(409);
    for (const reply of await Promise.all(Array.from({ length: 3 }, () => request.post(resolveUrl, { headers: f.manager.headers, data: resolution })))) {
      expect(reply.ok(), await reply.text()).toBe(true);
      const body = await reply.json(); expect(resolvedReconciliationSchema.parse(body)).toEqual(body); expect(JSON.stringify(body)).not.toContain("DO_NOT_PROJECT");
    }
    expect(await f.db.auditLog.count({ where: { entityId: entry.id, action: "integration.reconciliation.resolved" } })).toBe(1);
    expect((await request.post(resolveUrl, { headers: f.manager.headers, data: { ...resolution, resolution: "Другое решение" } })).status()).toBe(409);
    expect((operationObjectSchema.parse(await (await request.get(entryUrl, { headers: f.manager.headers })).json())).context).toMatchObject({ status: "RESOLVED", canResolve: false, resolution: resolution.resolution });
  } finally {
    if (connectionId) await f.db.integrationConnection.deleteMany({ where: { id: connectionId } });
    await f.db.outboxEvent.deleteMany({ where: { aggregateId: { in: f.importIds } } });
    await f.dispose();
  }
});

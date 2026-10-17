import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { operatorDocumentExceptionSchema, operatorExceptionReviewResultSchema, operationWorkQueueSchema, orderDiscrepanciesResponseSchema } from "@marketplace/schemas";
import { operatorDocumentExceptionsFixture } from "../fixtures/operator-document-exceptions";

test("document exception: public recommendation, party visibility, queue reopening, roles and concurrent replay", async ({ request }) => {
  const f = await operatorDocumentExceptionsFixture();
  try {
    const headers = f.operator.headers, path = `/api/operations/document-exceptions/${f.claim.id}`, publish = `${path}/recommendation`;
    const partyPath = `/api/supplier-orders/${f.orderId}/discrepancies`;
    const queue = async () => {
      const response = await request.get(`/api/operations/work-queue?kind=DOCUMENT_EXCEPTION&q=${f.prefix}`, { headers });
      expect(response.status(), await response.text()).toBe(200); return operationWorkQueueSchema.parse(await response.json());
    };
    const read = async () => { const response = await request.get(path, { headers }); expect(response.status(), await response.text()).toBe(200); return operatorDocumentExceptionSchema.parse(await response.json()); };
    const before = { order: await f.db.supplierOrder.findUniqueOrThrow({ where: { id: f.orderId } }), shipment: await f.db.shipment.findUniqueOrThrow({ where: { id: f.shipment.id } }),
      item: await f.db.shipmentItem.findUniqueOrThrow({ where: { id: f.shipment.items[0].id } }), document: await f.db.document.findUniqueOrThrow({ where: { id: f.document.id } }),
      balances: await f.db.inventoryBalance.findMany({ where: { offerId: f.offer.id }, orderBy: { id: "asc" } }) };
    const view = await read();
    expect(view).toMatchObject({ id: f.claim.id, status: "SUBMITTED", reviewStatus: "PENDING", canPublish: true, lines: [{ sentQuantity: "10", reportedQuantity: "8", receivedQuantity: "8" }], tickets: [{ id: f.ticket.id }] });
    expect(JSON.stringify(view)).not.toContain("PRIVATE_DRAFT_MUST_NOT_LEAK");
    expect((await queue()).items.map(item => item.id)).toEqual([f.claim.id]);
    const data = { expectedOrderVersion: view.order.version, expectedShipmentVersion: view.shipment.version, expectedExceptionVersion: view.version,
      idempotencyKey: randomUUID(), reason: "Проверено заявление о недостаче двух единиц", nextStep: "Поставщику ответить по предложенному довозу" };
    expect((await request.get(path)).status()).toBe(401); expect((await request.post(publish, { data })).status()).toBe(401);
    for (const actor of [f.buyer, f.restricted, f.supplierActor]) {
      expect((await request.get(path, { headers: actor.headers })).status()).toBe(403);
      expect((await request.post(publish, { headers: actor.headers, data })).status()).toBe(403);
    }
    for (const target of [f.draft.id, randomUUID()]) {
      expect((await request.get(`/api/operations/document-exceptions/${target}`, { headers })).status()).toBe(404);
      expect((await request.post(`/api/operations/document-exceptions/${target}/recommendation`, { headers, data })).status()).toBe(404);
    }
    expect((await request.get("/api/operations/document-exceptions/invalid", { headers })).status()).toBe(400);
    for (const invalid of [{ ...data, reason: " " }, { ...data, nextStep: "" }, { ...data, status: "RESOLVED" }, { ...data, expectedExceptionVersion: 0 }]) expect((await request.post(publish, { headers, data: invalid })).status()).toBe(400);
    for (const field of ["expectedOrderVersion", "expectedShipmentVersion", "expectedExceptionVersion"] as const) expect((await request.post(publish, { headers, data: { ...data, [field]: data[field] + 1 } })).status()).toBe(409);

    const assignment = await request.post(`/api/operations/work-queue/DOCUMENT_EXCEPTION/${f.claim.id}/assignment`, { headers, data: {
      expectedVersion: 0, priority: "HIGH", assigneeId: f.operator.user.id, dueAt: null, reason: "Проверить документальное расхождение", idempotencyKey: randomUUID(),
    } });
    expect(assignment.status(), await assignment.text()).toBe(201);
    const assignmentId = (await assignment.json()).id;
    await expect(f.db.operationAssignment.update({ where: { id: assignmentId }, data: { queueType: "INVALID_DOMAIN" } })).rejects.toThrow();
    expect((await queue()).items[0].assignment?.id).toBe(assignmentId);

    const replies = await Promise.all(Array.from({ length: 4 }, () => request.post(publish, { headers, data })));
    const results = [];
    for (const response of replies) { expect(response.status(), await response.text()).toBe(201); results.push(operatorExceptionReviewResultSchema.parse(await response.json())); }
    expect(new Set(results.map(result => result.eventId)).size).toBe(1);
    expect(await f.db.auditLog.count({ where: { entityId: f.claim.id, action: "operation.document_exception.reviewed" } })).toBe(1);
    expect(await f.db.outboxEvent.count({ where: { aggregateId: f.orderId, eventType: "OrderDiscrepancyChanged" } })).toBe(1);
    expect((await queue()).items).toEqual([]);
    expect(await read()).toMatchObject({ status: "SUBMITTED", reviewStatus: "REVIEWED", canPublish: false, events: [{ action: "OPERATOR_REVIEW", reason: data.reason, nextStep: data.nextStep }] });
    for (const actor of [f.buyer, f.supplierActor]) {
      const response = await request.get(partyPath, { headers: actor.headers }); expect(response.status(), await response.text()).toBe(200);
      const claim = orderDiscrepanciesResponseSchema.parse(await response.json()).discrepancies.find(row => row.id === f.claim.id)!;
      expect(claim.status).toBe("SUBMITTED"); expect(claim.events).toContainEqual(expect.objectContaining({ action: "OPERATOR_REVIEW", details: expect.objectContaining({ reason: data.reason, nextStep: data.nextStep }) }));
    }
    expect((await request.get(partyPath, { headers })).status()).toBe(404);
    expect((await request.post(publish, { headers, data: { ...data, nextStep: "Подменённый результат" } })).status()).toBe(409);
    expect((await request.post(publish, { headers, data: { ...data, expectedExceptionVersion: results[0].version, idempotencyKey: randomUUID() } })).status()).toBe(409);
    expect(await f.db.supplierOrder.findUniqueOrThrow({ where: { id: f.orderId } })).toEqual(before.order);
    expect(await f.db.shipment.findUniqueOrThrow({ where: { id: f.shipment.id } })).toEqual(before.shipment);
    expect(await f.db.shipmentItem.findUniqueOrThrow({ where: { id: f.shipment.items[0].id } })).toEqual(before.item);
    expect(await f.db.document.findUniqueOrThrow({ where: { id: f.document.id } })).toEqual(before.document);
    expect(await f.db.inventoryBalance.findMany({ where: { offerId: f.offer.id }, orderBy: { id: "asc" } })).toEqual(before.balances);

    const answer = await request.post(partyPath, { headers: f.supplierActor.headers, data: { action: "RESPOND", discrepancyId: f.claim.id,
      expectedOrderVersion: data.expectedOrderVersion, expectedShipmentVersion: data.expectedShipmentVersion, expectedExceptionVersion: results[0].version,
      idempotencyKey: randomUUID(), decision: "COUNTER", resolution: "REDUCTION", reason: "Предлагаем согласованное уменьшение вместо довоза" } });
    expect(answer.status(), await answer.text()).toBe(201);
    const reopened = await read(); expect(reopened).toMatchObject({ status: "RESOLUTION_PROPOSED", reviewStatus: "PENDING", canPublish: true });
    expect((await queue()).items.map(item => item.id)).toEqual([f.claim.id]); expect((await queue()).items[0].assignment?.id).toBe(assignmentId);
    const raced = await Promise.all(Array.from({ length: 3 }, () => request.post(publish, { headers, data: { ...data, expectedExceptionVersion: reopened.version, idempotencyKey: randomUUID() } })));
    expect(raced.map(response => response.status()).sort()).toEqual([201, 409, 409]);
    expect(await f.db.auditLog.count({ where: { entityId: f.claim.id, action: "operation.document_exception.reviewed" } })).toBe(2);
    expect((await queue()).items).toEqual([]);

    await f.db.rolePermission.deleteMany({ where: { roleId: f.operator.role.id, permission: { code: { in: ["document.view", "support.ticket.view", "support.ticket.manage"] } } } });
    expect(await read()).toMatchObject({ canPublish: false, canViewDocuments: false, sourceDocument: null, canViewSupport: false, tickets: [] });
    expect((await request.post(publish, { headers, data })).status()).toBe(403);
  } finally { await f.dispose(); }
});

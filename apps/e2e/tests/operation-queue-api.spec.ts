import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { operationWorkQueueSchema, operationAssignmentResultSchema } from "@marketplace/schemas";
import { operationQueueFixture } from "../fixtures/operation-queue";

test("global queue: real paging/filtering and isolated idempotent assignments with domain invariants", async ({ request }) => {
  const f = await operationQueueFixture(), root = "/api/operations/work-queue", headers = f.manager.headers;
  try {
    expect((await request.get(root)).status()).toBe(401);
    for (const actor of [f.denied, f.outsider]) expect((await request.get(root, { headers: actor.headers })).status()).toBe(403);
    expect((await request.get(root, { headers: { ...headers, "x-organization-id": f.other.org.id } })).status()).toBe(401);
    for (const query of ["offset=-1", "limit=101", "offset=0&offset=50", "kind=UNRECOGNIZED", "priority=URGENT", "q=%00", `organizationId=${f.other.org.id}`]) expect((await request.get(`${root}?${query}`, { headers })).status()).toBe(400);
    const get = async (filters: Record<string, string> = {}, actorHeaders = headers) => {
      const response = await request.get(`${root}?${new URLSearchParams({ q: f.prefix, ...filters })}`, { headers: actorHeaders });
      expect(response.status(), await response.text()).toBe(200); expect(response.headers()["cache-control"]).toBe("no-store");
      return operationWorkQueueSchema.parse(await response.json());
    };
    const first = await get(), second = await get({ offset: "50" }), third = await get({ offset: "100" });
    expect(first.total).toBe(120); expect(first.totalOpenItems).toBeGreaterThanOrEqual(120);
    expect(first.items).toHaveLength(50); expect(second.items).toHaveLength(50); expect(third.items).toHaveLength(20);
    const all = [...first.items, ...second.items, ...third.items];
    expect(new Set(all.map(item => item.caseKey)).size).toBe(120);
    expect(all.slice(0, 60).map(item => item.queueType)).toEqual(Array(60).fill("CATALOG_REVIEW"));
    expect(all.slice(0, 60).map(item => item.id)).toEqual([...f.candidateIds].sort());
    expect((await get({ offset: "50" })).items).toEqual(second.items);
    const late = await get({ offset: "150" }); expect(late).toMatchObject({ total: 120, hasMore: false, items: [] });
    expect(await get({ kind: "IMPORT_ATTENTION", offset: "50" })).toMatchObject({ total: 60, items: expect.any(Array) });
    expect((await get({ kind: "IMPORT_ATTENTION", offset: "50" })).items).toHaveLength(10);
    expect((await get({ q: `SKU-${f.key}-57` })).items.map(item => item.id)).toEqual([f.candidateIds[57]]);
    expect((await get({ q: f.supplier.bin })).total).toBe(120);
    expect((await get({ q: "100%_literal" })).items.map(item => item.id)).toEqual([f.importIds[59]]);
    expect((await get({ assignment: "MINE" })).total).toBe(0);
    expect((await get({ due: "UNSCHEDULED" })).total).toBe(120);

    const id = f.candidateIds[0], endpoint = `${root}/CATALOG_REVIEW/${id}/assignment`;
    const before = await f.db.productCandidate.findMany({ where: { id: { in: f.candidateIds } }, orderBy: { id: "asc" } });
    const input = { expectedVersion: 0, priority: "CRITICAL", assigneeId: f.manager.user.id, dueAt: new Date(Date.now() - 3600000).toISOString(), reason: "Проверить карточку в рамках очереди", idempotencyKey: randomUUID() };
    expect((await request.post(endpoint, { headers: f.reader.headers, data: input })).status()).toBe(403);
    expect((await request.post(endpoint, { headers, data: { ...input, assigneeId: f.other.user.id } })).status()).toBe(409);
    const responses = await Promise.all([request.post(endpoint, { headers, data: input }), request.post(endpoint, { headers, data: input })]);
    for (const response of responses) expect(response.status(), await response.text()).toBe(201);
    const saved = operationAssignmentResultSchema.parse(await responses[0].json());
    expect(await responses[1].json()).toEqual(saved); expect(saved.version).toBe(1);
    expect(await f.db.auditLog.count({ where: { entityType: "OperationAssignment", entityId: saved.id } })).toBe(1);
    expect((await request.post(endpoint, { headers, data: { ...input, reason: "Другой текст той же команды" } })).status()).toBe(409);
    expect((await request.post(endpoint, { headers, data: { ...input, idempotencyKey: randomUUID() } })).status()).toBe(409);
    const mine = await get({ assignment: "MINE", due: "OVERDUE", priority: "CRITICAL" });
    expect(mine.total).toBe(1); expect(mine.items[0]).toMatchObject({ id, isOverdue: true, assignment: { version: 1 } });
    expect((await get()).items[0].id).toBe(id);
    expect((await get({ assignment: "MINE" }, f.reader.headers)).total).toBe(0);
    const foreign = await get({}, f.other.headers);
    expect(foreign.items.find(item => item.id === id)?.assignment ?? null).toBeNull();
    expect((await get({ due: "OVERDUE" }, f.other.headers)).total).toBe(0);
    expect(await (await request.get(`${root}/CATALOG_REVIEW/${id}/history`, { headers: f.other.headers })).json()).toEqual([]);
    const competing = await Promise.all(["HIGH", "LOW"].map(priority => request.post(endpoint, { headers, data: { ...input, expectedVersion: 1, priority, idempotencyKey: randomUUID() } })));
    expect(competing.map(response => response.status()).sort()).toEqual([201, 409]);
    const history = await request.get(`${root}/CATALOG_REVIEW/${id}/history`, { headers });
    expect(history.status()).toBe(200); expect(await history.json()).toHaveLength(2);
    expect(await f.db.productCandidate.findMany({ where: { id: { in: f.candidateIds } }, orderBy: { id: "asc" } })).toEqual(before);
    // A failed compare-and-swap must roll back its command record as well as audit.
    expect(await f.db.idempotencyRecord.count({ where: { scope: `operation.assign:${f.manager.org.id}:${f.manager.user.id}` } })).toBe(2);

    const sortedIds = f.candidateIds.slice(1, 4), sortedQuery = `${f.prefix} ordering`;
    for (const [index, candidateId] of sortedIds.entries()) {
      await f.db.productCandidate.update({ where: { id: candidateId }, data: {
        proposedName: sortedQuery, createdAt: new Date(`${2025 - index}-01-01T00:00:00Z`), updatedAt: new Date(`${2030 + index}-01-01T00:00:00Z`),
      } });
      const dueAt = index === 0 ? new Date(Date.now() - 7200000).toISOString() : index === 1 ? new Date(Date.now() + 86400000).toISOString() : null;
      expect((await request.post(`${root}/CATALOG_REVIEW/${candidateId}/assignment`, { headers, data: { ...input, priority: "HIGH", dueAt, idempotencyKey: randomUUID() } })).status()).toBe(201);
    }
    expect((await get({ q: sortedQuery })).items.map(item => item.id)).toEqual(sortedIds);
    expect((await get({ q: sortedQuery, sort: "oldest" })).items.map(item => item.id)).toEqual([...sortedIds].reverse());
    expect((await get({ q: sortedQuery, sort: "recent" })).items.map(item => item.id)).toEqual([...sortedIds].reverse());
    expect((await get({ q: sortedQuery, due: "SCHEDULED" })).total).toBe(2);
    expect((await get({ q: sortedQuery, due: "UNSCHEDULED" })).items.map(item => item.id)).toEqual([sortedIds[2]]);
    await f.db.productCandidate.update({ where: { id }, data: { status: "REJECTED", rejectionReason: "Synthetic closed source" } });
    expect((await get()).total).toBe(119); expect((await get({ q: id })).items).toEqual([]);
    expect(await (await request.get(`${root}/CATALOG_REVIEW/${id}/history`, { headers })).json()).toHaveLength(2);
  } finally { await f.dispose(); }
});

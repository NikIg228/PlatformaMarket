import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { operatorOrdersSchema, operatorOrderDetailSchema } from "@marketplace/schemas";
import { operatorOrdersFixture } from "../fixtures/operator-orders";

test("operator order registry: real paging, permissions, order links, exact money and denied party writes", async ({ request }) => {
  const f = await operatorOrdersFixture();
  try {
    const path = "/api/operations/orders", headers = f.operator.headers, detailPath = `${path}/${f.orderId}`;
    for (const endpoint of [path, detailPath]) {
      expect((await request.get(endpoint)).status()).toBe(401);
      expect((await request.get(endpoint, { headers: f.buyer.headers })).status()).toBe(403);
      expect((await request.get(endpoint, { headers: f.restricted.headers })).status()).toBe(403);
      expect((await request.get(`${endpoint}?organizationId=${f.buyer.org.id}`, { headers })).status()).toBe(400);
    }
    expect((await request.get(path, { headers: { ...headers, "x-organization-id": f.buyer.org.id } })).status()).toBe(401);
    for (const query of ["limit=101", "limit=25&limit=50", "offset=-1", "status=NOPE", "q=%00", "dateFrom=2026-02-30", "dateFrom=2026-10-17&dateTo=2026-10-16"]) expect((await request.get(`${path}?${query}`, { headers })).status()).toBe(400);
    const getPage = async (query: string) => { const response = await request.get(`${path}?q=${f.prefix}&${query}`, { headers }); expect(response.status(), await response.text()).toBe(200); expect(response.headers()["cache-control"]).toBe("no-store"); return operatorOrdersSchema.parse(await response.json()); };
    const first = await getPage("offset=0"), last = await getPage("offset=25");
    expect(first.total).toBe(31); expect(last.items).toHaveLength(6); expect(new Set([...first.items, ...last.items].map(item => item.id)).size).toBe(31);
    expect((await getPage("offset=25")).items.map(item => item.id)).toEqual(last.items.map(item => item.id));
    const found = await request.get(`${path}?q=${f.prefix}-30&buyer=${f.buyer.org.bin}&supplier=${f.supplier.bin}&status=PARTIALLY_FULFILLED&paymentStatus=PAID&dateFrom=2026-10-16&dateTo=2026-10-16`, { headers });
    expect(found.status()).toBe(200); expect(operatorOrdersSchema.parse(await found.json())).toMatchObject({ total: 1, items: [{ id: f.orderId, subtotalAmountMinor: "9007199254740993" }] });
    const before = await f.db.supplierOrder.findUniqueOrThrow({ where: { id: f.orderId } });
    const detailResponse = await request.get(detailPath, { headers }); expect(detailResponse.status(), await detailResponse.text()).toBe(200);
    const detail = operatorOrderDetailSchema.parse(await detailResponse.json());
    expect(detail).toMatchObject({ canWrite: false, canViewDocuments: true, canViewSupport: true, workflow: { order: { id: f.orderId, subtotalAmountMinor: "9007199254740993", items: [{ id: f.line.id }], shipments: [{ id: f.shipment.id, items: [{ deliveredQuantity: "8" }] }] } }, tickets: [{ id: f.ticket.id }] });
    expect(detail.discrepancies).toHaveLength(1); expect(JSON.stringify(detail)).not.toContain("PRIVATE_DRAFT_MUST_NOT_LEAK");
    const other = await request.get(`${path}/${f.orderIds[0]}`, { headers }); expect((await other.json()).tickets).toEqual([]); expect((await other.json()).discrepancies).toEqual([]);
    expect((await request.get(`${path}/${randomUUID()}`, { headers })).status()).toBe(404);
    const docs = await request.get(`/api/documents/archive?supplierOrderId=${f.orderId}`, { headers }); expect(docs.status()).toBe(200); expect((await docs.json()).items.map((item: { id: string }) => item.id)).toEqual([f.document.id]);
    for (const action of [{ action: "CONFIRM_TRANSFER", claimId: randomUUID() }, { action: "RECEIVE_SHIPMENT", shipmentId: f.shipment.id, items: [{ shipmentItemId: f.shipment.items[0].id, deliveredQuantity: "10" }] }]) {
      const response = await request.post(`/api/supplier-orders/${f.orderId}/workflow`, { headers, data: { ...action, expectedVersion: before.version, idempotencyKey: randomUUID() } });
      expect([403, 404]).toContain(response.status());
    }
    expect(await f.db.supplierOrder.findUniqueOrThrow({ where: { id: f.orderId } })).toEqual(before);
    expect((await f.db.shipmentItem.findUniqueOrThrow({ where: { id: f.shipment.items[0].id } })).deliveredQuantity.toString()).toBe("8");
    await f.db.rolePermission.deleteMany({ where: { roleId: f.operator.role.id, permission: { code: { in: ["document.view", "support.ticket.view"] } } } });
    const restricted = await request.get(detailPath, { headers }); expect(restricted.status()).toBe(200); expect(await restricted.json()).toMatchObject({ canViewDocuments: false, canViewSupport: false, tickets: [] });
  } finally { await f.dispose(); }
});

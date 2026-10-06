import { describe, expect, it, vi } from "vitest";
import { notificationInboxQuerySchema, notificationReadAllSchema } from "@marketplace/schemas";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import { inboxPresentation, NotificationInboxReader } from "./notification-inbox";
const id = "11111111-1111-4111-8111-111111111111";
const base = { id, eventType: "OrderReservationExpired", aggregateType: "SupplierOrder", aggregateId: id, payload: {}, createdAt: new Date("2026-01-01"), readAt: null, recipientUserId: null };
const context = { actorId: "actor", organizationId: "org" };
function fixture() {
  const db = { notification: { findMany: vi.fn().mockResolvedValue([base]), count: vi.fn().mockResolvedValue(1), updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, supplierOrder: { findMany: vi.fn().mockResolvedValue([{ id, orderNumber: "SO-1", supplierOrganizationId: "org", buyer: { displayName: "Клиника" }, supplier: { displayName: "Поставщик" } }]) } };
  return { db, reader: new NotificationInboxReader(db as unknown as PrismaService) };
}
describe("business notification inbox", () => {
  it("parses false explicitly and rejects invalid filters/limits", () => {
    expect(notificationInboxQuerySchema.parse({ unreadOnly: "false" }).unreadOnly).toBe(false);
    for (const query of [{ unreadOnly: "0" }, { category: "secret" }, { limit: 51 }]) expect(notificationInboxQuerySchema.safeParse(query).success).toBe(false);
    expect(notificationReadAllSchema.safeParse({ before: "bad" }).success).toBe(false);
  });
  it("filters business events before paging, scopes count and enriches only participant orders", async () => {
    const { db, reader } = fixture();
    const data = await reader.read(context, notificationInboxQuerySchema.parse({ category: "orders", unreadOnly: "true" }));
    const where = db.notification.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ recipientOrganizationId: "org", channel: "IN_APP", readAt: null, OR: [{ recipientUserId: null }, { recipientUserId: "actor" }] });
    expect(where.eventType.in).not.toContain("InventoryReservationReleased");
    expect(where.eventType.in).not.toContain("CompliancePassed");
    expect(where.AND[1].OR).toContainEqual({ eventType: "OrderWorkflowChanged", payload: { path: ["action"], equals: "CANCEL" } });
    expect(db.notification.count.mock.calls[0][0].where).toMatchObject({ recipientOrganizationId: "org", readAt: null });
    expect(db.supplierOrder.findMany.mock.calls[0][0].where.OR).toEqual([{ supplierOrganizationId: "org" }, { buyerOrganizationId: "org" }]);
    expect(data.items[0]).toMatchObject({ context: "SO-1 · Клиника", readScope: "organization", title: "Срок резерва заказа истёк" });
  });
  it("removes target when an order no longer belongs to participant", async () => {
    const { db, reader } = fixture(); db.supplierOrder.findMany.mockResolvedValue([]);
    expect((await reader.read(context, notificationInboxQuerySchema.parse({}))).items[0].target).toBeNull();
  });
  it("bounds bulk read by snapshot and actor, remains idempotent and rejects future time", async () => {
    const { db, reader } = fixture();
    const before = "2026-01-02T00:00:00.000Z";
    await reader.readAll(context, before); await reader.readAll(context, before);
    expect(db.notification.updateMany.mock.calls[0][0].where).toMatchObject({ recipientOrganizationId: "org", readAt: null, createdAt: { lte: new Date(before) }, OR: [{ recipientUserId: null }, { recipientUserId: "actor" }] });
    await expect(reader.readAll(context, new Date(Date.now() + 60_000).toISOString())).rejects.toThrow("будущие");
    expect(db.notification.updateMany).toHaveBeenCalledTimes(2);
  });
  it("does not equate a reported transfer or sent refund with received money", () => {
    expect(inboxPresentation({ ...base, eventType: "OrderWorkflowChanged", payload: { action: "REPORT_TRANSFER" } }).description).toContain("требует проверки");
    expect(inboxPresentation({ ...base, eventType: "OrderWorkflowChanged", payload: { action: "SEND_MANUAL_REFUND" } }).description).toContain("требует подтверждения");
  });
  it("links shipment to the order, not a made-up shipment route", () => {
    expect(inboxPresentation({ ...base, aggregateType: "Shipment", eventType: "ShipmentStatusChanged", payload: { supplierOrderId: id } }).target).toMatchObject({ type: "order", id });
  });
  it("categorizes cancellation and receipt by business action", () => {
    expect(inboxPresentation({ ...base, eventType: "OrderWorkflowChanged", payload: { action: "CANCEL" } }).category).toBe("orders");
    expect(inboxPresentation({ ...base, eventType: "OrderWorkflowChanged", payload: { action: "RECEIVE_SHIPMENT" } }).category).toBe("delivery");
  });
});

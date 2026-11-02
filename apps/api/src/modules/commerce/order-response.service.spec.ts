import { describe, expect, it, vi } from "vitest";
import { defaultSupplierCalendar } from "@marketplace/schemas";
import { OrderResponseService } from "./order-response.service";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import type { BackgroundQueueService } from "../../platform/jobs/background-queue.service";

function fixture(overrides: Record<string, unknown> = {}) {
  const order: any = { id: "order", orderNumber: "ORDER-1", supplierOrganizationId: "supplier", buyerOrganizationId: "buyer",
    status: "AWAITING_CONFIRMATION", responseStartedAt: new Date("2026-11-03T04:00:00Z"), responseDeadlineAt: new Date("2026-11-03T05:00:00Z"),
    responseCalendar: { source: "DEFAULT", version: 0, calendar: defaultSupplierCalendar() }, responseReceivedAt: null,
    responseRemindedAt: null, responseOverdueAt: null, responseEscalatedAt: null,
    checkout: { status: "COMPLETED", cart: { createdById: "requester" } }, ...overrides };
  const db: any = { $queryRaw: vi.fn().mockResolvedValue([]),
    supplierOrder: { findUnique: vi.fn(async () => order), findMany: vi.fn(async () => [{ id: order.id }]),
      update: vi.fn(async ({ data }: any) => Object.assign(order, data)) },
    notification: { upsert: vi.fn().mockResolvedValue({}) }, auditLog: { create: vi.fn().mockResolvedValue({}) },
    supportTicket: { create: vi.fn().mockResolvedValue({ id: "ticket" }) }, supportLink: { create: vi.fn().mockResolvedValue({}) },
    organizationCapability: { findMany: vi.fn().mockResolvedValue([{ organizationId: "operator" }]) },
    outboxEvent: { create: vi.fn().mockResolvedValue({}) } };
  db.$transaction = vi.fn((work: (tx: any) => unknown) => work(db));
  const queue: any = { register: vi.fn(), enqueue: vi.fn().mockResolvedValue(false) };
  return { order, db, queue, service: new OrderResponseService(db as PrismaService, queue as BackgroundQueueService) };
}
const at = (minutes: number) => new Date(Date.parse("2026-11-03T04:00:00Z") + minutes * 60_000);

describe("order response scheduler", () => {
  it("emits precisely one reminder, overdue event for both sides and one operator case across replay/restart", async () => {
    const f = fixture();
    await f.service.processOrder("order", at(44.999));
    expect(f.db.notification.upsert).not.toHaveBeenCalled();
    await f.service.processOrder("order", at(45));
    expect(f.db.notification.upsert).toHaveBeenCalledTimes(1);
    expect(f.db.notification.upsert.mock.calls[0][0].create).toMatchObject({ recipientOrganizationId: "supplier", eventType: "SupplierResponseReminder" });
    await f.service.processOrder("order", at(59.999));
    expect(f.db.notification.upsert).toHaveBeenCalledTimes(1);
    const restarted = new OrderResponseService(f.db, f.queue);
    await restarted.processOrder("order", at(60));
    expect(f.db.notification.upsert).toHaveBeenCalledTimes(3);
    await restarted.processOrder("order", at(119.999));
    expect(f.db.supportTicket.create).not.toHaveBeenCalled();
    await restarted.processOrder("order", at(120));
    await restarted.processOrder("order", at(180));
    expect(f.db.notification.upsert).toHaveBeenCalledTimes(5);
    expect(f.db.supportTicket.create).toHaveBeenCalledTimes(1);
    expect(f.db.outboxEvent.create.mock.calls[0][0].data.payload).toMatchObject({ support0OrganizationId: "operator", buyerOrganizationId: "buyer" });
    expect(f.order.responseDeadlineAt).toEqual(at(60));
    expect(f.db.supplierOrder.update.mock.calls.every(([args]: any[]) => !("version" in args.data))).toBe(true);
  });
  it.each(["CONFIRMED", "PARTIALLY_CONFIRMED", "REJECTED", "CANCELLED"])("does not remind a %s order", async status => {
    const f = fixture({ status }); await f.service.processOrder("order", at(180));
    expect(f.db.notification.upsert).not.toHaveBeenCalled();
  });
  it.each([{ responseStartedAt: null }, { responseReceivedAt: at(20) }, { checkout: { status: "FAILED" } }, { checkout: { status: "PROCESSING" } }])("ignores legacy, answered or unavailable orders: %j", async overrides => {
    const f = fixture(overrides); await f.service.processOrder("order", at(180));
    expect(f.db.notification.upsert).not.toHaveBeenCalled();
  });
  it("keeps using the order calendar across break, night and a closed date", async () => {
    const calendar = defaultSupplierCalendar();
    calendar.week = calendar.week.map(day => ({ ...day, intervals: day.day <= 5 ? [{ fromMinute: 540, toMinute: 720 }, { fromMinute: 780, toMinute: 1080 }] : [] }));
    calendar.exceptions = [{ date: "2026-11-04", intervals: [] }];
    const f = fixture({ responseStartedAt: new Date("2026-11-03T12:30:00Z"), responseDeadlineAt: new Date("2026-11-05T04:30:00Z"),
      responseCalendar: { source: "SUPPLIER", version: 1, calendar } });
    await f.service.processOrder("order", new Date("2026-11-05T04:14:59Z"));
    expect(f.db.notification.upsert).not.toHaveBeenCalled();
    await f.service.processOrder("order", new Date("2026-11-05T04:15:00Z"));
    expect(f.db.notification.upsert).toHaveBeenCalledTimes(1);
  });
  it("rejects invalid evaluation time and malformed persisted calendars without effects", async () => {
    const f = fixture({ responseCalendar: {} });
    await expect(f.service.processOrder("order", new Date(NaN))).rejects.toThrow();
    await expect(f.service.processOrder("order", at(180))).rejects.toThrow();
    expect(f.db.notification.upsert).not.toHaveBeenCalled();
  });
  it("uses the existing queue and only falls back inline when it is disabled", async () => {
    const f = fixture(); const tick = vi.spyOn(f.service, "tick").mockResolvedValue(undefined);
    f.service.onModuleInit(); expect(f.queue.register).toHaveBeenCalledWith("orders.response", expect.any(Function));
    f.queue.enqueue.mockResolvedValueOnce(true); await f.service.scheduledTick(); expect(tick).not.toHaveBeenCalled();
    await f.service.scheduledTick(); expect(tick).toHaveBeenCalledTimes(1);
  });
  it("rotates the scan and retries a broken candidate later instead of starving other orders", async () => {
    const f = fixture(); f.db.supplierOrder.findMany.mockResolvedValueOnce([{ id: "a" }, { id: "b" }]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "a" }]);
    const process = vi.spyOn(f.service, "processOrder").mockRejectedValueOnce(new Error("failure")).mockResolvedValue(undefined);
    await f.service.tick(at(180)); await f.service.tick(at(180));
    expect(process.mock.calls.map(call => call[0])).toEqual(["a", "b", "a"]);
  });
});

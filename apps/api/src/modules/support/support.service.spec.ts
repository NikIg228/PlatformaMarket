import { describe, expect, it, vi } from "vitest";
import { SupportService } from "./support.service";

const context = { actorId: "customer", organizationId: "customer-org" };
function fixture(operator = false, status = "OPEN") {
  const ticket = { id: "ticket", organizationId: context.organizationId, requesterId: context.actorId, status, number: "SUP-1", priority: "NORMAL", firstResponseAt: null };
  const record = { id: "record", requestHash: "", responseCode: null as number | null, responseBody: null as unknown };
  const db = {
    organizationCapability: { findUnique: vi.fn().mockResolvedValue(operator ? {} : null), findMany: vi.fn().mockResolvedValue([{ organizationId: "operator-org" }]) },
    organizationMembership: { findMany: vi.fn().mockResolvedValue([{ userId: "coworker" }]) },
    supportTicket: { findFirst: vi.fn().mockResolvedValue(ticket), findUniqueOrThrow: vi.fn().mockResolvedValue(ticket), findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue(ticket), update: vi.fn().mockResolvedValue(ticket) },
    supportMessage: { create: vi.fn().mockResolvedValue({ id: "message" }), findMany: vi.fn().mockResolvedValue([]) },
    supportLink: { createMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() },
    idempotencyRecord: {
      upsert: vi.fn(async ({ create }: { create: { requestHash: string } }) => { if (!record.requestHash) record.requestHash = create.requestHash; return record; }),
      update: vi.fn(async ({ data }: { data: { responseCode: number; responseBody: unknown } }) => Object.assign(record, data)),
    },
    $queryRaw: vi.fn(), $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async callback => callback(db));
  const access = { hasAll: vi.fn().mockResolvedValue(true) };
  const attachments = { link: vi.fn().mockResolvedValue([]) };
  return { db, access, attachments, service: new SupportService(db as never, access as never, attachments as never) };
}
const input = { idempotencyKey: "request", body: "Проверьте, пожалуйста", isInternal: false, attachments: [] };

describe("support workspace", () => {
  it("applies tenant, search and status before recent pagination; keeps the operator queue default", async () => {
    const { db, service } = fixture();
    await service.list(context, "OPEN", 50, { q: "SUP-1", sort: "recent" });
    expect(db.supportTicket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: context.organizationId, status: "OPEN", OR: expect.any(Array) }), skip: 50, take: 50, orderBy: [{ updatedAt: "desc" }, { id: "desc" }] }));
    await service.list(context);
    expect(db.supportTicket.findMany.mock.calls[1][0].orderBy[0]).toEqual({ priority: "desc" });
  });
  it("labels authors without exposing private notes to customers", async () => {
    const { db, service } = fixture();
    db.supportMessage.findMany.mockResolvedValue([{ authorId: "operator" }, { authorId: "coworker" }, { authorId: "customer" }] as never);
    const result = await service.get("ticket", context);
    expect(result.messages.map(message => message.authorLabel)).toEqual(["Вы", "Сотрудник организации", "Поддержка"]);
    expect(db.supportMessage.findMany.mock.calls[0][0].where).toEqual(expect.objectContaining({ ticketId: "ticket", isInternal: false }));
  });
  it("denies another tenant before any write", async () => {
    const { db, service } = fixture(); db.supportTicket.findFirst.mockResolvedValue(null);
    await expect(service.addMessage("ticket", input, context)).rejects.toThrow("not found");
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.supportTicket.findFirst.mock.calls[0][0].where.organizationId).toBe(context.organizationId);
  });
  it("rejects customer internal notes", async () => {
    const { db, service } = fixture();
    await expect(service.addMessage("ticket", { ...input, isInternal: true }, context)).rejects.toThrow("Internal notes");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("requires management permission for an operator reopening through a reply", async () => {
    const { db, access, service } = fixture(true, "CLOSED"); access.hasAll.mockResolvedValue(false);
    await expect(service.addMessage("ticket", { ...input, reopen: true }, { actorId: "operator", organizationId: "operator-org" })).rejects.toThrow("право управления");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("notifies operators for a customer message exactly once on replay", async () => {
    const { db, service } = fixture();
    await service.addMessage("ticket", input, context); await service.addMessage("ticket", input, context);
    expect(db.supportMessage.create).toHaveBeenCalledTimes(1);
    expect(db.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(db.outboxEvent.create.mock.calls[0][0].data.payload).toEqual({ ticketId: "ticket", number: "SUP-1", messageId: "message", action: "MESSAGE", support0OrganizationId: "operator-org" });
    await expect(service.addMessage("ticket", { ...input, body: "Changed body" }, context)).rejects.toThrow("different command");
  });
  it("notifies the customer for a public operator reply", async () => {
    const { db, service } = fixture(true);
    await service.addMessage("ticket", input, { actorId: "operator", organizationId: "operator-org" });
    expect(db.outboxEvent.create.mock.calls[0][0].data.payload.organizationId).toBe(context.organizationId);
    expect(db.supportTicket.update.mock.calls[0][0].data).toEqual(expect.objectContaining({ firstResponseAt: expect.any(Date), status: "IN_PROGRESS" }));
  });
  it("keeps internal notes private and does not reopen closed tickets", async () => {
    const { db, service } = fixture(true, "CLOSED");
    await service.addMessage("ticket", { ...input, isInternal: true }, context);
    expect(db.outboxEvent.create).not.toHaveBeenCalled();
    expect(db.supportTicket.update.mock.calls[0][0].data.status).toBeUndefined();
  });
  it.each(["RESOLVED", "CLOSED"])("requires explicit reopening for %s and clears terminal timestamps", async status => {
    const blocked = fixture(false, status);
    await expect(blocked.service.addMessage("ticket", input, context)).rejects.toThrow("Откройте его повторно");
    expect(blocked.db.supportMessage.create).not.toHaveBeenCalled();
    const { db, service } = fixture(false, status);
    await service.addMessage("ticket", { ...input, reopen: true }, context);
    expect(db.supportTicket.update.mock.calls[0][0].data).toEqual(expect.objectContaining({ status: "IN_PROGRESS", closedAt: null, resolvedAt: null, slaDueAt: expect.any(Date) }));
    expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "support.ticket.reopened" }) }));
    expect(db.outboxEvent.create.mock.calls[0][0].data.payload.action).toBe("REOPEN");
  });
  it("registers a ticket and notifies both the requester organization and operator queue", async () => {
    const { db, service } = fixture();
    await service.create({ idempotencyKey: "create", subject: "Ошибка загрузки", description: "Описание ошибки загрузки", category: "TECHNICAL", priority: "NORMAL", links: [] }, context);
    expect(db.supportMessage.create.mock.calls[0][0].data.body).toBe("Описание ошибки загрузки");
    expect(db.outboxEvent.create.mock.calls[0][0].data.payload).toEqual(expect.objectContaining({ organizationId: context.organizationId, support0OrganizationId: "operator-org" }));
  });
});

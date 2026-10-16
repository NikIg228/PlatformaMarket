import { beforeEach, describe, expect, it, vi } from "vitest";
import { operationWorkQueueQuerySchema } from "@marketplace/schemas";
import { OperationQueueService } from "./operation-queue.service";
import { operationQueueQuery } from "./operation-queue.query";
import { OperationsController } from "./operations.controller";

const configuration = vi.hoisted(() => ({ DEPLOYMENT_PROFILE: "pilot" }));
vi.mock("../../platform/config/environment", () => ({ environment: () => configuration }));
beforeEach(() => { configuration.DEPLOYMENT_PROFILE = "pilot"; });
const context = { actorId: "00000000-0000-4000-8000-000000000001", organizationId: "00000000-0000-4000-8000-000000000002" };
const at = new Date("2026-10-15T12:00:00.000Z");
function fixture() {
  const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ total: 0, totalOpenItems: 100, id: null }]) };
  const authority = { assertPlatformOperator: vi.fn().mockResolvedValue(undefined) }, access = { hasAll: vi.fn().mockResolvedValue(true) };
  return { prisma, authority, access, service: new OperationQueueService(prisma as never, authority as never, access as never) };
}

describe("global operation queue", () => {
  it("checks membership/capability and permission before reading any source", async () => {
    const f = fixture(), query = operationWorkQueueQuerySchema.parse({});
    f.authority.assertPlatformOperator.mockRejectedValueOnce(new Error("Denied"));
    await expect(f.service.list(query, context)).rejects.toThrow("Denied");
    f.access.hasAll.mockResolvedValueOnce(false);
    await expect(f.service.list(query, context)).rejects.toThrow("Operator queue permission");
    expect(f.prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it.each(["pilot", "go_live"])("only includes promotion cases in the enabled profile (%s)", async profile => {
    const f = fixture(); configuration.DEPLOYMENT_PROFILE = profile;
    await f.service.list(operationWorkQueueQuerySchema.parse({}), context);
    expect(f.prisma.$queryRaw.mock.calls[0][0].sql.includes('FROM "Promotion"')).toBe(profile === "go_live");
  });

  it("returns totals on empty late pages, without treating missing page rows as cases", async () => {
    const f = fixture(); f.prisma.$queryRaw.mockResolvedValue([{ totalOpenItems: 200, total: 51, id: null }]);
    expect(await f.service.list(operationWorkQueueQuerySchema.parse({ offset: 100 }), context)).toMatchObject({ totalOpenItems: 200, total: 51, offset: 100, limit: 50, hasMore: false, items: [] });
  });

  it("projects safe named cases and tenant assignments without exposing source internals", async () => {
    const f = fixture();
    f.prisma.$queryRaw.mockResolvedValue([{ totalOpenItems: 100, total: 2, id: "00000000-0000-4000-8000-000000000003", queueType: "SUPPLIER_CONFIRMATION", title: "SO-1", organizationId: context.organizationId, organizationName: "Поставщик", relatedOrganizationId: context.actorId, relatedOrganizationName: "Клиника", openedAt: at, updatedAt: at, priority: "HIGH", dueAt: at, reason: "Требуется подтверждение", target: "orders", assignmentId: "assignment", assignmentVersion: 3, assignmentReason: "Передать оператору", assignmentUpdatedAt: at, assigneeId: context.actorId, assigneeName: "Сотрудник", searchText: "PRIVATE SEARCH ONLY" }]);
    const result = await f.service.list(operationWorkQueueQuerySchema.parse({ limit: 1 }), context);
    expect(result).toMatchObject({ total: 2, hasMore: true, items: [{ caseKey: "SUPPLIER_CONFIRMATION:00000000-0000-4000-8000-000000000003", title: "SO-1", organizations: [{ name: "Поставщик" }, { name: "Клиника" }], openedAt: at.toISOString(), dueAt: at.toISOString(), isOverdue: true, assignment: { version: 3, assigneeId: context.actorId } }] });
    expect(JSON.stringify(result)).not.toContain("PRIVATE SEARCH ONLY");
    expect(result.items[0].href).toBe("/admin?section=orders&queueType=SUPPLIER_CONFIRMATION&object=00000000-0000-4000-8000-000000000003");
  });

  it("parameterizes search/filter inputs and scopes assignments before global paging", () => {
    const query = operationWorkQueueQuerySchema.parse({ q: "100%_x' OR true --", kind: "IMPORT_ATTENTION", assignment: "MINE", priority: "HIGH", due: "OVERDUE", offset: 50 });
    const sql = operationQueueQuery(query, context, at, false);
    expect(sql.sql).not.toContain(query.q);
    expect(sql.values).toContain("%100\\%\\_x' OR true --%");
    expect(sql.values).toContain(context.organizationId); expect(sql.values).toContain(context.actorId);
    expect(sql.sql).toContain('a."queueType" = s."queueType" AND a."entityId" = s.id');
    expect(sql.sql.indexOf("filtered AS")).toBeLessThan(sql.sql.indexOf("LIMIT"));
    expect(sql.sql).not.toContain("skip");
  });

  it("rejects malformed filters and authority overrides at the HTTP boundary", () => {
    const queue = { list: vi.fn() }, controller = new OperationsController({} as never, {} as never, queue as never);
    for (const query of [{ organizationId: "other" }, { offset: ["0", "50"] }, { priority: "SUPER" }, { q: "bad\u0000" }]) expect(() => controller.workQueue(query, context.actorId, context.organizationId)).toThrow("Invalid queue filters");
    expect(queue.list).not.toHaveBeenCalled();
    controller.workQueue({ offset: "50", assignment: "MINE" }, context.actorId, context.organizationId);
    expect(queue.list).toHaveBeenCalledWith(operationWorkQueueQuerySchema.parse({ offset: 50, assignment: "MINE" }), context);
  });
});

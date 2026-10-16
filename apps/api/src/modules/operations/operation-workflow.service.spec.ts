import { describe, expect, it, vi } from "vitest";
import { OperationWorkflowService } from "./operation-workflow.service";
import type { OperationAssignment } from "@marketplace/schemas";

const context = { actorId: "actor", organizationId: "operator" };
const input: OperationAssignment = { expectedVersion: 0, priority: "HIGH", assigneeId: "assignee", dueAt: null, reason: "Проверить документы поставщика", idempotencyKey: "command" };

function fixture() {
  type Assignment = { id: string; version: number; priority: string; assigneeId: string | null; dueAt: Date | null; reason: string; updatedAt: Date; assignee: { displayName: string } | null };
  let assignment: Assignment | null = null;
  const records = new Map<string, { id: string; requestHash: string; responseCode?: number; responseBody?: unknown }>();
  const prisma = {
    organizationCapability: { findUnique: vi.fn().mockResolvedValue({ organizationId: "operator" }) },
    productCandidate: { findUnique: vi.fn().mockResolvedValue({ id: "candidate" }) },
    operationAssignment: {
      findUnique: vi.fn(async () => assignment),
      createMany: vi.fn(async ({ data }: { data: Omit<Assignment, "id" | "version" | "updatedAt" | "assignee">[] }) => {
        assignment = { ...data[0], id: "assignment", version: 1, updatedAt: new Date("2026-10-16T12:00:00Z"), assignee: { displayName: "Оператор" } };
        return { count: 1 };
      }),
      updateMany: vi.fn(async ({ data }: { data: Partial<Assignment> & { version: unknown } }) => {
        assignment = { ...assignment!, ...data, version: assignment!.version + 1 };
        return { count: 1 };
      }),
      findUniqueOrThrow: vi.fn(async () => assignment!),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
    idempotencyRecord: {
      upsert: vi.fn(async ({ create }: { create: { scope: string; key: string; requestHash: string } }) => {
        const id = `${create.scope}:${create.key}`;
        if (!records.has(id)) records.set(id, { id, requestHash: create.requestHash });
        return records.get(id)!;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { responseCode: number; responseBody: unknown } }) => Object.assign(records.get(where.id)!, data)),
    },
  };
  const db = Object.assign(prisma, { $transaction: vi.fn(async (run: (tx: typeof prisma) => unknown) => run(prisma)) });
  const access = { hasAll: vi.fn().mockResolvedValue(true) };
  return { prisma: db, access, service: new OperationWorkflowService(db as never, access as never) };
}

describe("OperationWorkflowService assignment boundary", () => {
  it("authorizes operator capability and write permission before looking up or mutating a case", async () => {
    for (const denial of ["capability", "permission"] as const) {
      const f = fixture();
      if (denial === "capability") f.prisma.organizationCapability.findUnique.mockResolvedValue(null);
      else f.access.hasAll.mockResolvedValue(false);
      await expect(f.service.assign("CATALOG_REVIEW", "candidate", input, context)).rejects.toThrow("Operator workflow permission");
      expect(f.prisma.productCandidate.findUnique).not.toHaveBeenCalled();
      expect(f.prisma.$transaction).not.toHaveBeenCalled();
    }
  });

  it("rejects an assignee without active management permission in the operator organization", async () => {
    const f = fixture();
    f.access.hasAll.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(f.service.assign("CATALOG_REVIEW", "candidate", input, context)).rejects.toThrow("Assignee must be an active operator");
    expect(f.access.hasAll).toHaveBeenLastCalledWith("assignee", "operator", ["support.ticket.manage"]);
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("records an assignment once, replays it, and rejects changed command payloads", async () => {
    const f = fixture();
    const first = await f.service.assign("CATALOG_REVIEW", "candidate", input, context);
    expect(first).toMatchObject({ version: 1, assigneeId: "assignee", priority: "HIGH", dueAt: null });
    expect(await f.service.assign("CATALOG_REVIEW", "candidate", input, context)).toEqual(first);
    await expect(f.service.assign("CATALOG_REVIEW", "candidate", { ...input, priority: "LOW" }, context)).rejects.toThrow("Idempotency key was already used");
    expect(f.prisma.operationAssignment.createMany).toHaveBeenCalledTimes(1);
    expect(f.prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(f.prisma.idempotencyRecord.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ scope: "operation.assign:operator:actor" }) }));
    expect(f.prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: "operator", actorId: "actor", entityType: "OperationAssignment", action: "operation.assignment.updated" }) }));
  });

  it("rejects stale versions and lost compare-and-swap without another audit entry", async () => {
    const f = fixture();
    await f.service.assign("CATALOG_REVIEW", "candidate", input, context);
    await expect(f.service.assign("CATALOG_REVIEW", "candidate", { ...input, idempotencyKey: "stale" }, context)).rejects.toThrow("Assignment changed");
    expect(f.prisma.operationAssignment.updateMany).not.toHaveBeenCalled();
    f.prisma.operationAssignment.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(f.service.assign("CATALOG_REVIEW", "candidate", { ...input, expectedVersion: 1, idempotencyKey: "race" }, context)).rejects.toThrow("Assignment changed");
    expect(f.prisma.operationAssignment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "assignment", version: 1 } }));
    expect(f.prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("scopes assignment history to the requesting operator organization and assignment entity", async () => {
    const f = fixture();
    expect(await f.service.history("CATALOG_REVIEW", "candidate", context)).toEqual([]);
    expect(f.prisma.auditLog.findMany).not.toHaveBeenCalled();
    await f.service.assign("CATALOG_REVIEW", "candidate", input, context);
    await f.service.history("CATALOG_REVIEW", "candidate", context);
    expect(f.prisma.operationAssignment.findUnique).toHaveBeenLastCalledWith({ where: { operatorOrganizationId_queueType_entityId: { operatorOrganizationId: "operator", queueType: "CATALOG_REVIEW", entityId: "candidate" } } });
    expect(f.prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "operator", entityType: "OperationAssignment", entityId: "assignment" } }));
  });
});

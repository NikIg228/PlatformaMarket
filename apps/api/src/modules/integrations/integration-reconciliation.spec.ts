import { describe, expect, it, vi } from "vitest";
import { IntegrationsService } from "./integrations.service";

const context = { actorId: "operator-user", organizationId: "operator" };
const updatedAt = new Date("2026-10-17T01:00:00Z");
const input = { resolution: "Проверено по документам поставщика", expectedUpdatedAt: updatedAt.toISOString() };
function fixture() {
  let entry = { id: "entry", connectionId: "connection", status: "MISMATCH", resolution: null as string | null, resolvedById: null as string | null, updatedAt };
  const table = {
    findFirst: vi.fn(async () => entry),
    updateMany: vi.fn(async ({ data }: { data: Partial<typeof entry> }) => { entry = { ...entry, ...data }; return { count: 1 }; }),
    findUniqueOrThrow: vi.fn(async () => entry),
  };
  const auditLog = { create: vi.fn().mockResolvedValue({}) };
  const tx = { integrationReconciliationEntry: table, auditLog };
  const prisma = { ...tx, integrationConnection: { findFirst: vi.fn().mockResolvedValue({ id: "connection" }) }, $transaction: vi.fn(async (run: (client: typeof tx) => Promise<unknown>) => run(tx)) };
  const access = { assertCanManage: vi.fn().mockResolvedValue(undefined) };
  const service = new IntegrationsService(prisma as never, access as never, {} as never);
  return { service, prisma, table, access, auditLog };
}
describe("reconciliation recovery", () => {
  it("saves once and replays identical owner decisions without duplicate audit", async () => {
    const f = fixture();
    const first = await f.service.resolveReconciliation("supplier", "connection", "entry", input, context);
    expect(first.status).toBe("RESOLVED");
    expect(await f.service.resolveReconciliation("supplier", "connection", "entry", input, context)).toEqual(first);
    expect(f.table.updateMany).toHaveBeenCalledTimes(1); expect(f.auditLog.create).toHaveBeenCalledTimes(1);
    await expect(f.service.resolveReconciliation("supplier", "connection", "entry", { ...input, resolution: "Другое решение" }, context)).rejects.toThrow("changed");
    await expect(f.service.resolveReconciliation("supplier", "connection", "entry", input, { ...context, actorId: "another" })).rejects.toThrow("changed");
  });
  it("rejects stale versions and lost concurrent claims without audit", async () => {
    const f = fixture();
    await expect(f.service.resolveReconciliation("supplier", "connection", "entry", { ...input, expectedUpdatedAt: "2026-10-16T00:00:00.000Z" }, context)).rejects.toThrow("changed");
    expect(f.table.updateMany).not.toHaveBeenCalled();
    f.table.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(f.service.resolveReconciliation("supplier", "connection", "entry", input, context)).rejects.toThrow("changed");
    expect(f.auditLog.create).not.toHaveBeenCalled();
    expect(f.table.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "entry", connectionId: "connection", status: "MISMATCH", updatedAt } }));
  });
  it("checks organization access and exact connection before reading the entry", async () => {
    const f = fixture(); f.access.assertCanManage.mockRejectedValueOnce(new Error("denied"));
    await expect(f.service.resolveReconciliation("outsider", "connection", "entry", input, context)).rejects.toThrow("denied");
    expect(f.table.findFirst).not.toHaveBeenCalled();
    f.prisma.integrationConnection.findFirst.mockResolvedValueOnce(null);
    await expect(f.service.resolveReconciliation("supplier", "wrong", "entry", input, context)).rejects.toThrow("Integration connection not found");
    expect(f.table.findFirst).not.toHaveBeenCalled();
  });
});

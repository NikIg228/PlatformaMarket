import { describe, expect, it, vi } from "vitest";
import { OperationWorkflowService } from "./operation-workflow.service";

const actor = { actorId: "actor", organizationId: "operator" };
function fixture(status = "COMPLETED_WITH_ERRORS", allowed = true) {
  const prisma = {
    organizationCapability: { findUnique: vi.fn().mockResolvedValue({}) },
    importBatch: { findUnique: vi.fn().mockResolvedValue({ fileName: "catalog.csv", status, totalRows: 4, processedRows: 3, errorRows: 1, supplierOrganizationId: "supplier", supplier: { organization: { displayName: "Поставщик" } }, updatedAt: new Date("2026-10-17T00:00:00Z"), rawData: "SECRET" }) },
    integrationReconciliationEntry: { findUnique: vi.fn().mockResolvedValue({ kind: "INVENTORY", status, detectedAt: new Date(), updatedAt: new Date(), connectionId: "connection", resolution: null, connection: { supplierOrganizationId: "supplier", displayName: "Склад", supplier: { organization: { displayName: "Поставщик" } }, credentials: "SECRET" }, actual: "SECRET", externalRef: "SKU-1234" }) },
  };
  const access = { hasAll: vi.fn(async (_actor: string, _org: string, rights: string[]) => rights[0] === "organization.view" || allowed) };
  return { prisma, access, service: new OperationWorkflowService(prisma as never, access as never) };
}
describe("operator object action context", () => {
  it.each(["MAPPED", "FAILED", "REVIEW_REQUIRED", "PROCESSING", "COMPLETED", "COMPLETED_WITH_ERRORS", "ROLLED_BACK"])("exposes only existing import transitions from %s", async status => {
    const f = fixture(status);
    const result = await f.service.object("IMPORT_ATTENTION", "batch", actor);
    expect(result.context).toEqual({ kind: "IMPORT", supplierOrganizationId: "supplier", status, updatedAt: "2026-10-17T00:00:00.000Z", canProcess: status === "MAPPED", canRollback: ["COMPLETED", "COMPLETED_WITH_ERRORS"].includes(status) });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
  it("checks command permission separately from operator read permission", async () => {
    const f = fixture("MAPPED", false);
    expect((await f.service.object("IMPORT_ATTENTION", "batch", actor)).context).toMatchObject({ canProcess: false, canRollback: false });
    expect(f.access.hasAll).toHaveBeenCalledWith("actor", "operator", ["import.manage"]);
  });
  it.each(["MISMATCH", "MATCHED", "RESOLVED"])("binds reconciliation %s to its supplier/connection without payload or secrets", async status => {
    const f = fixture(status);
    const result = await f.service.object("INTEGRATION_RECONCILIATION", "entry", actor);
    expect(result.context).toMatchObject({ supplierOrganizationId: "supplier", connectionId: "connection", canResolve: status === "MISMATCH" });
    expect(result.fields).toContainEqual({ label: "Внешняя ссылка", value: "SKU-1234" });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
  it("denies non-operators before source lookup and reports missing objects", async () => {
    const f = fixture(); f.prisma.organizationCapability.findUnique.mockResolvedValueOnce(null);
    await expect(f.service.object("IMPORT_ATTENTION", "batch", actor)).rejects.toThrow("Operator workflow permission");
    expect(f.prisma.importBatch.findUnique).not.toHaveBeenCalled();
    f.prisma.importBatch.findUnique.mockResolvedValueOnce(null);
    await expect(f.service.object("IMPORT_ATTENTION", "missing", actor)).rejects.toThrow("Queue object not found");
  });
});

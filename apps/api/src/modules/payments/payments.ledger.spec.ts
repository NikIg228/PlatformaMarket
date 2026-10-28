import { describe, expect, it, vi } from "vitest";
import { PaymentsService } from "./payments.service";

type Row = { id: string; referenceType: string; referenceId: string; metadata: { paymentAllocationId: string } };
function matches(row: Row, where: any): boolean {
  return (!where.AND || where.AND.every((condition: any) => matches(row, condition)))
    && (!where.OR || where.OR.some((condition: any) => matches(row, condition)))
    && (!where.referenceType || where.referenceType === row.referenceType)
    && (!where.referenceId || (typeof where.referenceId === "string" ? where.referenceId === row.referenceId : where.referenceId.in.includes(row.referenceId)))
    && (!where.metadata || where.metadata.equals === row.metadata.paymentAllocationId);
}
function setup(operator = false, empty = false) {
  const rows: Row[] = [
    { id: "own", referenceType: "PaymentIntent", referenceId: "shared", metadata: { paymentAllocationId: "own-allocation" } },
    { id: "foreign", referenceType: "PaymentIntent", referenceId: "shared", metadata: { paymentAllocationId: "foreign-allocation" } },
    { id: "other-payment", referenceType: "PaymentIntent", referenceId: "other", metadata: { paymentAllocationId: "other-allocation" } },
  ];
  const prisma = {
    organizationCapability: { findUnique: vi.fn().mockResolvedValue(operator ? { capability: "MARKETPLACE_OPERATOR" } : null) },
    paymentIntent: { findMany: vi.fn().mockResolvedValue(empty ? [] : [{ id: "shared", buyerOrganizationId: "buyer", allocations: [{ id: "own-allocation", recipientOrganizationId: "supplier" }] }, { id: "other", buyerOrganizationId: "buyer", allocations: [{ id: "other-allocation", recipientOrganizationId: "supplier" }] }]) },
    financialLedgerEntry: { findMany: vi.fn(async ({ where }: any) => rows.filter(row => matches(row, where))) },
  };
  return new PaymentsService(prisma as never, {} as never);
}
describe("PaymentsService ledger isolation", () => {
  it("does not reveal another supplier allocation in a shared payment", async () => {
    const rows = await setup().ledger({ referenceId: "shared", limit: 100 }, { actorId: "actor", organizationId: "supplier" });
    expect(rows.map(row => row.id)).toEqual(["own"]);
  });
  it("intersects the requested reference instead of replacing it", async () => {
    const rows = await setup().ledger({ referenceId: "inaccessible", limit: 100 }, { actorId: "actor", organizationId: "supplier" });
    expect(rows).toEqual([]);
  });
  it("does not replace a requested reference type", async () => {
    expect(await setup().ledger({ referenceType: "Unknown", limit: 100 }, { actorId: "actor", organizationId: "supplier" })).toEqual([]);
  });
  it("keeps the buyer view of all allocations within its requested payment", async () => {
    const rows = await setup().ledger({ referenceId: "shared", limit: 100 }, { actorId: "actor", organizationId: "buyer" });
    expect(rows.map(row => row.id)).toEqual(["own", "foreign"]);
  });
  it("returns no entries to an organization without payments", async () => {
    expect(await setup(false, true).ledger({ limit: 100 }, { actorId: "actor", organizationId: "outsider" })).toEqual([]);
  });
  it("retains explicit operator filters", async () => {
    const rows = await setup(true).ledger({ referenceId: "shared", limit: 100 }, { actorId: "operator", organizationId: "operator" });
    expect(rows.map(row => row.id)).toEqual(["own", "foreign"]);
  });
});

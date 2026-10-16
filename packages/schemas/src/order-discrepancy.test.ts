import { describe, expect, it } from "vitest";
import { discrepancyStatementSchema, orderDiscrepancyCommandSchema } from "./order-discrepancy";
const id = "00000000-0000-4000-8000-000000000001";
const statement = { kind: "SHORTAGE", reason: "Не хватает", requestedResolution: "RESUPPLY", attachmentIds: [], lines: [{ shipmentItemId: id, actualQuantity: "8.000001", damagedQuantity: "0" }] };
describe("order discrepancy wire contract", () => {
  it("accepts exact decimal and optional evidence but rejects imprecise/negative/duplicate input", () => {
    expect(discrepancyStatementSchema.safeParse(statement).success).toBe(true);
    for (const actualQuantity of ["-1", "1e2", "0.0000001", "01", 8]) expect(discrepancyStatementSchema.safeParse({ ...statement, lines: [{ ...statement.lines[0], actualQuantity }] }).success).toBe(false);
    expect(discrepancyStatementSchema.safeParse({ ...statement, lines: [...statement.lines, ...statement.lines] }).success).toBe(false);
    expect(discrepancyStatementSchema.safeParse({ ...statement, reason: " " }).success).toBe(false);
  });
  it("requires version/idempotency and rejects client-supplied identity or final closure", () => {
    const command = { action: "SUBMIT", discrepancyId: id, expectedOrderVersion: 1, expectedShipmentVersion: 1, expectedExceptionVersion: 1, idempotencyKey: "submit-one" };
    expect(orderDiscrepancyCommandSchema.safeParse(command).success).toBe(true);
    for (const invalid of [{ ...command, expectedExceptionVersion: undefined }, { ...command, actorId: id }, { ...command, action: "RESOLVED" }])
      expect(orderDiscrepancyCommandSchema.safeParse(invalid).success).toBe(false);
  });
  it("requires explicit dispatch acknowledgement and never accepts client quantities or price", () => {
    const command = { action: "DISPATCH_RESUPPLY", discrepancyId: id, expectedOrderVersion: 4, expectedShipmentVersion: 2,
      expectedExceptionVersion: 3, idempotencyKey: "resupply-dispatch", acknowledged: true, carrierName: "Перевозчик", trackingNumber: "R-2" };
    expect(orderDiscrepancyCommandSchema.safeParse(command).success).toBe(true);
    for (const extra of [{ acknowledged: false }, { quantity: "2" }, { amountMinor: "100" }, { shipmentId: id }, { expectedExceptionVersion: 0 }])
      expect(orderDiscrepancyCommandSchema.safeParse({ ...command, ...extra }).success).toBe(false);
  });
});

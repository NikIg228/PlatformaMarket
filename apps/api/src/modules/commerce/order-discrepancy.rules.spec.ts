import { describe, expect, it } from "vitest";
import type { DiscrepancySource, DiscrepancyStatement, OrderDiscrepancyCommand } from "@marketplace/schemas";
import { discrepancyTransition, validateDiscrepancyStatement } from "./order-discrepancy.rules";
const id = "00000000-0000-4000-8000-000000000001";
const source: DiscrepancySource = { orderVersion: 1, shipmentVersion: 1, shipmentNumber: "S1", documentId: null,
  documentVersion: null, documentChecksum: null, documentSnapshot: null, sourceReceiptEventId: null,
  lines: [{ shipmentItemId: id, orderItemId: id, name: "Товар", uom: "шт.", sentQuantity: "10", recordedReceivedQuantity: "8", unitPriceMinor: "100", taxSnapshot: {}, isGift: false }] };
const statement: DiscrepancyStatement = { kind: "SHORTAGE", reason: "Получено восемь", requestedResolution: "RESUPPLY", attachmentIds: [],
  lines: [{ shipmentItemId: id, actualQuantity: "8", damagedQuantity: "0" }] };
const base = { discrepancyId: id, expectedOrderVersion: 1, expectedShipmentVersion: 1, expectedExceptionVersion: 1, idempotencyKey: "command-one" };
describe("discrepancy facts and bilateral transitions", () => {
  it("accepts shortage, zero receipt, fractional quantities and damage without mutating source facts", () => {
    const before = JSON.stringify(source);
    validateDiscrepancyStatement(statement, source);
    validateDiscrepancyStatement({ ...statement, kind: "NOT_RECEIVED", lines: [{ shipmentItemId: id, actualQuantity: "0", damagedQuantity: "0" }] }, source);
    validateDiscrepancyStatement({ ...statement, lines: [{ shipmentItemId: id, actualQuantity: "0.000001", damagedQuantity: "0" }] }, source);
    validateDiscrepancyStatement({ ...statement, kind: "DAMAGED", requestedResolution: "RETURN", lines: [{ shipmentItemId: id, actualQuantity: "10", damagedQuantity: "2" }] }, source);
    expect(JSON.stringify(source)).toBe(before);
  });
  it("rejects inconsistent kinds, excess damage, foreign/missing lines and receipt correction without a source", () => {
    for (const value of [{ ...statement, kind: "DAMAGED" }, { ...statement, kind: "NOT_RECEIVED" }, { ...statement, kind: "EXCESS" },
      { ...statement, requestedResolution: "RETURN" }, { ...statement, kind: "RECEIPT_ERROR" }, { ...statement, lines: [] },
      { ...statement, lines: [{ shipmentItemId: "foreign", actualQuantity: "8", damagedQuantity: "0" }] },
      { ...statement, lines: [{ shipmentItemId: id, actualQuantity: "8", damagedQuantity: "9" }] }])
      expect(() => validateDiscrepancyStatement(value as DiscrepancyStatement, source)).toThrow();
  });
  it("requires explicit clinic acceptance of a counterproposal and freezes sent statements", () => {
    const reply: OrderDiscrepancyCommand = { ...base, action: "RESPOND", decision: "COUNTER", resolution: "REDUCTION", reason: "Предлагаем уменьшение" };
    expect(discrepancyTransition("SUBMITTED", statement, reply)).toEqual({ status: "RESOLUTION_PROPOSED", resolution: "REDUCTION" });
    expect(() => discrepancyTransition("SUBMITTED", statement, { ...reply, decision: "AGREE" })).toThrow("встречного");
    expect(discrepancyTransition("RESOLUTION_PROPOSED", statement, { ...base, action: "DECIDE", accepted: true, reason: "Согласны с вариантом" })).toEqual({ status: "AGREED" });
    expect(discrepancyTransition("RESOLUTION_PROPOSED", statement, { ...base, action: "DECIDE", accepted: false, reason: "Не согласны" })).toEqual({ status: "REJECTED" });
    for (const status of ["SUBMITTED", "REJECTED", "RESOLUTION_PROPOSED", "AGREED"])
      expect(() => discrepancyTransition(status, statement, { ...base, action: "SAVE", statement })).toThrow();
    expect(() => discrepancyTransition("AGREED", statement, reply)).toThrow();
  });
});

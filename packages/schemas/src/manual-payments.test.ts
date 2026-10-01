import { describe, expect, it } from "vitest";
import { orderWorkflowCommandSchema } from "./order-workflow";
import { supplierPaymentPolicyFieldsSchema } from "./manual-payments";

const id = "10000000-0000-4000-8000-000000000001";
const base = { expectedVersion: 1, idempotencyKey: id };
describe("manual payment write contracts", () => {
  it("accepts partial and exact large amounts without coercion", () => {
    for (const amountMinor of ["1", "9007199254740993", "99999999999999999999"]) {
      const result = orderWorkflowCommandSchema.parse({ ...base, action: "REPORT_TRANSFER", invoiceDocumentId: id, documentId: id, amountMinor, paidAt: "2026-10-01T00:00:00Z" });
      expect(result).toMatchObject({ amountMinor });
    }
  });
  it("rejects zero, fractions, exponent notation and numeric money", () => {
    for (const receivedAmountMinor of ["0", "0.01", "1e2", "100000000000000000000", 100])
      expect(orderWorkflowCommandSchema.safeParse({ ...base, action: "CONFIRM_TRANSFER", claimId: id, receivedAmountMinor }).success).toBe(false);
  });
  it("retains legacy confirmation compatibility", () => {
    expect(orderWorkflowCommandSchema.safeParse({ ...base, action: "CONFIRM_TRANSFER", claimId: id }).success).toBe(true);
  });
  it("requires an explicit second-party decision and reasoned review", () => {
    expect(orderWorkflowCommandSchema.safeParse({ ...base, action: "DECIDE_PAYMENT_REDUCTION", reductionId: id }).success).toBe(false);
    expect(orderWorkflowCommandSchema.safeParse({ ...base, action: "RECORD_TRANSFER_CHECK", claimId: id, nextCheckAt: "2026-10-02T10:00:00Z", comment: "" }).success).toBe(false);
  });
});

describe("working-hours policy", () => {
  const valid = { primaryUserId: id, backupUserId: "10000000-0000-4000-8000-000000000002", timezone: "Asia/Almaty", workingWindows: [{ day: 1, fromMinute: 540, toMinute: 780 }, { day: 1, fromMinute: 840, toMinute: 1080 }] };
  it("supports split shifts and midnight boundaries", () => {
    expect(supplierPaymentPolicyFieldsSchema.safeParse(valid).success).toBe(true);
    expect(supplierPaymentPolicyFieldsSchema.safeParse({ ...valid, workingWindows: [{ day: 7, fromMinute: 0, toMinute: 1440 }] }).success).toBe(true);
  });
  it("rejects overlapping periods, invalid timezones and the same backup", () => {
    for (const override of [{ backupUserId: id }, { timezone: "invalid/zone" }, { workingWindows: [] }, { workingWindows: [...valid.workingWindows, valid.workingWindows[0]] }])
      expect(supplierPaymentPolicyFieldsSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});

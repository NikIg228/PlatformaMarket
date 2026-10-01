import { describe, expect, it } from "vitest";
import { manualPaymentSummary, workingMinutesElapsed } from "./manual-payment-rules";
import type { SupplierPaymentPolicyFields } from "@marketplace/schemas";

describe("manual payment ledger", () => {
  it("counts only received amounts and keeps exact remaining and excess values", () => {
    const total = "9007199254740995";
    const claims = [{ status: "PENDING", amountMinor: total }, { status: "CONFIRMED", amountMinor: total, receivedAmountMinor: "9007199254740993" }];
    expect(manualPaymentSummary(total, claims)).toEqual({ confirmedAmountMinor: "9007199254740993", remainingAmountMinor: "2", overpaidAmountMinor: "0", status: "PARTIALLY_RECEIVED" });
    claims.push({ status: "CONFIRMED", amountMinor: "12", receivedAmountMinor: "12" });
    expect(manualPaymentSummary(total, claims)).toEqual({ confirmedAmountMinor: "9007199254741005", remainingAmountMinor: "0", overpaidAmountMinor: "10", status: "OVERPAID" });
  });
  it("preserves legacy confirmed values without turning a reported receipt into money", () => {
    expect(manualPaymentSummary("100", [{ status: "CONFIRMED", amountMinor: "100" }]).status).toBe("PAID");
    expect(manualPaymentSummary("100", [{ status: "NOT_RECEIVED", amountMinor: "100" }]).confirmedAmountMinor).toBe("0");
    expect(manualPaymentSummary("100", [{ status: "DISPUTED", amountMinor: "100" }]).status).toBe("DISPUTED");
  });
});

describe("payment reaction working minutes", () => {
  const policy: SupplierPaymentPolicyFields = { primaryUserId: "primary", backupUserId: "backup", timezone: "Asia/Almaty",
    workingWindows: [1, 2, 3, 4, 5].map(day => ({ day, fromMinute: 9 * 60, toMinute: 18 * 60 })) };
  it("pauses outside hours/weekends and counts exact threshold boundaries", () => {
    const friday = new Date("2026-10-02T12:50:00Z"); // Friday 17:50, UTC+5.
    expect(workingMinutesElapsed(friday, new Date("2026-10-05T04:04:59Z"), policy)).toBeLessThan(15);
    expect(workingMinutesElapsed(friday, new Date("2026-10-05T04:05:00Z"), policy)).toBe(15);
    expect(workingMinutesElapsed(friday, new Date("2026-10-05T04:20:00Z"), policy)).toBe(30);
    expect(workingMinutesElapsed(friday, new Date("2026-10-05T04:50:00Z"), policy)).toBe(60);
  });
  it("does not count an elapsed hour skipped by a daylight-saving transition", () => {
    const dst = { ...policy, timezone: "Europe/Berlin", workingWindows: [{ day: 7, fromMinute: 120, toMinute: 240 }] };
    expect(workingMinutesElapsed(new Date("2026-03-29T00:30:00Z"), new Date("2026-03-29T01:30:00Z"), dst)).toBe(30);
  });
});

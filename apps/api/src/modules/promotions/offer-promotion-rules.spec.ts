import { describe, expect, it, vi } from "vitest";
import { Prisma, type Promotion } from "@prisma/client";
import { capturePromotionPrice, promotionTemporalStatus, promotionUnitPrice } from "./offer-promotion-rules";

describe("versioned promotion invariants", () => {
  it("preserves exact integer money above Number safe range and rejects free paid items", () => {
    const p = { kind: "PERCENTAGE" as const, baseAmountMinor: new Prisma.Decimal("9007199254740993"), percentageBasisPoints: 1000, fixedAmountMinor: null };
    expect(promotionUnitPrice(p)).toBe("8106479329266894");
    expect(promotionUnitPrice({ ...p, kind: "FIXED_AMOUNT", fixedAmountMinor: new Prisma.Decimal("1") })).toBe("9007199254740992");
    expect(() => promotionUnitPrice({ ...p, kind: "FIXED_AMOUNT", fixedAmountMinor: p.baseAmountMinor })).toThrow();
  });
  it("separates moderation, schedule, pause and exhausted state", () => {
    const now = new Date("2030-01-10");
    const p = { status: "ACTIVE", moderationStatus: "APPROVED", termsRevision: 2, approvedRevision: 2, startsAt: new Date("2030-01-01"), endsAt: new Date("2030-02-01"), quantityLimit: new Prisma.Decimal(10), claimedQuantity: new Prisma.Decimal(0) } as Promotion;
    expect(promotionTemporalStatus(p, now)).toBe("ACTIVE");
    expect(promotionTemporalStatus({ ...p, approvedRevision: 1 }, now)).toBe("DRAFT");
    expect(promotionTemporalStatus({ ...p, startsAt: new Date("2030-01-20") }, now)).toBe("SCHEDULED");
    expect(promotionTemporalStatus({ ...p, status: "PAUSED" }, now)).toBe("PAUSED");
    expect(promotionTemporalStatus({ ...p, claimedQuantity: new Prisma.Decimal(10) }, now)).toBe("ENDED");
  });
  it("uses the entire thirty-day aggregate even when the displayed history is bounded", async () => {
    const now = new Date("2030-02-01T00:00:00Z");
    const row = (amount: string, at: string) => ({ amountMinor: new Prisma.Decimal(amount), currency: "KZT", validFrom: new Date(at) });
    const db = { supplierOffer: { findFirst: vi.fn().mockResolvedValue({ id: "offer" }) }, offerPrice: {
      findFirst: vi.fn().mockResolvedValueOnce(row("9007199254740993", "2030-01-31")).mockResolvedValueOnce(row("9007199254740991", "2029-12-01")).mockResolvedValueOnce(row("9007199254740991", "2029-12-01")),
      findMany: vi.fn().mockResolvedValue([row("9007199254740993", "2030-01-31")]),
      aggregate: vi.fn().mockResolvedValue({ _min: { amountMinor: new Prisma.Decimal("9007199254740900") } }),
    } };
    const result = await capturePromotionPrice(db as never, "offer", "supplier", now);
    expect(result.minimum30DaysMinor).toBe("9007199254740900");
    expect(result.baseAmountMinor).toBe("9007199254740993");
    expect(result.raisedRecently).toBe(true);
    expect(result.historyDays).toBe(30);
  });
});

import { describe, expect, it } from "vitest";
import { personalCartAddSchema, personalCartCreateSchema, personalCartUpdateSchema, personalCartVersionSchema } from "./personal-cart";

describe("personal cart requests", () => {
  it("requires a version and rejects owner/organization injection", () => {
    const input = { expectedVersion: 1, offerId: "00000000-0000-4000-8000-000000000001", quantity: 1.25 };
    expect(personalCartAddSchema.safeParse(input).success).toBe(true);
    expect(personalCartAddSchema.safeParse({ ...input, ownerUserId: input.offerId }).success).toBe(false);
    expect(personalCartCreateSchema.safeParse({ buyerOrganizationId: input.offerId }).success).toBe(false);
    expect(personalCartVersionSchema.safeParse({}).success).toBe(false);
  });
  it.each([0, -1, 1_000_001, 0.0000001, Infinity, NaN])("rejects invalid quantity %s", quantity => {
    expect(personalCartUpdateSchema.safeParse({ expectedVersion: 1, quantity }).success).toBe(false);
  });
});

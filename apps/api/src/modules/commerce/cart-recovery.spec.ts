import { describe, expect, it } from "vitest";
import { recoveredCartId } from "./cart-recovery";
import { recoverCartSchema, cartResponseSchema } from "@marketplace/schemas";

describe("permanent cart recovery identity", () => {
  it("is a stable valid UUID independent of actor, time and source UUID casing", () => {
    const source = "c6c30fc2-464f-40c7-b8ee-ad962415ec82";
    const id = recoveredCartId(source);
    expect(id).toMatch(/^[a-f0-9-]{14}5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    expect(recoveredCartId(source.toUpperCase())).toBe(id);
    expect(id).not.toBe(source);
    expect(recoveredCartId("c6c30fc2-464f-40c7-b8ee-ad962415ec83")).not.toBe(id);
    expect(cartResponseSchema.shape.recoveredCartId.parse(id)).toBe(id);
  });
  it("requires a source version and rejects unrelated command fields", () => {
    expect(recoverCartSchema.safeParse({}).success).toBe(false);
    expect(recoverCartSchema.safeParse({ expectedVersion: 0 }).success).toBe(false);
    expect(recoverCartSchema.safeParse({ expectedVersion: 2, buyerOrganizationId: "other" }).success).toBe(false);
    expect(recoverCartSchema.parse({ expectedVersion: 2 })).toEqual({ expectedVersion: 2 });
  });
});

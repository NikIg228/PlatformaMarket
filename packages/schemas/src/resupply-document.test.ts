import { describe, expect, it } from "vitest";
import { prepareResupplyDocumentSchema } from "./resupply-document";
describe("working resupply document commands", () => {
  const input = { kind: "TRANSFER", expectedOrderVersion: 1, expectedShipmentVersion: 1, expectedExceptionVersion: 1, expectedResupplyVersion: 1, idempotencyKey: "draft-request-1" };
  it("accepts version-bound preparation and rejects injected quantities or sign flags", () => {
    expect(prepareResupplyDocumentSchema.safeParse(input).success).toBe(true);
    for (const value of [{ ...input, quantity: "10" }, { ...input, signed: true }, { ...input, expectedResupplyVersion: 0 }, { ...input, kind: "INVOICE" }])
      expect(prepareResupplyDocumentSchema.safeParse(value).success).toBe(false);
  });
});

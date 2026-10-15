import { describe, expect, it } from "vitest";
import { prepareShipmentWaybillSchema } from "./shipment-waybill";
describe("shipment waybill request", () => {
  const valid = { expectedOrderVersion: 2, expectedShipmentVersion: 3, idempotencyKey: "waybill-retry" };
  it("requires both concurrency versions and a replay key", () => {
    expect(prepareShipmentWaybillSchema.parse(valid)).toEqual(valid);
    for (const bad of [{ ...valid, expectedOrderVersion: 0 }, { ...valid, expectedShipmentVersion: undefined }, { ...valid, idempotencyKey: "" }]) expect(prepareShipmentWaybillSchema.safeParse(bad).success).toBe(false);
  });
  it("does not accept amounts, arbitrary document data or actor identity from the client", () => {
    for (const key of ["amountMinor", "data", "organizationId", "actorId", "documentId"]) expect(prepareShipmentWaybillSchema.safeParse({ ...valid, [key]: "injected" }).success).toBe(false);
  });
});

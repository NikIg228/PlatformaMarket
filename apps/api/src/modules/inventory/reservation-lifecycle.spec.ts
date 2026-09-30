import { describe, expect, it } from "vitest";
import { orderCanExpire, orderReservationState } from "./reservation-lifecycle";
const deadline = new Date("2026-09-30T12:00:00Z");
function order() { return { status: "AWAITING_PAYMENT", paymentStatus: "UNPAID", transferClaims: [] as unknown[], shipments: [] as unknown[], items: [{ reservation: { status: "ACTIVE", expiresAt: deadline, externalReservation: null as unknown } }], paymentAllocation: null as unknown }; }
describe("local reservation deadlines", () => {
  it("expires exactly at the deadline, not one millisecond earlier", () => {
    expect(orderCanExpire(order(), new Date(deadline.getTime() - 1))).toBe(false);
    expect(orderCanExpire(order(), deadline)).toBe(true);
    expect(orderCanExpire(order(), new Date(deadline.getTime() + 1))).toBe(true);
  });
  it.each(["PENDING", "NEEDS_INFORMATION"])("holds a declared transfer in %s", status => {
    const value = order(); value.transferClaims = [{ status }];
    expect(orderCanExpire(value, deadline)).toBe(false);
    expect(orderReservationState(value, deadline)).toEqual({ status: "HELD_TRANSFER", expiresAt: null });
  });
  it.each(["payment", "external", "paid", "shipment", "consumed", "released"])("does not free a %s lifecycle", state => {
    const value = order();
    if (state === "payment") value.paymentAllocation = {};
    if (state === "external") value.items[0].reservation.externalReservation = {};
    if (state === "paid") value.paymentStatus = "PAID";
    if (state === "shipment") value.shipments = [{}];
    if (state === "consumed") value.items[0].reservation.status = "CONSUMED";
    if (state === "released") value.items[0].reservation.status = "RELEASED";
    expect(orderCanExpire(value, deadline)).toBe(false);
  });
  it("reports already expired rows and cannot expire them again", () => {
    const value = order(); value.status = "CANCELLED"; value.items[0].reservation.status = "EXPIRED";
    expect(orderReservationState(value, deadline).status).toBe("EXPIRED");
    expect(orderCanExpire(value, deadline)).toBe(false);
  });
});

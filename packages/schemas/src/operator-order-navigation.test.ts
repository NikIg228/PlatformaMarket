import { describe, expect, it } from "vitest";
import { adminSectionQuery, defaultAdminQuery, parseAdminQuery, serializeAdminQuery } from "./admin-query";
const id = "61000000-0000-4000-8000-000000000005";
describe("operator order navigation", () => {
  it("round trips filters and detail, preserving search when returning to registry", () => {
    const state = { ...defaultAdminQuery, section: "orders" as const, orderId: id, orderQ: "ТОО #1 &", orderBuyer: "Clinic", orderOffset: 25, orderStatus: "PAID" as const, orderFrom: "2026-10-01", orderTo: "2026-10-16" };
    expect(parseAdminQuery(serializeAdminQuery(state))).toEqual(state);
    expect(adminSectionQuery(state, "orders")).toMatchObject({ orderId: undefined, orderQ: "ТОО #1 &", orderOffset: 25 });
    expect(parseAdminQuery(`?section=orders&queueType=SUPPLIER_CONFIRMATION&object=${id}`)?.orderId).toBe(id);
    for (const queueType of ["AGREEMENT_SIGNATURE", "ORGANIZATION_REVIEW"]) {
      expect(parseAdminQuery(`?section=orders&queueType=${queueType}&object=${id}`)).toMatchObject({ section: "organizations", queueType, object: id });
    }
  });
  it("rejects invalid dates, offsets, ambiguous object IDs and unsupported write parameters", () => {
    for (const query of [`section=orders&orderId=${id}&orderId=${id}`, `section=support&orderId=${id}`, "section=orders&orderFrom=2026-02-30", "section=orders&orderFrom=2026-10-17&orderTo=2026-10-16", "section=orders&orderOffset=3", "section=orders&orderStatus=HACK", "section=orders&action=CONFIRM_TRANSFER", `section=orders&queueType=SUPPLIER_CONFIRMATION&object=${id}&orderId=61000000-0000-4000-8000-000000000006`]) expect(parseAdminQuery(query)).toBeUndefined();
  });
});

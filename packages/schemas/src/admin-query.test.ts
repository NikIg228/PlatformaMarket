import { describe, expect, it } from "vitest";
import { adminSectionQuery, defaultAdminQuery, parseAdminQuery, serializeAdminQuery } from "./admin-query";
import { adminReturnPath } from "./product-navigation";
const id = "00000000-0000-4000-8000-000000000001";
describe("Admin read query state", () => {
  it("retains audit filters through object navigation and technical paging", () => {
    const state = { ...defaultAdminQuery, section: "security" as const, controlView: "technical" as const, auditOrganization: id, auditActor: id, auditEntityType: "SupplierOrder", auditEntityId: id, auditAction: "confirmed", auditFrom: "2026-10-17", auditTo: "2026-10-18", auditOffset: 25, outboxEventId: id, outboxEventType: "order.confirmed", outboxOffset: 50 };
    expect(parseAdminQuery(serializeAdminQuery(state))).toEqual(state);
    expect(parseAdminQuery(serializeAdminQuery({ ...adminSectionQuery(state, "orders"), orderId: id }))).toMatchObject({ auditActor: id, auditOffset: 25, outboxOffset: 50, orderId: id });
  });
  it.each(["auditActor=bad", "auditOrganization=bad", "auditOffset=1", "outboxOffset=1000025", "outboxEventId=bad", "auditFrom=2026-02-30", "auditFrom=2026-10-18&auditTo=2026-10-17", "controlView=write", "outboxEventType=" + "x".repeat(121)])("rejects unsafe audit navigation %s", query => expect(parseAdminQuery(`?section=security&${query}`)).toBeUndefined());
  it("roundtrips organization filters, detail and retained maximum Unicode search context", () => {
    const state = { ...defaultAdminQuery, section: "organizations" as const, orgId: id, orgQ: "界".repeat(200), orgStatus: "ARCHIVED" as const, orgCapability: "MARKETPLACE_OPERATOR" as const, orgOffset: 1000000,
      supportQ: "界".repeat(200), supportStatus: "WAITING_CUSTOMER" as const, supportSort: "recent" as const, supportMode: "conversations" as const, conversationFilter: "UNREAD" as const, conversationOffset: 99990,
      queueType: "INTEGRATION_RECONCILIATION" as const, object: id, queueKind: "INTEGRATION_RECONCILIATION" as const, supportOffset: 100000, queueOffset: 100000 };
    const search = serializeAdminQuery(state);
    expect(parseAdminQuery(search)).toEqual(state);
    expect(adminReturnPath(`/admin${search}`)).toBe(`/admin${search}`);
    expect(adminSectionQuery(state, "catalog")).toMatchObject({ orgId: undefined, orgQ: state.orgQ, orgOffset: 1000000 });
    expect(parseAdminQuery(serializeAdminQuery({ ...defaultAdminQuery, section: "organizations", orgQ: "#123 \\ text" }))?.orgQ).toBe("#123 \\ text");
  });
  it.each(["orgOffset=1", "orgOffset=1000025", "orgStatus=DELETED", "orgCapability=ADMIN", "orgId=bad", "orgQ=%00", "orgQ=a&orgQ=b", "orgQ=" + "a".repeat(201)])("rejects invalid organization query %s", query => {
    expect(parseAdminQuery(`?section=organizations&${query}`)).toBeUndefined();
  });
  it("defaults old URLs and preserves bounded list context through safe login return", () => {
    expect(parseAdminQuery("")).toEqual(defaultAdminQuery);
    const state = { ...defaultAdminQuery, section: "support" as const, ticketId: id, supportQ: "Счёт 42", supportStatus: "OPEN" as const, supportSort: "recent" as const, supportOffset: 50, queueKind: "CATALOG_REVIEW" as const, queueOffset: 100 };
    const search = serializeAdminQuery(state);
    expect(parseAdminQuery(search)).toEqual(state);
    expect(adminReturnPath(`/admin${search}`)).toBe(`/admin${search}`);
    const section = adminSectionQuery(state, "orders");
    expect(section.ticketId).toBeUndefined();
    expect(section.supportQ).toBe("Счёт 42");
    expect(section.queueOffset).toBe(100);
    expect(parseAdminQuery(serializeAdminQuery(section))).toEqual(section);
  });
  it("accepts legacy mixed links but emits only the visible conversation", () => {
    const search = `?section=support&ticketId=${id}&conversationId=${id}&supportMode=tickets`;
    expect(adminReturnPath(`/admin${search}`)).toBe(`/admin${search}`);
    const state = parseAdminQuery(search)!;
    expect(state.ticketId).toBeUndefined(); expect(state.supportMode).toBe("conversations");
    expect(serializeAdminQuery(state)).not.toContain("ticketId");
  });
  it.each(["supportOffset=-50", "queueOffset=1", "queueOffset=1000050", "queueOffset=01", "queueOffset=1e2", "supportSort=bad", "supportMode=bad", "supportStatus=bad", "supportQ=" + "a".repeat(201), "supportQ=%0a", "supportQ=a&supportQ=b", "organizationId=" + id, "token=secret", "returnTo=%2Fadmin", "section=unknown", "queueType=CATALOG_REVIEW", "object=" + id, "ticketId=" + id])("rejects invalid/authority/duplicate values: %s", query => {
    expect(parseAdminQuery("?" + query)).toBeUndefined();
    expect(adminReturnPath("/admin?" + query)).toBeUndefined();
  });
  it("encodes ordinary free-text punctuation without treating it as URL syntax", () => {
    const supportQ = "#123 \\ /admin?token=text";
    const search = serializeAdminQuery({ ...defaultAdminQuery, section: "support", supportQ });
    expect(parseAdminQuery(search)?.supportQ).toBe(supportQ);
    expect(adminReturnPath(`/admin${search}`)).toBe(`/admin${search}`);
    expect(adminReturnPath("/admin?section=support&supportQ=#123")).toBeUndefined();
  });
  it("retains 200 Unicode characters with all bounded context fields", () => {
    const state = { ...defaultAdminQuery, section: "support" as const, supportQ: "界".repeat(200), supportStatus: "WAITING_CUSTOMER" as const, supportSort: "recent" as const, supportMode: "conversations" as const, conversationId: id, queueType: "INTEGRATION_RECONCILIATION" as const, object: id, queueKind: "INTEGRATION_RECONCILIATION" as const, supportOffset: 100000, queueOffset: 100000, conversationOffset: 99990, conversationFilter: "ORDERS" as const };
    const search = serializeAdminQuery(state);
    expect(parseAdminQuery(search)).toEqual(state);
    expect(adminReturnPath(`/admin${search}`)).toBe(`/admin${search}`);
    expect(adminReturnPath(`/admin?${"x".repeat(4096)}`)).toBeUndefined();
  });
  it("clears all targets atomically while retaining list context", () => {
    const state = { ...defaultAdminQuery, section: "orders" as const, queueType: "SUPPLIER_CONFIRMATION" as const, object: id, queueOffset: 50 };
    const next = adminSectionQuery(state, "support");
    expect(serializeAdminQuery(next)).toBe("?section=support&queueOffset=50");
    expect(() => serializeAdminQuery({ ...state, object: undefined })).toThrow();
  });
  it("respects existing API maxima and each list page size", () => {
    expect(parseAdminQuery("?queueOffset=100000&supportOffset=100000&conversationOffset=99990&conversationFilter=UNREAD")).toMatchObject({ queueOffset: 100000, supportOffset: 100000, conversationOffset: 99990, conversationFilter: "UNREAD" });
    for (const query of ["queueOffset=100050", "supportOffset=100050", "conversationOffset=100020", "conversationOffset=50", "conversationFilter=unknown"]) expect(parseAdminQuery(query)).toBeUndefined();
  });
});

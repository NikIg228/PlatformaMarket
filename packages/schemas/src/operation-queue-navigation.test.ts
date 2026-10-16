import { describe, expect, it } from "vitest";
import { adminSectionQuery, defaultAdminQuery, parseAdminQuery, serializeAdminQuery } from "./admin-query";
describe("operation queue URL state", () => {
  it("round-trips all filters and retains them through an object visit", () => {
    const queue = { ...defaultAdminQuery, queueQ: "#123 \\ 100%_", queueKind: "CATALOG_REVIEW" as const, queuePriority: "HIGH" as const, queueAssignment: "MINE" as const, queueDue: "OVERDUE" as const, queueSort: "oldest" as const, queueOffset: 50 };
    const object = { ...adminSectionQuery(queue, "catalog"), queueType: "CATALOG_REVIEW" as const, object: "00000000-0000-4000-8000-000000000001" };
    expect(parseAdminQuery(serializeAdminQuery(queue))).toEqual(queue);
    expect(parseAdminQuery(serializeAdminQuery(object))).toEqual(object);
    expect(adminSectionQuery(object, "overview")).toEqual(queue);
  });
  it.each(["queueQ=%00", "queueQ=a&queueQ=b", "queuePriority=URGENT", "queueAssignment=actor-id", "queueDue=soon", "queueSort=sql", "queueOffset=51"])("rejects malformed queue navigation: %s", query => {
    expect(parseAdminQuery(`?section=overview&${query}`)).toBeUndefined();
  });
});

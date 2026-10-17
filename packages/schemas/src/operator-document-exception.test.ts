import { describe, expect, it } from "vitest";
import { operatorExceptionReviewSchema, operatorExceptionReviewResultSchema } from "./operator-document-exception";
import { operationQueueTypeSchema } from "./operations-workflow";
import { adminSectionQuery, parseAdminQuery, serializeAdminQuery } from "./admin-query";
const id = "72000000-0000-4000-8000-000000000001";
const input = { expectedOrderVersion: 1, expectedShipmentVersion: 2, expectedExceptionVersion: 3, idempotencyKey: id, reason: "Проверено заявление сторон", nextStep: "Поставщику ответить" };
describe("document exception recommendation contract", () => {
  it("requires versions, public text, next step and identity-safe idempotency", () => {
    expect(operatorExceptionReviewSchema.parse(input)).toEqual(input);
    for (const invalid of [{ ...input, reason: " " }, { ...input, nextStep: "" }, { ...input, expectedOrderVersion: 0 }, { ...input, expectedShipmentVersion: 0 }, { ...input, expectedExceptionVersion: 0 }, { ...input, idempotencyKey: "bad" }, { ...input, organizationId: id }, { ...input, status: "RESOLVED" }]) expect(operatorExceptionReviewSchema.safeParse(invalid).success).toBe(false);
    expect(operatorExceptionReviewResultSchema.safeParse({ orderId: id, discrepancyId: id, eventId: id, version: 4, status: "RESOLVED", reviewStatus: "REVIEWED" }).success).toBe(false);
  });
  it("keeps document case separate from order id and preserves queue filters on return", () => {
    expect(operationQueueTypeSchema.parse("DOCUMENT_EXCEPTION")).toBe("DOCUMENT_EXCEPTION");
    const query = parseAdminQuery(`?section=orders&queueType=DOCUMENT_EXCEPTION&object=${id}&queueKind=DOCUMENT_EXCEPTION&queueQ=поставка&queueOffset=50`)!;
    expect(query.object).toBe(id); expect(query.orderId).toBeUndefined();
    const back = parseAdminQuery(serializeAdminQuery(adminSectionQuery(query, "overview")))!;
    expect(back).toMatchObject({ section: "overview", queueKind: "DOCUMENT_EXCEPTION", queueQ: "поставка", queueOffset: 50 });
    expect(back.object).toBeUndefined();
  });
});

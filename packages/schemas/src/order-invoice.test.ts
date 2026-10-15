import { describe, expect, it } from "vitest";
import { prepareOrderInvoiceSchema } from "./order-invoice";
import { orderWorkflowCommandSchema } from "./order-workflow";
describe("invoice request contract", () => {
  it("rejects client-supplied amounts and snapshots", () => {
    const request = { expectedVersion: 1, idempotencyKey: "00000000-0000-4000-8000-000000000002" };
    expect(prepareOrderInvoiceSchema.safeParse(request).success).toBe(true);
    expect(prepareOrderInvoiceSchema.safeParse({ ...request, totalMinor: "1" }).success).toBe(false);
    expect(prepareOrderInvoiceSchema.safeParse({ ...request, expectedVersion: 0 }).success).toBe(false);
  });
  it("accepts a checksum for generated confirmation and preserves uploaded commands", () => {
    const request = { action: "ISSUE_INVOICE", documentId: "00000000-0000-4000-8000-000000000001", expectedVersion: 1, idempotencyKey: "00000000-0000-4000-8000-000000000002" };
    expect(orderWorkflowCommandSchema.safeParse(request).success).toBe(true);
    expect(orderWorkflowCommandSchema.safeParse({ ...request, previewChecksum: "a".repeat(64) }).success).toBe(true);
    expect(orderWorkflowCommandSchema.safeParse({ ...request, previewChecksum: "wrong" }).success).toBe(false);
  });
});

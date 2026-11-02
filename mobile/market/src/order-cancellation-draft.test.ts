import { jest } from "@jest/globals";
import { orderWorkflowCommandSchema } from "../../../packages/schemas/src/order-workflow";
import { createOrderCancellationDrafts, checkCancellationFields } from "./order-cancellation-draft";
import { cancellationWorkflow, cancellationScope, cancellationId } from "./test-fixtures/cancellation-draft";
function started() { const store = createOrderCancellationDrafts(cancellationScope), workflow = cancellationWorkflow(); store.syncWorkflow(workflow); const target = store.begin(workflow); if (!target) throw new Error("Synthetic local context missing"); return { store, workflow, target }; }
it("uses actual CANCEL reason/declaration validators without constructing a complete command or changing raw text", () => {
  const shape = orderWorkflowCommandSchema.options.find(option => option.shape.action.value === "CANCEL")!.shape; if (!("transferNotMade" in shape)) throw new Error("Actual field missing");
  expect(shape.reason.safeParse("abc").success).toBe(true); expect(shape.reason.safeParse("ab").success).toBe(false); expect(shape.transferNotMade.safeParse(false).success).toBe(false);
  expect(checkCancellationFields("  ", false)).toEqual({ reason: { kind: "minimum", count: "3" }, transferNotMade: { kind: "confirmation" } }); expect(checkCancellationFields("x".repeat(2001), true)).toEqual({ reason: { kind: "maximum", count: "2000" } });
  const { store, target } = started(); expect(store.entryForTarget(target)?.transferNotMade).toBe(false); store.setReason(target, "  SYNTHETIC 原因  "); store.setDeclaration(target, true); expect(store.review(target)).toBe(true); expect(store.entryForTarget(target)).toMatchObject({ reason: "  SYNTHETIC 原因  ", transferNotMade: true, reviewing: true });
  expect(orderWorkflowCommandSchema.safeParse({ reason: "valid", transferNotMade: true }).success).toBe(false); expect(store.entryForTarget(target)).not.toHaveProperty("idempotencyKey"); expect(store.entryForTarget(target)).not.toHaveProperty("action");
});
it.each(["AWAITING_CONFIRMATION", "CONFIRMED", "PARTIALLY_CONFIRMED", "AWAITING_PAYMENT"])("permits LOCAL field preparation for source-known %s without reading hidden payment/reservation/permission facts", status => {
  const store = createOrderCancellationDrafts(cancellationScope), raw = cancellationWorkflow(), hidden = jest.fn(() => { throw new Error("Hidden eligibility fact read"); }); raw.status = raw.order.status = status;
  for (const key of ["paymentAllocation", "reservation", "permission", "canCancel", "bankAccount", "supplierContacts"]) Object.defineProperty(raw, key, { get: hidden }); store.syncWorkflow(raw); expect(store.begin(raw)).not.toBeNull(); expect(hidden).not.toHaveBeenCalled();
});
it.each(["foreign-buyer", "supplier-viewer", "id", "version", "status", "payment", "paid", "terminal", "future"])("does not start a local cancellation draft for %s, before reading labels", field => {
  const raw = cancellationWorkflow(), hidden = jest.fn(() => { throw new Error("Unbound label read"); });
  if (field === "foreign-buyer" || field === "supplier-viewer") raw.order.buyerOrganizationId = cancellationId(99);
  if (field === "supplier-viewer") raw.order.supplierOrganizationId = cancellationScope.organizationId;
  if (field === "id") raw.orderId = cancellationId(99); if (field === "version") raw.version++; if (field === "status") raw.status = "CONFIRMED"; if (field === "payment") raw.paymentStatus = "PAID";
  if (field === "paid") raw.paymentStatus = raw.order.paymentStatus = "PAID"; if (field === "terminal") raw.status = raw.order.status = "CANCELLED"; if (field === "future") raw.status = raw.order.status = "FUTURE";
  Object.defineProperty(raw.order, "orderNumber", { get: hidden }); const store = createOrderCancellationDrafts(cancellationScope); store.syncWorkflow(raw); expect(store.begin(raw)).toBeNull(); expect(hidden).not.toHaveBeenCalled();
});
it("strips passthrough root/order extras before scalar context checks", () => {
  const raw = cancellationWorkflow(), hidden = jest.fn(() => { throw new Error("Unexpected passthrough read"); }); Object.defineProperty(raw, "private", { enumerable: true, get: hidden }); Object.defineProperty(raw.order, "private", { enumerable: true, get: hidden }); const store = createOrderCancellationDrafts(cancellationScope); store.syncWorkflow(raw); expect(store.begin(raw)).not.toBeNull(); expect(hidden).not.toHaveBeenCalled();
});
it("keeps unchanged-source edits/review and ignores older versions; newer version clears only this entry and invalidates retained handles", () => {
  const { store, workflow, target } = started(); store.setReason(target, "SYNTHETIC reason"); store.setDeclaration(target, true); store.review(target); store.syncWorkflow(workflow); expect(store.entryForTarget(target)?.reviewing).toBe(true);
  const old = cancellationWorkflow(); old.version = old.order.version = workflow.version - 1; store.syncWorkflow(old); expect(store.entryForTarget(target)?.reason).toBe("SYNTHETIC reason"); const next = cancellationWorkflow(); next.version = next.order.version = workflow.version + 1; store.syncWorkflow(next); expect(store.entryForTarget(target)).toBeNull(); expect(store.setReason(target, "stale")).toBe(false); expect(store.begin(next)).not.toBe(target); expect(store.entryFor(next)).toMatchObject({ reason: "", transferNotMade: false, discarded: true });
});
it("keeps different orders independent and discards only the positively changed/inaccessible order", () => {
  const { store, workflow, target } = started(); store.setReason(target, "SYNTHETIC first"); const second = cancellationWorkflow(); second.orderId = second.order.id = cancellationId(99); store.syncWorkflow(second); const other = store.begin(second)!; store.setReason(other, "SYNTHETIC second"); store.invalidate(workflow.orderId); expect(store.entryForTarget(target)).toBeNull(); expect(store.entryForTarget(other)?.reason).toBe("SYNTHETIC second");
});
it.each(["paid", "terminal"])("clears raw fields when positive source becomes %s", kind => {
  const { store, workflow, target } = started(); store.setReason(target, "SYNTHETIC obsolete"); store.setDeclaration(target, true); if (kind === "paid") workflow.paymentStatus = workflow.order.paymentStatus = "PAID"; else workflow.status = workflow.order.status = "CANCELLED"; store.syncWorkflow(workflow); expect(store.entryForTarget(target)).toBeNull(); expect(JSON.stringify(store.getSnapshot())).not.toContain("SYNTHETIC obsolete");
});
it("local discard resets declaration and detaches copied/old callbacks; close clears and cannot be revived by old source", () => {
  const { store, workflow, target } = started(); expect(store.setReason({ ...target }, "copied")).toBe(false); store.setReason(target, "SYNTHETIC unsent"); store.setDeclaration(target, true); store.cancel(target); expect(store.setDeclaration(target, true)).toBe(false); const next = store.begin(workflow)!; expect(store.entryForTarget(next)).toMatchObject({ reason: "", transferNotMade: false }); store.close(); store.syncWorkflow(workflow); expect(store.begin(workflow)).toBeNull(); expect(store.getSnapshot().entries).toEqual({});
});

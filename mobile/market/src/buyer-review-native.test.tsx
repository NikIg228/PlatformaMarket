import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { workspaceOrderPageSchema } from "../../../packages/schemas/src/workspace-reads";
import { createVerifiedReviewSchema } from "../../../packages/schemas/src/trust-commerce";
import NativeMarketApp from "./NativeMarketApp";
import { buyerReviewCopy } from "./buyer-review-copy";
import { reviewDimensions } from "./buyer-review-create";
import { copy } from "./i18n";
import { sessionCopy } from "./session-copy";
import { api, current, response, server, user, workspace } from "./test-fixtures/market-session";
import { reviewScope, reviewWorkflow, reviewReceipt, reviewId, reviewError } from "./test-fixtures/buyer-review";
import { listDraftPayload } from "./test-fixtures/list-draft";
import type { Locale } from "./format-wire";

jest.mock("expo/fetch", () => ({ fetch: jest.fn(() => { throw Error("Unexpected real native request"); }) }));
afterEach(() => jest.restoreAllMocks());
function backend(options: { firstFailure?: number; foreignReceipt?: boolean } = {}) {
  const workflow = reviewWorkflow(), writes: { body: string; init: RequestInit }[] = [];
  const page = workspaceOrderPageSchema.parse({ items: [{ ...workflow.order, supplier: workflow.order.supplier ?? { id: workflow.order.supplierOrganizationId, displayName: "SYNTHETIC review supplier" }, buyer: workflow.order.buyer ?? { id: reviewScope.organizationId, displayName: "SYNTHETIC review buyer" }, itemCount: workflow.order.items.length }], nextCursor: null });
  let serial = 30001;
  const uuid = { randomUUID: jest.fn(() => reviewId(serial++)) };
  const fetcher = server((path, init) => {
    if (path === "/auth/current?workspace=BUYER") return response(current({ user: { ...user, id: reviewScope.userId }, activeOrganizationId: reviewScope.organizationId, organizationIds: [reviewScope.organizationId], workspaces: [workspace(reviewScope.organizationId)] }));
    if (path.startsWith("/marketplace/search")) return response(listDraftPayload("catalog-empty"));
    if (path.startsWith("/workspaces/buyer/orders")) return response(page);
    if (path === `/supplier-orders/${workflow.orderId}/workflow`) return response(workflow);
    if (path === `/trust/orders/${workflow.orderId}/reviews`) {
      writes.push({ body: String(init.body), init });
      if (options.firstFailure && writes.length === 1) return response(reviewError(options.firstFailure).payload, options.firstFailure);
      const input = createVerifiedReviewSchema.strict().parse(JSON.parse(String(init.body)));
      return response(reviewReceipt(input, workflow, reviewScope, options.foreignReceipt ? { reviewerOrganizationId: reviewId(99801), comment: "SYNTHETIC foreign private receipt" } : {}), 201);
    }
    return undefined;
  });
  return { workflow, fetcher, writes, uuid };
}
async function open(s: ReturnType<typeof backend>, locale: Locale = "ru") {
  await render(<StrictMode><NativeMarketApp initialApiUrl={api} fetcher={s.fetcher} reviewUuidProvider={s.uuid} /></StrictMode>);
  if (locale === "kk") await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" }));
  await screen.findByRole("tab", { name: copy[locale].orders }); await fireEvent.press(screen.getByRole("tab", { name: copy[locale].orders }));
  await screen.findByRole("button", { name: `${copy[locale].open}: ${s.workflow.order.orderNumber}` }); await fireEvent.press(screen.getByRole("button", { name: `${copy[locale].open}: ${s.workflow.order.orderNumber}` }));
  await screen.findByRole("button", { name: buyerReviewCopy[locale].start }); await fireEvent.press(screen.getByRole("button", { name: buyerReviewCopy[locale].start }));
}
async function fillAndReview(s: ReturnType<typeof backend>, locale: Locale = "ru") {
  const t = buyerReviewCopy[locale], before = s.fetcher.mock.calls.length;
  await fireEvent.press(screen.getByRole("radio", { name: `${t.overall}: 4` }));
  expect(screen.getByRole("radio", { name: `${t.overall}: 4` })).toHaveProp("accessibilityState", expect.objectContaining({ checked: true }));
  for (const key of reviewDimensions) await fireEvent.press(screen.getByRole("radio", { name: `${t.dimensions[key]}: 4` }));
  await fireEvent.changeText(screen.getByLabelText(t.comment), "  SYNTHETIC native отзыв  ");
  expect(s.fetcher).toHaveBeenCalledTimes(before); expect(s.uuid.randomUUID).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: t.review }));
  await screen.findByText(t.preview); expect(s.writes).toHaveLength(0); expect(s.uuid.randomUUID).toHaveBeenCalledTimes(1);
}

it.each(["ru", "kk"] as const)("sends a reviewed BUYER opinion through the actual native session once in %s", async locale => {
  const s = backend(), t = buyerReviewCopy[locale]; await open(s, locale); await fillAndReview(s, locale);
  expect(screen.getByText(`${t.comment}: SYNTHETIC native отзыв`)).toBeOnTheScreen(); await fireEvent.press(screen.getByRole("button", { name: t.confirm }));
  await screen.findByText(t.saved); expect(screen.getByText(`${t.response}: ${t.status.PENDING}`)).toBeOnTheScreen(); expect(s.writes).toHaveLength(1);
  const input = JSON.parse(s.writes[0].body); expect(input).toMatchObject({ productVariantId: null, overallRating: 4, comment: "SYNTHETIC native отзыв" }); expect(Object.keys(input.dimensions)).toHaveLength(7);
  expect(s.writes[0].init).toMatchObject({ method: "POST", credentials: "omit", redirect: "error", cache: "no-store", headers: { authorization: "Bearer synthetic-buyer-access-token", "x-organization-id": reviewScope.organizationId } }); expect(s.writes[0].init.headers).not.toHaveProperty("x-user-id");
  expect(s.fetcher.mock.calls.filter(([url]) => url.includes("/trust/") && !url.endsWith(`/trust/orders/${s.workflow.orderId}/reviews`))).toHaveLength(0);
});
it("retains the exact original native POST after unknown and permits only explicit same-body/key retry", async () => {
  const s = backend({ firstFailure: 500 }), t = buyerReviewCopy.ru; await open(s); await fillAndReview(s); await fireEvent.press(screen.getByRole("button", { name: t.confirm }));
  await screen.findByText(t.unknown); expect(s.writes).toHaveLength(1); expect(screen.queryByLabelText(t.comment)).toBeNull(); expect(screen.getByRole("button", { name: t.retry })).toBeEnabled();
  await fireEvent.press(screen.getByRole("button", { name: t.retry })); await screen.findByText(t.saved); expect(s.writes).toHaveLength(2); expect(s.writes[0].body).toBe(s.writes[1].body); expect(s.uuid.randomUUID).toHaveBeenCalledTimes(1);
});
it("displays server403 without claiming a saved review or automatically retrying", async () => {
  const s = backend({ firstFailure: 403 }), t = buyerReviewCopy.ru; await open(s); await fillAndReview(s); await fireEvent.press(screen.getByRole("button", { name: t.confirm }));
  await screen.findByRole("alert", { name: t.issue.denied }); expect(screen.queryByText(t.saved)).toBeNull(); expect(screen.queryByRole("button", { name: t.retry })).toBeNull(); expect(s.writes).toHaveLength(1); expect(s.fetcher.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(false);
});
it("does not display foreign receipt content or follow its returned identifier", async () => {
  const s = backend({ foreignReceipt: true }), t = buyerReviewCopy.ru; await open(s); await fillAndReview(s); await fireEvent.press(screen.getByRole("button", { name: t.confirm }));
  await screen.findByText(t.unknown); expect(screen.queryByText("SYNTHETIC foreign private receipt")).toBeNull(); expect(screen.queryByText(t.saved)).toBeNull(); expect(s.writes).toHaveLength(1);
  expect(s.fetcher.mock.calls.some(([url]) => url.includes(reviewId(11001)))).toBe(false);
});
it("clears the local review form and unknown state after the actual logout protocol", async () => {
  const s = backend({ firstFailure: 500 }), t = buyerReviewCopy.ru; await open(s); await fillAndReview(s); await fireEvent.press(screen.getByRole("button", { name: t.confirm })); await screen.findByText(t.unknown);
  await fireEvent.press(screen.getByRole("button", { name: sessionCopy.ru.logout })); await screen.findByLabelText(sessionCopy.ru.password);
  expect(screen.queryByText(t.unknown)).toBeNull(); expect(screen.queryByText(`${t.comment}: SYNTHETIC native отзыв`)).toBeNull(); expect(s.writes).toHaveLength(1);
});
it("binds an explicitly selected purchased variant to the native review request", async () => {
  const s = backend(), t = buyerReviewCopy.ru; await open(s); await fireEvent.press(screen.getByRole("radio", { name: `${t.line}: 1` })); await fillAndReview(s); await fireEvent.press(screen.getByRole("button", { name: t.confirm }));
  await screen.findByText(t.saved); expect(s.writes).toHaveLength(1); expect(JSON.parse(s.writes[0].body).productVariantId).toBe(s.workflow.order.items[0]!.productVariantId);
});
it("edits a prepared preview without sending and retains the exact raw comment until the next review", async () => {
  const s = backend(), t = buyerReviewCopy.ru; await open(s); await fillAndReview(s); await fireEvent.press(screen.getByRole("button", { name: t.edit }));
  expect(screen.getByLabelText(t.comment)).toHaveDisplayValue("  SYNTHETIC native отзыв  "); expect(s.writes).toHaveLength(0);
  await fireEvent.press(screen.getByRole("button", { name: t.review })); await screen.findByText(t.preview); expect(s.uuid.randomUUID).toHaveBeenCalledTimes(2); expect(s.writes).toHaveLength(0);
  await fireEvent.press(screen.getByRole("button", { name: t.confirm })); await screen.findByText(t.saved); expect(s.writes).toHaveLength(1);
});

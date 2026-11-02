import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { updateVerifiedReviewSchema } from "../../../packages/schemas/src/trust-commerce";
import { workspaceOrderPageSchema } from "../../../packages/schemas/src/workspace-reads";
import NativeMarketApp from "./NativeMarketApp";
import { buyerReviewDiscoveryCopy as discovery } from "./BuyerReviewDiscoveryUi";
import { buyerReviewCopy, buyerReviewUpdateCopy as updateCopy } from "./buyer-review-copy";
import type { BuyerReviewReceipt } from "./buyer-review-create";
import { copy } from "./i18n";
import { sessionCopy } from "./session-copy";
import type { Locale } from "./format-wire";
import { api, current, response, server, user, workspace } from "./test-fixtures/market-session";
import { reviewScope, reviewWorkflow, reviewInput, reviewReceipt, reviewId as id, reviewError } from "./test-fixtures/buyer-review";
import { listDraftPayload } from "./test-fixtures/list-draft";
jest.mock("expo/fetch", () => ({ fetch: jest.fn(() => { throw Error("Unexpected real native request"); }) }));
beforeEach(() => { jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-01T00:00:00Z")); });
afterEach(() => jest.restoreAllMocks());
function backend(options: { failure?: number; hidden?: boolean; empty?: boolean; expired?: boolean; updateFailure?: number; foreignPatch?: boolean } = {}) {
  const workflow = reviewWorkflow(), supplier = reviewReceipt(reviewInput(), workflow, reviewScope, { id: id(127020), status: "PUBLISHED", version: 8, ...(options.expired ? { editDeadline: "2026-10-30T01:02:03.000Z" } : {}) }), product = reviewReceipt({ ...reviewInput(id(127021)), productVariantId: workflow.order.items[0]!.productVariantId }, workflow, reviewScope, { id: id(127022), status: "PUBLISHED", version: 4 });
  const other = { ...supplier, id: id(127023), reviewerUserId: id(127024), comment: "SYNTHETIC other reviewer private text" };
  let rows: BuyerReviewReceipt[] = options.empty ? [other] : [supplier, product, other], effects = 0;
  if (options.hidden) rows = [{ ...supplier, status: "HIDDEN", comment: "SYNTHETIC hidden private review text" }];
  const patches: { path: string; body: string; init: RequestInit }[] = [], posts: string[] = [];
  const page = workspaceOrderPageSchema.parse({ items: [{ ...workflow.order, supplier: { id: workflow.order.supplierOrganizationId, displayName: "SYNTHETIC review supplier" }, buyer: { id: reviewScope.organizationId, displayName: "SYNTHETIC review buyer" }, itemCount: workflow.order.items.length }], nextCursor: null });
  const fetcher = server((path, init) => {
    if (path === "/auth/current?workspace=BUYER") return response(current({ user: { ...user, id: reviewScope.userId }, activeOrganizationId: reviewScope.organizationId, organizationIds: [reviewScope.organizationId], workspaces: [workspace(reviewScope.organizationId)] }));
    if (path.startsWith("/marketplace/search")) return response(listDraftPayload("catalog-empty"));
    if (path.startsWith("/workspaces/buyer/orders")) return response(page);
    if (path === `/supplier-orders/${workflow.orderId}/workflow`) return response(workflow);
    if (path === `/trust/suppliers/${workflow.order.supplierOrganizationId}/reviews`) return options.failure ? response(reviewError(options.failure).payload, options.failure) : response(rows);
    if (path.startsWith("/trust/orders/") && init.method === "POST") { posts.push(path); throw Error("Published edit must not create a review"); }
    if (path.startsWith("/trust/reviews/") && init.method === "PATCH") {
      patches.push({ path, body: String(init.body), init }); const input = updateVerifiedReviewSchema.strict().parse(JSON.parse(String(init.body))), prior = rows.find(row => path.endsWith(row.id))!;
      const saved = { ...prior, overallRating: input.overallRating, dimensions: input.dimensions, comment: input.comment ?? null, version: input.version + 1, updatedAt: "2026-11-01T00:00:00.000Z" }; rows = rows.map(row => row.id === prior.id ? saved : row); effects++;
      if (options.updateFailure) return response(reviewError(options.updateFailure).payload, options.updateFailure);
      return response(options.foreignPatch ? { ...saved, reviewerOrganizationId: id(129999), comment: "SYNTHETIC foreign update private text" } : saved);
    }
    return undefined;
  }); return { fetcher, workflow, supplier, product, patches, posts, effects: () => effects };
}
async function open(s: ReturnType<typeof backend>, locale: Locale = "ru") {
  await render(<StrictMode><NativeMarketApp initialApiUrl={api} fetcher={s.fetcher} reviewUuidProvider={{}} /></StrictMode>); if (locale === "kk") await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" })); await fireEvent.press(await screen.findByRole("tab", { name: copy[locale].orders })); await fireEvent.press(await screen.findByRole("button", { name: `${copy[locale].open}: ${s.workflow.order.orderNumber}` })); await screen.findByRole("button", { name: discovery[locale].find });
}
async function find(locale: Locale = "ru") { await fireEvent.press(screen.getByRole("button", { name: discovery[locale].find })); }
function chooseName(kind: "supplier" | "product", locale: Locale) { const c = buyerReviewCopy[locale]; return `${discovery[locale].edit}: ${kind === "supplier" ? c.supplier : `${c.product}: ${c.line} 1`}`; }
async function edit(s: ReturnType<typeof backend>, kind: "supplier" | "product" = "supplier", locale: Locale = "ru") {
  await open(s, locale); await find(locale); await fireEvent.press(await screen.findByRole("button", { name: chooseName(kind, locale) })); await screen.findByLabelText(buyerReviewCopy[locale].comment); expect(screen.getByLabelText(buyerReviewCopy[locale].comment)).toHaveDisplayValue(reviewInput().comment!); await fireEvent.changeText(screen.getByLabelText(buyerReviewCopy[locale].comment), "  SYNTHETIC discovered edit text  "); await fireEvent.changeText(screen.getByLabelText(updateCopy[locale].reason), "  SYNTHETIC discovered edit reason  "); await fireEvent.press(screen.getByRole("button", { name: updateCopy[locale].review })); await screen.findByRole("button", { name: updateCopy[locale].confirm });
}
it.each((["supplier", "product"] as const).flatMap(kind => (["ru", "kk"] as const).map(locale => ({ kind, locale }))))("discovers and explicitly edits pre-existing native$kind review in$locale without UUID or CREATE", async ({ kind, locale }) => {
  const s = backend(), u = updateCopy[locale]; await edit(s, kind, locale); expect(s.patches).toHaveLength(0); expect(s.posts).toHaveLength(0); await fireEvent.press(screen.getByRole("button", { name: u.confirm })); await screen.findByText(u.saved);
  expect(s.patches).toHaveLength(1); expect(s.patches[0].path).toBe(`/trust/reviews/${kind === "supplier" ? s.supplier.id : s.product.id}`); expect(JSON.parse(s.patches[0].body)).toEqual({ overallRating: 4, dimensions: reviewInput().dimensions, comment: "SYNTHETIC discovered edit text", version: kind === "supplier" ? 8 : 4, reason: "SYNTHETIC discovered edit reason" }); expect(s.patches[0].init).toMatchObject({ method: "PATCH", credentials: "omit", headers: { authorization: "Bearer synthetic-buyer-access-token", "x-organization-id": reviewScope.organizationId } }); expect(s.posts).toHaveLength(0); expect(s.effects()).toBe(1); expect(screen.queryByText("SYNTHETIC other reviewer private text")).toBeNull();
});
it("keeps a missing own row as an empty source window without claiming all reviews absent", async () => { const s = backend({ empty: true }); await open(s); expect(s.fetcher.mock.calls.some(([url]) => url.includes("/trust/suppliers/"))).toBe(false); await find(); await screen.findByText(discovery.ru.empty); expect(screen.getByText(discovery.ru.body)).toBeOnTheScreen(); expect(screen.queryByRole("button", { name: chooseName("supplier", "ru") })).toBeNull(); expect(s.posts).toHaveLength(0); expect(s.patches).toHaveLength(0); });
it("rejects a nonpublished source window before showing private own review text", async () => { const s = backend({ hidden: true }); await open(s); await find(); await screen.findByText(buyerReviewCopy.ru.issue.contract); expect(screen.queryByText("SYNTHETIC hidden private review text")).toBeNull(); expect(screen.queryByRole("button", { name: chooseName("supplier", "ru") })).toBeNull(); });
it("shows found expired review while disabling its edit entry", async () => { const s = backend({ expired: true }); await open(s); await find(); expect(await screen.findByRole("button", { name: chooseName("supplier", "ru") })).toBeDisabled(); expect(screen.getByRole("button", { name: chooseName("product", "ru") })).toBeEnabled(); expect(s.patches).toHaveLength(0); });
it("keeps source403 separate from an empty own-review window", async () => { const s = backend({ failure: 403 }); await open(s); await find(); await screen.findByText(buyerReviewCopy.ru.issue.denied); expect(screen.queryByText(discovery.ru.empty)).toBeNull(); expect(screen.getByRole("button", { name: discovery.ru.refresh })).toBeEnabled(); });
it("preserves a lost discovered PATCH separately from an independently observed newer published version", async () => { const s = backend({ updateFailure: 500 }), u = updateCopy.ru; await edit(s); await fireEvent.press(screen.getByRole("button", { name: u.confirm })); await screen.findByText(u.unknown); expect(screen.queryByRole("button", { name: u.confirm })).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: u.observe })); await screen.findByText(u.observed); expect(screen.getByText(u.unknown)).toBeOnTheScreen(); expect(screen.queryByText(u.saved)).toBeNull(); expect(s.patches).toHaveLength(1); expect(s.effects()).toBe(1); expect(s.posts).toHaveLength(0); });
it("does not display a foreign discovered-review PATCH as a saved edit", async () => { const s = backend({ foreignPatch: true }), u = updateCopy.ru; await edit(s); await fireEvent.press(screen.getByRole("button", { name: u.confirm })); await screen.findByText(u.unknown); expect(screen.queryByText("SYNTHETIC foreign update private text")).toBeNull(); expect(screen.queryByText(u.saved)).toBeNull(); });
it("clears discovered own review rows and its prepared edit on confirmed logout", async () => { const s = backend(); await edit(s); await fireEvent.press(screen.getByRole("button", { name: sessionCopy.ru.logout })); await screen.findByLabelText(sessionCopy.ru.password); expect(screen.queryByLabelText(buyerReviewCopy.ru.comment)).toBeNull(); expect(screen.queryByText(discovery.ru.title)).toBeNull(); expect(s.posts).toHaveLength(0); expect(s.patches).toHaveLength(0); });

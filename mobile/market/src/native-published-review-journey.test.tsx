import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import NativeMarketApp from "./NativeMarketApp";
import { reviewCopy } from "./PublishedReviewsRead";
import { copy } from "./i18n";
import { sessionCopy } from "./session-copy";
import type { Locale } from "./format-wire";
import { api, current, response, server, user, workspace } from "./test-fixtures/market-session";
import { listDraftPayload, listDraftScope, listDraftId as id } from "./test-fixtures/list-draft";
import { reviewComparison, productReviewWindow, supplierReview, reviewEnvelope } from "./test-fixtures/published-reviews";
jest.mock("expo/fetch", () => ({ fetch: jest.fn(() => { throw Error("Unexpected real native request"); }) }));
type Kind = "product" | "supplier";
function backend(options: { failure?: number; invalid?: "product" | "supplier" | "hidden" } = {}) {
  const comparison = reviewComparison(), product = productReviewWindow(), supplier = supplierReview({ comment: "SYNTHETIC published supplier review" });
  if (options.invalid === "product") { product.reviews[0]!.productVariantId = id(129999); product.reviews[0]!.comment = "SYNTHETIC foreign private product review"; }
  if (options.invalid === "supplier") { supplier.supplierOrganizationId = id(129999); supplier.comment = "SYNTHETIC foreign private supplier review"; }
  if (options.invalid === "hidden") { supplier.status = "HIDDEN"; supplier.comment = "SYNTHETIC hidden private review"; }
  const fetcher = server((path, init) => {
    if (path === "/auth/current?workspace=BUYER") return response(current({ user: { ...user, id: listDraftScope.userId }, activeOrganizationId: listDraftScope.organizationId, organizationIds: [listDraftScope.organizationId], workspaces: [workspace(listDraftScope.organizationId)] }));
    if (path.startsWith("/marketplace/search")) return response(listDraftPayload("catalog-null-price"));
    if (path.includes("/compare")) return response(comparison);
    if (path.startsWith("/trust/") && path.endsWith("/reviews")) { expect(init.method).toBe("GET"); if (options.failure) return response(reviewEnvelope(options.failure).payload, options.failure); return response(path.includes("/products/") ? product : [supplier]); }
    return undefined;
  }); return { fetcher, comparison };
}
async function open(s: ReturnType<typeof backend>, kind: Kind, locale: Locale = "ru") { await render(<StrictMode><NativeMarketApp initialApiUrl={api} fetcher={s.fetcher} reviewUuidProvider={{}} /></StrictMode>); if (locale === "kk") await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" })); const c = copy[locale], t = reviewCopy[locale]; await fireEvent.press(await screen.findByRole("button", { name: `${c.open}: SYNTHETIC product, SYNTHETIC variant` })); if (kind === "supplier") await fireEvent.press(await screen.findByRole("button", { name: `${c.open}: SYNTHETIC supplier` })); await fireEvent.press(await screen.findByRole("button", { name: kind === "product" ? t.productOpen : t.supplierOpen })); }
it.each((["product", "supplier"] as const).flatMap(kind => (["ru", "kk"] as const).map(locale => ({ kind, locale }))))("reads native published$kind reviews and returns to the captured selection in$locale", async ({ kind, locale }) => { const s = backend(), t = reviewCopy[locale]; await open(s, kind, locale); await screen.findByText(kind === "product" ? "SYNTHETIC justified negative product review" : "SYNTHETIC published supplier review"); expect(screen.getByText(kind === "product" ? t.productWindow : t.supplierWindow)).toBeOnTheScreen(); const target = kind === "product" ? s.comparison.product.id : s.comparison.offers[0]!.supplier.organizationId, path = `/trust/${kind === "product" ? "products" : "suppliers"}/${target}/reviews`, calls = s.fetcher.mock.calls.filter(([url]) => url.endsWith(path)); expect(calls).toHaveLength(1); expect(calls[0][1]).toMatchObject({ method: "GET", credentials: "omit", headers: { authorization: "Bearer synthetic-buyer-access-token" } }); expect(calls[0][1].headers).not.toHaveProperty("x-user-id"); expect(calls[0][1].headers).not.toHaveProperty("x-organization-id"); await fireEvent.press(screen.getByRole("button", { name: t.back })); await screen.findByRole("button", { name: kind === "product" ? t.productOpen : t.supplierOpen }); expect(s.fetcher.mock.calls.filter(([url]) => url.endsWith(path))).toHaveLength(1); });
it.each(["product", "supplier", "hidden"] as const)("rejects native published review%s response before rendering foreign/private text", async invalid => { const s = backend({ invalid }); await open(s, invalid === "product" ? "product" : "supplier"); await screen.findByRole("alert"); expect(screen.queryByText(/SYNTHETIC (?:foreign|hidden) private/)).toBeNull(); expect(screen.queryByText(/SYNTHETIC justified|SYNTHETIC published supplier/)).toBeNull(); });
it("keeps native review403 distinct without refreshing or displaying raw server errors", async () => { const s = backend({ failure: 403 }); await open(s, "product"); await screen.findByText(copy.ru.denied); expect(screen.queryByText("SYNTHETIC private review error")).toBeNull(); expect(s.fetcher.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(false); });
it("clears native published review text on confirmed logout", async () => { const s = backend(); await open(s, "supplier"); await screen.findByText("SYNTHETIC published supplier review"); await fireEvent.press(screen.getByRole("button", { name: sessionCopy.ru.logout })); await screen.findByLabelText(sessionCopy.ru.password); expect(screen.queryByText("SYNTHETIC published supplier review")).toBeNull(); expect(s.fetcher.mock.calls.filter(([url, init]) => !url.includes("/auth/") && init.method !== "GET")).toHaveLength(0); });

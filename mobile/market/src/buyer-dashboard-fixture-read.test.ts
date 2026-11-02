import { jest } from "@jest/globals";
import { createBuyerDashboardFixtureRead, decodeBuyerDashboardFixture, type BuyerDashboardFixturePort } from "./buyer-dashboard-fixture-read";
import { buyerDashboardFixture, dashboardId, dashboardScope } from "./test-fixtures/buyer-dashboard";
const envelope = (status: number) => ({ status, payload: { statusCode: status, code: "SYNTHETIC_CODE", message: "SYNTHETIC private dashboard error", path: "/owner/buyer/dashboard", timestamp: "2026-10-29T01:02:03.000Z" } });
it("keeps server counter meanings independent from recent window/cart rows or saved-list data", () => {
  const raw = buyerDashboardFixture(); expect(decodeBuyerDashboardFixture(raw, dashboardScope)).toEqual(raw); const empty = buyerDashboardFixture({ activeCart: null, recentOrders: [], pendingOrders: 100, savedLists: 9 }); expect(decodeBuyerDashboardFixture(empty, dashboardScope)).toEqual(empty);
});
it("never reads or emits excluded month/budgets/technical/personal/order item fields", () => {
  const raw = buyerDashboardFixture(), hidden = jest.fn(() => { throw new Error("Excluded private field read"); });
  for (const key of ["month", "budgets", "generatedAt", "secret"]) Object.defineProperty(raw, key, { get: hidden });
  for (const key of ["items", "subtotalAmountMinor", "paymentStatus", "version", "requesterEmail"]) Object.defineProperty(raw.recentOrders[0]!, key, { get: hidden });
  const result = decodeBuyerDashboardFixture(raw, dashboardScope)!; expect(result).toEqual(buyerDashboardFixture()); expect(hidden).not.toHaveBeenCalled(); expect(Object.keys(result).sort()).toEqual(["activeCart", "pendingOrders", "recentOrders", "savedLists"]);
});
it("rejects foreign order buyer context before decoding counts/names/supplier or other content", () => {
  const raw = buyerDashboardFixture(), hidden = jest.fn(() => { throw new Error("Foreign content read"); }); raw.recentOrders[0]!.buyerOrganizationId = dashboardId(99); Object.defineProperty(raw.recentOrders[0]!, "orderNumber", { get: hidden }); Object.defineProperty(raw, "pendingOrders", { get: hidden }); expect(decodeBuyerDashboardFixture(raw, dashboardScope)).toBeNull(); expect(hidden).not.toHaveBeenCalled();
});
it.each(["null", "array", "missing-count", "negative-count", "fraction-count", "unsafe-count", "null-counter", "missing-cart", "invalid-cart-id", "null-items-count", "missing-date", "null-orders", "duplicate-order", "nine-orders", "missing-supplier", "invalid-order-id"])("rejects malformed/partial %s without zero/default substitution or row salvage", variant => {
  const raw = buyerDashboardFixture(); let body: unknown = raw;
  if (variant === "null") body = null; if (variant === "array") body = [raw]; if (variant === "missing-count") body = { ...raw, pendingOrders: undefined }; if (variant === "negative-count") raw.pendingOrders = -1; if (variant === "fraction-count") raw.savedLists = 1.5; if (variant === "unsafe-count") raw.savedLists = Number.MAX_SAFE_INTEGER + 1; if (variant === "null-counter") body = { ...raw, savedLists: null };
  if (variant === "missing-cart") body = { ...raw, activeCart: undefined }; if (variant === "invalid-cart-id") raw.activeCart!.id = "SYNTHETIC invalid"; if (variant === "null-items-count") body = { ...raw, activeCart: { ...raw.activeCart, itemCount: null } }; if (variant === "missing-date") body = { ...raw, activeCart: { ...raw.activeCart, updatedAt: undefined } };
  if (variant === "null-orders") body = { ...raw, recentOrders: null }; if (variant === "duplicate-order") raw.recentOrders.push(raw.recentOrders[0]!); if (variant === "nine-orders") raw.recentOrders = Array.from({ length: 9 }, (_, n) => ({ ...raw.recentOrders[0]!, id: dashboardId(100 + n) })); if (variant === "missing-supplier") body = { ...raw, recentOrders: [{ ...raw.recentOrders[0], supplier: undefined }] }; if (variant === "invalid-order-id") raw.recentOrders[0]!.id = "SYNTHETIC invalid";
  expect(decodeBuyerDashboardFixture(body, dashboardScope)).toBeNull();
});
it("preserves provided order and raw business text/date/status without inventing version/snapshot timestamp", () => {
  const raw = buyerDashboardFixture(); raw.recentOrders = Array.from({ length: 8 }, (_, n) => ({ ...raw.recentOrders[0]!, id: dashboardId(100 + n), orderNumber: `  SYNTHETIC ${n}  `, status: n ? "PAID" : "SYNTHETIC_FUTURE_STATE", createdAt: n ? raw.recentOrders[0]!.createdAt : "SYNTHETIC unavailable date" })); const result = decodeBuyerDashboardFixture(raw, dashboardScope)!;
  expect(result.recentOrders).toEqual(raw.recentOrders); expect(result).not.toHaveProperty("version"); expect(result).not.toHaveProperty("generatedAt");
});
it("a null cart and zero supplied counters are real ready data, with no default live/sample reader", async () => {
  const raw = buyerDashboardFixture({ activeCart: null, pendingOrders: 0, savedLists: 0, recentOrders: [] }), model = createBuyerDashboardFixtureRead(dashboardScope, async () => raw); await model.load(); expect(model.getState()).toEqual({ phase: "ready", read: { kind: "buyer-dashboard", value: raw } }); const absent = createBuyerDashboardFixtureRead(dashboardScope); await absent.load(); expect(absent.getState()).toEqual({ phase: "unavailable" });
});
it("captures frozen scope before awaiting and never rebinds a pending read to changed caller context", async () => {
  const scope = { ...dashboardScope }, port = jest.fn<BuyerDashboardFixturePort>().mockResolvedValue(buyerDashboardFixture()), model = createBuyerDashboardFixtureRead(scope, port); scope.organizationId = dashboardId(99); await model.load(); expect(port).toHaveBeenCalledWith(dashboardScope); expect(Object.isFrozen(port.mock.calls[0]![0])).toBe(true); expect(model.getState().phase).toBe("ready");
});
it.each([[401, "authentication-required"], [403, "denied"], [404, "unavailable"], [429, "retry-limited"], [500, "error"]] as const)("maps validated %s to %s without retaining old rows or private prose", async (status, phase) => {
  const port = jest.fn<BuyerDashboardFixturePort>().mockResolvedValueOnce(buyerDashboardFixture()).mockRejectedValueOnce(envelope(status)), model = createBuyerDashboardFixtureRead(dashboardScope, port); await model.load(); await model.load(); expect(model.getState()).toEqual({ phase }); expect(JSON.stringify(model.getState())).not.toContain("private");
});
it("handles plain offline and contradictory envelopes honestly", async () => {
  const port = jest.fn<BuyerDashboardFixturePort>().mockRejectedValueOnce(new Error("SYNTHETIC private offline")).mockRejectedValueOnce({ status: 403, payload: envelope(401).payload }), model = createBuyerDashboardFixtureRead(dashboardScope, port); await model.load(); expect(model.getState()).toEqual({ phase: "error" }); await model.load(); expect(model.getState()).toEqual({ phase: "contract-error" });
});
it("applies only the latest completion and reset discards a late response/error without decoding it", async () => {
  let first!: (body: unknown) => void, second!: (body: unknown) => void; const port = jest.fn<BuyerDashboardFixturePort>().mockImplementationOnce(() => new Promise(yes => { first = yes; })).mockImplementationOnce(() => new Promise(yes => { second = yes; })); const model = createBuyerDashboardFixtureRead(dashboardScope, port), old = model.load(), fresh = model.load(); second(buyerDashboardFixture({ pendingOrders: 99 })); expect(await fresh).toBe("applied"); first(null); expect(await old).toBe("discarded"); expect(model.getState()).toMatchObject({ read: { value: { pendingOrders: 99 } } });
  let reject!: (error: unknown) => void; port.mockImplementationOnce(() => new Promise((_yes, no) => { reject = no; })); const pending = model.load(), hidden = jest.fn(() => { throw new Error("Stale error read"); }); model.reset(); const stale = {}; Object.defineProperty(stale, "status", { get: hidden }); Object.defineProperty(stale, "payload", { get: hidden }); reject(stale); expect(await pending).toBe("discarded"); expect(hidden).not.toHaveBeenCalled(); expect(model.getState()).toEqual({ phase: "idle" });
});

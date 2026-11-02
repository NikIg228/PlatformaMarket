import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { jest } from "@jest/globals";
import { checkoutIntentFixturePointer, createPaymentIntentFixtureRead, decodePaymentIntentFixture, fixtureIntentStatuses, type PaymentIntentFixturePort } from "./payment-intent-fixture-read";
import { intentCheckout, paymentIntentFixture, intentScope, intentId, intentTarget } from "./test-fixtures/payment-intent";
import { listDraftId } from "./test-fixtures/list-draft";
import { intentStatusLabel } from "./i18n";
const envelope = (status: number) => ({ status, payload: { statusCode: status, code: "SYNTHETIC_CODE", message: "SYNTHETIC private payment error", path: `/payment-intents/${intentId}`, timestamp: "2026-10-29T01:02:03.000Z" } });
it("uses only the actual Prisma intent status vocabulary and localizes each in RU/KK with safe unknown", () => {
  const source = readFileSync(resolve(__dirname, "../../../apps/api/prisma/schema.prisma"), "utf8"), block = /enum PaymentIntentStatus\s*\{([^}]+)\}/.exec(source)![1]!.trim().split(/\s+/); expect(fixtureIntentStatuses).toEqual(block);
  for (const locale of ["ru", "kk"] as const) { for (const status of fixtureIntentStatuses) expect(intentStatusLabel(status, locale)).not.toBe(status); expect(intentStatusLabel("SYNTHETIC_FUTURE_STATUS", locale)).not.toContain("SYNTHETIC"); }
});
it("projects a separately validated raw checkout relation, distinguishing explicit null from unknown/thin/unbound data", () => {
  expect(checkoutIntentFixturePointer(intentCheckout(), intentScope.organizationId)).toEqual({ kind: "available", id: intentId, status: "CAPTURED" }); expect(checkoutIntentFixturePointer(intentCheckout(null), intentScope.organizationId)).toEqual({ kind: "none" });
  for (const raw of [undefined, {}, { id: intentId, status: "CAPTURED" }, { ...paymentIntentFixture(), checkoutId: listDraftId(99) }, { ...paymentIntentFixture(), buyerOrganizationId: listDraftId(99) }]) expect(checkoutIntentFixturePointer(intentCheckout(raw), intentScope.organizationId)).toEqual({ kind: "unavailable" });
});
it("rejects foreign pointer identities before status or excluded data and does not parse passthrough secrets", () => {
  const foreign = paymentIntentFixture({ buyerOrganizationId: listDraftId(99) }), hidden = jest.fn(() => { throw new Error("Foreign pointer/private field read"); }); Object.defineProperty(foreign, "status", { get: hidden }); const checkout = intentCheckout(foreign); expect(checkoutIntentFixturePointer(checkout, intentScope.organizationId)).toEqual({ kind: "unavailable" }); expect(hidden).not.toHaveBeenCalled();
  const good = paymentIntentFixture(); Object.defineProperty(good, "allocations", { get: hidden }); expect(checkoutIntentFixturePointer(intentCheckout(good), intentScope.organizationId).kind).toBe("available"); expect(hidden).not.toHaveBeenCalled();
});
it("keeps exact source amount/currency/status/date without scaling, sums, expiry transitions or summary fallback", () => {
  const raw = paymentIntentFixture({ status: "PENDING", expiresAt: "2001-01-01T00:00:00.000Z" }), read = decodePaymentIntentFixture(raw, intentScope, intentTarget)!; expect(read.totalAmountMinor).toBe("90071992547409931234"); expect(read.currency).toBe("KZT"); expect(read.status).toBe("PENDING"); expect(read.expiresAt).toBe(raw.expiresAt); expect(read).not.toHaveProperty("paidAmount"); expect(read).not.toHaveProperty("balance"); expect(read).not.toHaveProperty("receipt");
});
it.each(["intent", "checkout", "buyer", "provider"] as const)("rejects mismatched %s identity before allowed/excluded display values", variant => {
  const raw = paymentIntentFixture(), hidden = jest.fn(() => { throw new Error("Mismatched display field read"); }); if (variant === "intent") raw.id = listDraftId(99); if (variant === "checkout") raw.checkoutId = listDraftId(99); if (variant === "buyer") raw.buyerOrganizationId = listDraftId(99); if (variant === "provider") raw.provider.id = listDraftId(99); Object.defineProperty(raw, "totalAmountMinor", { get: hidden }); Object.defineProperty(raw.provider, "name", { get: hidden }); expect(decodePaymentIntentFixture(raw, intentScope, intentTarget)).toBeNull(); expect(hidden).not.toHaveBeenCalled();
});
it("never reads or projects allocations/fees/merchant/provider config/sessions/tokens/URLs or nested checkout", () => {
  const raw = paymentIntentFixture(), hidden = jest.fn(() => { throw new Error("Excluded financial/private field read"); });
  for (const key of ["allocations", "fees", "merchantAccounts", "sessions", "authorization", "captures", "transactions", "refunds", "attempts", "checkout", "idempotencyKey", "redirectUrl", "token", "bankAccount"]) Object.defineProperty(raw, key, { get: hidden });
  for (const key of ["capabilities", "config", "credentials", "secret", "redirectUrl"]) Object.defineProperty(raw.provider, key, { get: hidden });
  const result = decodePaymentIntentFixture(raw, intentScope, intentTarget)!; expect(result.totalAmountMinor).toBe(raw.totalAmountMinor); expect(result.provider).toEqual({ name: raw.provider.name, code: "MOCK" }); expect(hidden).not.toHaveBeenCalled(); expect(Object.keys(result).sort()).toEqual(["buyerOrganizationId", "checkoutId", "createdAt", "currency", "expiresAt", "id", "provider", "status", "totalAmountMinor", "updatedAt"]);
});
it.each([0, 9007199254740992, 0n, null, undefined, "", "1.5", "1e5", "9".repeat(21)])("keeps unsupported amount %# unknown rather than converting or substituting zero", amount => {
  const raw = { ...paymentIntentFixture(), totalAmountMinor: amount }, read = decodePaymentIntentFixture(raw, intentScope, intentTarget)!; expect(read.totalAmountMinor).toBeNull();
});
it.each(["0", "-1", "9".repeat(20)])("preserves representable exact integer text %s without a new positivity/financial policy", amount => { expect(decodePaymentIntentFixture(paymentIntentFixture({ totalAmountMinor: amount }), intentScope, intentTarget)?.totalAmountMinor).toBe(amount); });
it("quarantines unsupported optional metadata and does not infer provider/MOCK without its own binding", () => {
  const hidden = jest.fn(() => { throw new Error("Unbound provider fields read"); }), provider = {}; Object.defineProperty(provider, "name", { get: hidden }); Object.defineProperty(provider, "code", { get: hidden });
  const raw = { ...paymentIntentFixture(), currency: null, providerId: undefined, provider, createdAt: undefined, updatedAt: 5, expiresAt: 5 }; const read = decodePaymentIntentFixture(raw, intentScope, intentTarget)!; expect(read).toMatchObject({ currency: null, provider: null, createdAt: undefined, updatedAt: undefined, expiresAt: undefined }); expect(hidden).not.toHaveBeenCalled();
});
it.each([null, [], {}, { ...paymentIntentFixture(), status: null }, { ...paymentIntentFixture(), status: undefined }])("rejects an absent/malformed core intent %# rather than treating it as no existing intent", body => { expect(decodePaymentIntentFixture(body, intentScope, intentTarget)).toBeNull(); });
it("validates selectors before calling a fixture port and has no default read/live target", async () => {
  const port = jest.fn<PaymentIntentFixturePort>().mockResolvedValue(paymentIntentFixture()), model = createPaymentIntentFixtureRead(intentScope, port); await model.load({ ...intentTarget, paymentIntentId: "SYNTHETIC invalid" }); expect(port).not.toHaveBeenCalled(); expect(model.getState()).toEqual({ phase: "contract-error" }); const none = createPaymentIntentFixtureRead(intentScope); await none.load(intentTarget); expect(none.getState()).toEqual({ phase: "unavailable" });
});
it("captures frozen selectors/scope and refresh repeats only that exact independent read", async () => {
  const scope = { ...intentScope }, target = { ...intentTarget }, port = jest.fn<PaymentIntentFixturePort>().mockResolvedValue(paymentIntentFixture()), model = createPaymentIntentFixtureRead(scope, port); const loading = model.load(target); scope.organizationId = listDraftId(99); target.paymentIntentId = listDraftId(98); await loading; await model.refresh(); expect(port).toHaveBeenNthCalledWith(1, intentScope, intentTarget); expect(port).toHaveBeenNthCalledWith(2, intentScope, intentTarget); expect(Object.isFrozen(port.mock.calls[0]![0])).toBe(true); expect(Object.isFrozen(port.mock.calls[0]![1])).toBe(true); expect(model.getState().phase).toBe("ready");
});
it.each([[401, "authentication-required"], [403, "denied"], [404, "unavailable"], [429, "retry-limited"], [500, "error"]] as const)("maps validated %s to %s without private prose or old state", async (status, phase) => {
  const port = jest.fn<PaymentIntentFixturePort>().mockResolvedValueOnce(paymentIntentFixture()).mockRejectedValueOnce(envelope(status)), model = createPaymentIntentFixtureRead(intentScope, port); await model.load(intentTarget); await model.refresh(); expect(model.getState()).toEqual({ phase }); expect(JSON.stringify(model.getState())).not.toContain("private");
});
it("handles offline/contradictory envelopes and reset drops late success/error without decoding it", async () => {
  const port = jest.fn<PaymentIntentFixturePort>().mockRejectedValueOnce(new Error("SYNTHETIC offline")).mockRejectedValueOnce({ status: 403, payload: envelope(401).payload }), model = createPaymentIntentFixtureRead(intentScope, port); await model.load(intentTarget); expect(model.getState()).toEqual({ phase: "error" }); await model.refresh(); expect(model.getState()).toEqual({ phase: "contract-error" });
  let finish!: (body: unknown) => void; port.mockReturnValueOnce(new Promise(yes => { finish = yes; })); const pending = model.load(intentTarget); model.reset(); finish(paymentIntentFixture()); expect(await pending).toBe("discarded"); expect(model.getState()).toEqual({ phase: "idle" }); expect(await model.refresh()).toBe("no-query");
});
it("only the latest intent/checkout target may complete, and a late reset error is never inspected", async () => {
  let first!: (body: unknown) => void, second!: (body: unknown) => void; const port = jest.fn<PaymentIntentFixturePort>().mockReturnValueOnce(new Promise(yes => { first = yes; })).mockReturnValueOnce(new Promise(yes => { second = yes; })), model = createPaymentIntentFixtureRead(intentScope, port), next = { paymentIntentId: listDraftId(920), checkoutId: listDraftId(921) }; const old = model.load(intentTarget), fresh = model.load(next); second(paymentIntentFixture({ id: next.paymentIntentId, checkoutId: next.checkoutId })); expect(await fresh).toBe("applied"); first(paymentIntentFixture()); expect(await old).toBe("discarded"); expect(model.getState()).toMatchObject({ read: { value: { id: next.paymentIntentId, checkoutId: next.checkoutId } } });
  let reject!: (error: unknown) => void; port.mockReturnValueOnce(new Promise((_yes, no) => { reject = no; })); const late = model.load(intentTarget), hidden = jest.fn(() => { throw new Error("Stale error inspected"); }), error = {}; Object.defineProperty(error, "status", { get: hidden }); Object.defineProperty(error, "payload", { get: hidden }); model.reset(); reject(error); expect(await late).toBe("discarded"); expect(hidden).not.toHaveBeenCalled();
});

import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { CartResponse } from "../../../packages/schemas/src/core-api";
import { addCartItemSchema, cartVersionSchema, checkoutCartSchema, createCartSchema, repriceCartSchema, updateCartItemSchema } from "../../../packages/schemas/src/index";
import NativeMarketApp from "./NativeMarketApp";
import { nativeCartCommandCopy as quantityCopy } from "./CartCommandUi";
import { nativeCartWorkspaceCommandCopy as workspaceCopy } from "./CartWorkspaceCommandUi";
import { nativeCartAddCopy as addCopy } from "./CartAddCommandUi";
import { nativeCartValidationCopy as validationCopy } from "./CartValidationUi";
import { nativeCartRepriceCopy as repriceCopy } from "./CartRepriceUi";
import { nativeCartCheckoutCopy as checkoutCopy } from "./CartCheckoutUi";
import { copy } from "./i18n";
import { sessionCopy } from "./session-copy";
import type { Locale } from "./format-wire";
import { api, current, response, server, user, workspace } from "./test-fixtures/market-session";
import { listDraftPayload, listDraftScope, listDraftId as id } from "./test-fixtures/list-draft";
import { commandCart, createdCartResult, recoveryCartSource, recoveredCartResult, quantityCartResult, removedCartResult, cartAddComparison, addCommandCart, addCartItemResult, cartCommandError } from "./test-fixtures/cart-commands";
import { savedPage } from "./test-fixtures/carts";
import { cartValidationResult } from "./test-fixtures/cart-validation";
import { repriceValidation, repriceResult } from "./test-fixtures/cart-reprice";
import { cartCheckoutReceipt } from "./test-fixtures/cart-checkout";
jest.mock("expo/fetch", () => ({ fetch: jest.fn(() => { throw Error("Unexpected real native request"); }) }));
function backend(options: { initial?: "none" | "failed" | "add"; failure?: number; changedTerms?: boolean; foreign?: boolean; checkoutStatus?: "PROCESSING" | "COMPLETED" | "FAILED" } = {}) {
  let truth: CartResponse | null = options.initial === "none" || options.initial === "failed" ? null : options.initial === "add" ? addCommandCart() : commandCart();
  const failed = recoveryCartSource(), comparison = cartAddComparison(), writes: { path: string; body?: string; init: RequestInit }[] = [];
  let effects = 0, receipt: ReturnType<typeof cartCheckoutReceipt> | undefined;
  const fetcher = server((path, init) => {
    if (path === "/auth/current?workspace=BUYER") return response(current({ user: { ...user, id: listDraftScope.userId }, activeOrganizationId: listDraftScope.organizationId, organizationIds: [listDraftScope.organizationId], workspaces: [workspace(listDraftScope.organizationId)] }));
    if (path.startsWith("/marketplace/search")) return response(listDraftPayload("catalog-null-price"));
    if (path.includes("/compare")) return response(comparison);
    if (path.startsWith("/workspaces/buyer/carts?")) return response(savedPage(truth?.status === "ACTIVE" && truth.checkout === null ? truth : null, options.initial === "failed" ? [failed] : []));
    if (path.startsWith("/workspaces/buyer/carts/")) return response(truth);
    if (path.startsWith("/checkouts/")) return response(receipt);
    if ((path.startsWith("/carts/") || path === `/buyers/${listDraftScope.organizationId}/carts`) && init.method !== "GET") {
      writes.push({ path, body: init.body === undefined ? undefined : String(init.body), init });
      if (options.failure === 403 || options.failure === 409) return response(cartCommandError(options.failure).payload, options.failure);
      const body: unknown = init.body === undefined ? undefined : JSON.parse(String(init.body)); let result: unknown;
      if (path.startsWith("/buyers/")) { const input = createCartSchema.strict().parse(body); truth = createdCartResult(); truth.currency = input.currency; truth.items = []; result = truth; }
      else if (path.endsWith("/recover")) { cartVersionSchema.parse(body); truth = recoveredCartResult(); failed.recoveredCartId = truth.id; result = truth; }
      else if (path.endsWith("/validate")) { expect(init.body).toBeUndefined(); return response(options.changedTerms ? repriceValidation(truth!) : cartValidationResult(truth!)); }
      else if (path.endsWith("/reprice")) { const input = repriceCartSchema.parse(body); truth = repriceResult(truth!, input); result = truth; }
      else if (path.endsWith("/checkout")) { const input = checkoutCartSchema.strict().parse(body); if (!receipt) { receipt = cartCheckoutReceipt(truth!, input, options.checkoutStatus); effects++; } result = receipt; }
      else if (init.method === "PATCH") { const input = updateCartItemSchema.parse(body); truth = quantityCartResult(input); result = options.foreign ? { ...truth, buyerOrganizationId: id(129999), currency: "PRIVATE" } : truth; }
      else if (init.method === "DELETE") { const input = cartVersionSchema.parse(body); truth = removedCartResult(truth!, truth!.items[0]!.id, input); result = truth; }
      else if (path.endsWith("/items")) { const input = addCartItemSchema.strict().parse(body); const row = addCartItemResult(truth!, input); truth = { ...truth!, version: truth!.version + 1, items: [row] }; result = row; }
      else throw Error("Unexpected cart source route");
      if (!path.endsWith("/checkout")) effects++;
      if (options.failure === 500 && writes.length === (path.endsWith("/checkout") ? 2 : 1)) return response(cartCommandError(500).payload, 500);
      return response(result, 201);
    }
    return undefined;
  });
  return { fetcher, writes, effects: () => effects, current: () => truth, comparison };
}
async function start(s: ReturnType<typeof backend>, locale: Locale = "ru", entropy = true) {
  const uuid = jest.fn(() => id(123101)); await render(<StrictMode><NativeMarketApp initialApiUrl={api} fetcher={s.fetcher} reviewUuidProvider={entropy ? { randomUUID: uuid } : {}} /></StrictMode>);
  if (locale === "kk") await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" })); await screen.findByText("SYNTHETIC product"); return uuid;
}
async function openCart(s: ReturnType<typeof backend>, locale: Locale = "ru", entropy = true) { const uuid = await start(s, locale, entropy); await fireEvent.press(screen.getByRole("tab", { name: copy[locale].cart })); await screen.findByText(s.current() ? copy[locale].currentCart : copy[locale].noCurrentCart); return uuid; }
async function editor(locale: Locale = "ru") { const t = copy[locale]; await fireEvent.press(screen.getByRole("button", { name: `${t.draftOpen}: ${t.cartItem} 1` })); await screen.findByLabelText(t.draftQuantity); }
async function prepareCheckout(locale: Locale = "ru") { await fireEvent.press(screen.getByRole("button", { name: validationCopy[locale].start })); await fireEvent.press(await screen.findByRole("button", { name: checkoutCopy[locale].prepare })); await screen.findByRole("button", { name: checkoutCopy[locale].confirm }); }
it.each(["ru", "kk"] as const)("creates a native empty KZT cart only on explicit action in%s without UUID", async locale => {
  const s = backend({ initial: "none" }), t = workspaceCopy[locale], uuid = await openCart(s, locale, false); expect(s.writes).toHaveLength(0);
  await fireEvent.press(screen.getByRole("button", { name: t.start })); await screen.findByText(t.resultBody); expect(s.writes).toHaveLength(1); expect(JSON.parse(s.writes[0].body!)).toEqual({ currency: "KZT" }); expect(s.writes[0].init).toMatchObject({ method: "POST", credentials: "omit", headers: { authorization: "Bearer synthetic-buyer-access-token", "x-organization-id": listDraftScope.organizationId } }); expect(uuid).not.toHaveBeenCalled();
});
it.each(["ru", "kk"] as const)("recovers the selected failed cart using its original version in%s", async locale => {
  const s = backend({ initial: "failed" }), t = workspaceCopy[locale]; await openCart(s, locale, false);
  await fireEvent.press(screen.getByRole("button", { name: `${t.recoveryStart}: ${copy[locale].savedCart} 1` })); await screen.findByText(t.recoveryResultBody);
  expect(s.writes).toHaveLength(1); expect(s.writes[0].path).toBe(`/carts/${recoveryCartSource().id}/recover`); expect(JSON.parse(s.writes[0].body!)).toEqual({ expectedVersion: 4 }); expect(s.effects()).toBe(1);
});
it.each(["ru", "kk"] as const)("changes native quantity, keeps raw text and independently reads the exact current cart in%s", async locale => {
  const s = backend(), t = quantityCopy[locale], c = copy[locale]; await openCart(s, locale, false); await editor(locale); await fireEvent.changeText(screen.getByLabelText(c.draftQuantity), " 3,5 "); await fireEvent(screen.getByLabelText(c.draftQuantity), "submitEditing"); expect(s.writes).toHaveLength(0);
  await fireEvent.press(screen.getByRole("button", { name: t.save })); await screen.findByText(t.received); expect(s.writes[0].init.method).toBe("PATCH"); expect(JSON.parse(s.writes[0].body!)).toEqual({ expectedVersion: 1, quantity: 3.5 }); expect(screen.getByLabelText(c.draftQuantity)).toHaveDisplayValue(" 3,5 ");
  await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.review); await fireEvent.press(screen.getByRole("button", { name: t.closeRead })); await screen.findByText(`${c.quantity}: 3.5`); expect(s.writes).toHaveLength(1);
});
it.each(["ru", "kk"] as const)("confirms removal of only the selected native cart line in%s", async locale => {
  const s = backend(), t = quantityCopy[locale]; await openCart(s, locale, false); await editor(locale); await fireEvent.press(screen.getByRole("button", { name: t.removeStart })); expect(s.writes).toHaveLength(0);
  await fireEvent.press(screen.getByRole("button", { name: t.removeConfirm })); await screen.findByText(t.removeReceived); expect(s.writes[0].init.method).toBe("DELETE"); expect(JSON.parse(s.writes[0].body!)).toEqual({ expectedVersion: 1 }); expect(s.current()!.items).toHaveLength(0);
});
it.each(["ru", "kk"] as const)("adds the exact selected native offer quantity without sending local list text in%s", async locale => {
  const s = backend({ initial: "add" }), c = copy[locale], t = addCopy[locale]; await start(s, locale, false);
  await fireEvent.press(screen.getByRole("button", { name: `${c.open}: SYNTHETIC product, SYNTHETIC variant` })); await fireEvent.press(await screen.findByRole("button", { name: `${c.open}: SYNTHETIC supplier` })); await fireEvent.press(screen.getByRole("button", { name: c.localListAdd })); await screen.findByLabelText(c.localListQuantity);
  await fireEvent.changeText(screen.getByLabelText(c.localListQuantity), " 3,5 "); await fireEvent.changeText(screen.getByLabelText(c.localListNote), "SYNTHETIC local only"); await fireEvent.press(screen.getByRole("button", { name: t.choose })); await screen.findByText(t.body); expect(s.writes).toHaveLength(0);
  await fireEvent.press(screen.getByRole("button", { name: t.apply })); await screen.findByText(t.resultBody); expect(JSON.parse(s.writes[0].body!)).toEqual({ offerId: s.comparison.offers[0]!.offerId, quantity: 3.5 }); expect(s.writes[0].body).not.toContain("SYNTHETIC local only");
});
it.each(["ru", "kk"] as const)("reviews changed native terms before explicit reprice in%s", async locale => {
  const s = backend({ changedTerms: true }), t = repriceCopy[locale]; await openCart(s, locale, false); await fireEvent.press(screen.getByRole("button", { name: validationCopy[locale].start })); await fireEvent.press(await screen.findByRole("button", { name: t.prepare })); await screen.findByRole("button", { name: t.confirm }); expect(s.writes).toHaveLength(1); expect(s.effects()).toBe(0);
  await fireEvent.press(screen.getByRole("button", { name: t.confirm })); await screen.findByText(t.result); expect(s.writes).toHaveLength(2); const body = JSON.parse(s.writes[1].body!); expect(body.expectedVersion).toBe(1); expect(body.acceptedItems[0].snapshot).toEqual(repriceValidation(commandCart()).items[0]!.current); expect(s.effects()).toBe(1);
});
it.each(["ru", "kk"] as const)("checks then explicitly submits native checkout once in%s", async locale => {
  const s = backend(), t = checkoutCopy[locale], uuid = await openCart(s, locale); await prepareCheckout(locale); expect(uuid).not.toHaveBeenCalled(); expect(s.effects()).toBe(0);
  await fireEvent.press(screen.getByRole("button", { name: t.confirm })); await screen.findByText(t.receipt); expect(uuid).toHaveBeenCalledTimes(1); expect(JSON.parse(s.writes[1].body!)).toEqual({ expectedVersion: 1, idempotencyKey: id(123101) }); expect(s.effects()).toBe(1); expect(screen.queryByText("SYNTHETIC private payment")).toBeNull();
});
it("recovers a lost checkout response only through explicit replay of the identical key and version", async () => {
  const s = backend({ failure: 500 }), t = checkoutCopy.ru, uuid = await openCart(s); await prepareCheckout(); await fireEvent.press(screen.getByRole("button", { name: t.confirm })); await screen.findByText(t.unknown); expect(s.writes).toHaveLength(2);
  await fireEvent.press(screen.getByRole("button", { name: `${t.replay}: ${commandCart().id}` })); await screen.findByText(t.receipt); expect(s.writes[2].body).toBe(s.writes[1].body); expect(s.effects()).toBe(1); expect(uuid).toHaveBeenCalledTimes(1);
});
it("keeps an unknown quantity separate from a matching independent read and sends no blind PATCH", async () => {
  const s = backend({ failure: 500 }), t = quantityCopy.ru; await openCart(s); await editor(); await fireEvent.changeText(screen.getByLabelText(copy.ru.draftQuantity), "3.5"); await fireEvent.press(screen.getByRole("button", { name: t.save })); await screen.findByText(t.unknown);
  await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.review); expect(screen.queryByText(t.received)).toBeNull(); expect(s.writes).toHaveLength(1); expect(s.effects()).toBe(1);
});
it.each([403, 409])("keeps native cart status%s distinct from a successful update", async failure => {
  const s = backend({ failure }), t = quantityCopy.ru; await openCart(s); await editor(); await fireEvent.changeText(screen.getByLabelText(copy.ru.draftQuantity), "3.5"); await fireEvent.press(screen.getByRole("button", { name: t.save })); await screen.findByText(failure === 409 ? t.conflict : t.rejected); expect(screen.queryByText(t.received)).toBeNull(); expect(s.effects()).toBe(0); expect(s.writes).toHaveLength(1);
});
it("rejects a foreign cart root before displaying its private fields", async () => {
  const s = backend({ foreign: true }), t = quantityCopy.ru; await openCart(s); await editor(); await fireEvent.changeText(screen.getByLabelText(copy.ru.draftQuantity), "3.5"); await fireEvent.press(screen.getByRole("button", { name: t.save })); await screen.findByText(t.unknown); expect(screen.queryByText("PRIVATE")).toBeNull(); expect(s.writes).toHaveLength(1);
});
it("clears an unresolved cart operation and raw draft after confirmed logout", async () => {
  const s = backend({ failure: 500 }), t = quantityCopy.ru; await openCart(s); await editor(); await fireEvent.changeText(screen.getByLabelText(copy.ru.draftQuantity), "3.5"); await fireEvent.press(screen.getByRole("button", { name: t.save })); await screen.findByText(t.unknown);
  await fireEvent.press(screen.getByRole("button", { name: sessionCopy.ru.logout })); await screen.findByLabelText(sessionCopy.ru.password); expect(screen.queryByText(t.unknown)).toBeNull(); expect(screen.queryByLabelText(copy.ru.draftQuantity)).toBeNull(); expect(s.writes).toHaveLength(1);
});

import { nativeCartAvailable, type NativeCartCommands } from "./native-cart-commands";
import { z } from "zod";
import { addCartItemSchema, createCartSchema, cartVersionSchema, checkoutCartSchema, repriceCartSchema, updateCartItemSchema } from "../../../packages/schemas/src/index";
import { cartResponseSchema, cartItemResponseSchema, errorResponseSchema, type CartResponse } from "../../../packages/schemas/src/core-api";
import type { ReadScope } from "./read-controller";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import { checkQuantityText, decimalIdentity, type CartQuantityDrafts } from "./cart-quantity-draft";
export type CartQuantityInput = Readonly<z.output<typeof updateCartItemSchema>>;
export type CartVersionInput = Readonly<z.output<typeof cartVersionSchema>>;
export type CartCreateInput = Readonly<z.output<typeof createCartSchema>>;
export type CartCheckoutInput = Readonly<z.output<typeof checkoutCartSchema>>;
export type CartRepriceInput = Readonly<z.output<typeof repriceCartSchema>>;
export type CartAddInput = Readonly<z.output<typeof addCartItemSchema>>;
export type CartCommandFixture = {
 authorization: Readonly<{ provenance: "synthetic-source-contract"; scope: ReadScope; permissions: readonly string[] }>;
 updateCartItem?: (scope: ReadScope, cartId: string, itemId: string, input: CartQuantityInput) => Promise<unknown>;
 removeCartItem?: (scope: ReadScope, cartId: string, itemId: string, input: CartVersionInput) => Promise<unknown>;
 createCart?: (scope: ReadScope, buyerOrganizationId: string, input: CartCreateInput) => Promise<unknown>;
 recoverCart?: (scope: ReadScope, sourceCartId: string, input: CartVersionInput) => Promise<unknown>;
 addCartItem?: (scope: ReadScope, cartId: string, input: CartAddInput) => Promise<unknown>;
 validateCart?: (scope: ReadScope, cartId: string) => Promise<unknown>;
 repriceCart?: (scope: ReadScope, cartId: string, input: CartRepriceInput) => Promise<unknown>;
 nextCheckoutIdempotencyKey?: () => string;
 checkoutCart?: (scope: ReadScope, cartId: string, input: CartCheckoutInput) => Promise<unknown>;
};
export type CartCommandFixtureClient = { cartCommandFixture?: CartCommandFixture };
type Item = CartResponse["items"][number];
export type CartCommandPhase = "idle" | "confirm-remove" | "pending" | "success" | "unknown" | "conflict" | "rejected" | "reading" | "review" | "prepared" | "source-changed" | "read-error" | "observed";
export type CartCommandState = Readonly<{ phase: CartCommandPhase; operation?: "quantity" | "remove"; itemId?: string; rawText?: string; sourceQuantity?: string; input?: CartQuantityInput | CartVersionInput; result?: CartResponse; latest?: CartResponse; priorUnknown?: boolean; issue?: "validation" | "authentication" | "denied" | "not-found" | "invalid-result" | "conflict" }>;
type AttemptBase = { cartId: string; itemId: string; offerId: string; sourceQuantity: string; currency: string; itemCurrency: string; unitPriceMinor: string; source: CartResponse; rawText: string };
type Attempt = Readonly<AttemptBase & ({ kind: "quantity"; input: CartQuantityInput } | { kind: "remove"; input: CartVersionInput })>;
type Operation = { state: CartCommandState; attempt: Attempt | null; sequence: number; readSource: CartResponse | null; preparedSource: CartResponse | null; hadSent?: boolean };
export type CartWorkspaceObservation = Readonly<{ page: WorkspaceCartPage; current: CartResponse | null }>;
const idle: CartCommandState = Object.freeze({ phase: "idle" });
const cartRootBinding = cartResponseSchema.pick({ id: true, buyerOrganizationId: true, version: true }).strip();
const cartBinding = cartRootBinding.extend({ items: z.array(cartItemResponseSchema.pick({ id: true, cartId: true, offerId: true }).strip()) });
export function decodeCommandCart(body: unknown, scope: ReadScope, cartId: string): CartResponse | null {
 const root = cartRootBinding.safeParse(body); if (!root.success || root.data.id !== cartId || root.data.buyerOrganizationId !== scope.organizationId) return null;
 const ids = cartBinding.safeParse(body); if (!ids.success || ids.data.items.some(item => item.cartId !== cartId) || new Set(ids.data.items.map(item => item.id)).size !== ids.data.items.length) return null;
 const parsed = cartResponseSchema.safeParse(body); return parsed.success ? parsed.data : null;
}
export function authorizedCartFixture(scope: ReadScope, fixture?: CartCommandFixture) {
 const auth = fixture?.authorization, other = auth?.scope;
 return !!auth && auth.provenance === "synthetic-source-contract" && !!other && scope.product === "market" && scope.product === other.product && scope.environment === other.environment && scope.userId === other.userId && scope.organizationId === other.organizationId && scope.generation === other.generation && Array.isArray(auth.permissions) && auth.permissions.includes("order.create");
}
const activeCart = (cart: CartResponse) => cart.status === "ACTIVE" && cart.checkout === null;
const needsRead = (state: CartCommandState) => ["unknown", "conflict", "source-changed", "read-error", "success", "review", "prepared"].includes(state.phase) || state.phase === "rejected" && (state.issue === "not-found" || state.issue === "conflict");
export function createCartQuantityCommands(scope: ReadScope, fixture: CartCommandFixture | undefined, drafts: CartQuantityDrafts, currentCart: () => CartResponse | null, reloadCurrent: () => Promise<CartResponse | null | undefined>, otherMutationLocked: () => boolean = () => false, currentWorkspace?: () => WorkspaceCartPage | null, native?: NativeCartCommands) {
 const commands = native ?? fixture;
 const owner = Object.freeze({ ...scope }), operations = new Map<string, Operation>(), listeners = new Set<() => void>();
 let active = true, disposed = false, snapshot: Readonly<Record<string, CartCommandState>> = Object.freeze({});
 const available = () => active && (native ? nativeCartAvailable(native, owner) : authorizedCartFixture(owner, fixture)) && (typeof commands?.updateCartItem === "function" || typeof commands?.removeCartItem === "function");
 const opFor = (id: string) => { let op = operations.get(id); if (!op) { op = { state: idle, attempt: null, sequence: 0, readSource: null, preparedSource: null }; operations.set(id, op); } return op; };
 const emit = (id: string, op: Operation, state: CartCommandState) => { op.state = Object.freeze(state); snapshot = Object.freeze({ ...snapshot, [id]: op.state }); listeners.forEach(fn => fn()); };
 const stateFor = (id: string) => snapshot[id] ?? idle;
 const sourceItem = (cart: CartResponse, itemId: string) => cart.items.find(item => item.id === itemId);
 const base = (cart: CartResponse, item: Item, rawText: string): AttemptBase => ({ cartId: cart.id, itemId: item.id, offerId: item.offerId, sourceQuantity: item.quantity, currency: cart.currency, itemCurrency: item.currency, unitPriceMinor: item.unitPriceMinor, source: cart, rawText });
 const sameAttemptSource = (attempt: Attempt) => { const cart = currentCart(), item = cart && sourceItem(cart, attempt.itemId); return cart === attempt.source && cart.buyerOrganizationId === owner.organizationId && cart.version === attempt.input.expectedVersion && activeCart(cart) && cart.currency === attempt.currency && item?.cartId === attempt.cartId && item.currency === attempt.itemCurrency && item.offerId === attempt.offerId && item.quantity === attempt.sourceQuantity && item.unitPriceMinor === attempt.unitPriceMinor; };
 const lock = (state: CartCommandState) => !["idle", "prepared", "observed"].includes(state.phase) && !(state.phase === "rejected" && state.issue === "validation");
 const editableSource = (cart: CartResponse, item: Item) => available() && !otherMutationLocked() && ![...operations].some(([id, op]) => id !== cart.id && !["idle", "observed"].includes(op.state.phase)) && currentCart() === cart && cart.buyerOrganizationId === owner.organizationId && activeCart(cart) && cart.items.includes(item) && drafts.canEdit(cart, item);
 const canSubmit = (cart: CartResponse, item: Item) => { if (typeof commands?.updateCartItem !== "function" || !editableSource(cart, item)) return false; const op = operations.get(cart.id); return !op || !lock(op.state) && (op.state.phase === "idle" || op.state.phase === "observed" || op.state.itemId === item.id) && (op.state.phase !== "prepared" || op.preparedSource === cart); };
 const canBeginRemove = (cart: CartResponse, item: Item) => { const op = operations.get(cart.id); return typeof commands?.removeCartItem === "function" && editableSource(cart, item) && (!op || ["idle", "observed"].includes(op.state.phase) || op.state.phase === "rejected" && op.state.issue === "validation"); };
 const emitUnconfirmed = (id: string, op: Operation, phase: "unknown" | "source-changed", issue?: CartCommandState["issue"]) => emit(id, op, { ...op.state, phase, priorUnknown: true, issue, result: undefined });
 const denyAll = () => { active = false; for (const [id, op] of operations) { op.sequence++; op.attempt = null; op.readSource = null; op.preparedSource = null; emit(id, op, { phase: "rejected", operation: op.state.operation, itemId: op.state.itemId, issue: "denied" }); } };
 const validOutcome = (value: CartResponse, attempt: Attempt) => {
  if (!activeCart(value) || value.currency !== attempt.currency) return false;
  const line = sourceItem(value, attempt.itemId), expected = attempt.input.expectedVersion;
  if (attempt.kind === "remove") return !line && (value.version === expected || value.version === expected + 1);
  return !!line && value.version === expected + (decimalIdentity(attempt.sourceQuantity) === decimalIdentity(String(attempt.input.quantity)) ? 0 : 1) && line.currency === attempt.itemCurrency && line.offerId === attempt.offerId && line.unitPriceMinor === attempt.unitPriceMinor && decimalIdentity(line.quantity) === decimalIdentity(String(attempt.input.quantity));
 };
 const execute = async (op: Operation, attempt: Attempt) => {
  op.attempt = attempt; op.hadSent = true; op.readSource = null; const sequence = ++op.sequence;
  emit(attempt.cartId, op, { phase: "pending", operation: attempt.kind, itemId: attempt.itemId, rawText: attempt.rawText, sourceQuantity: attempt.sourceQuantity, input: attempt.input, priorUnknown: op.state.priorUnknown });
  try {
   const body = attempt.kind === "quantity" ? await commands!.updateCartItem!(owner, attempt.cartId, attempt.itemId, attempt.input) : await commands!.removeCartItem!(owner, attempt.cartId, attempt.itemId, attempt.input);
   if (!active || sequence !== op.sequence) return; if (!available()) { denyAll(); return; } if (!sameAttemptSource(attempt)) { emitUnconfirmed(attempt.cartId, op, "source-changed"); return; }
   const value = decodeCommandCart(body, owner, attempt.cartId);
   if (!value || !validOutcome(value, attempt)) { emitUnconfirmed(attempt.cartId, op, "unknown", "invalid-result"); return; }
   emit(attempt.cartId, op, { ...op.state, phase: "success", result: value, issue: undefined });
  } catch (error) {
   if (!active || sequence !== op.sequence) return; if (!available()) { denyAll(); return; } if (!sameAttemptSource(attempt)) { emitUnconfirmed(attempt.cartId, op, "source-changed"); return; }
   const parsed = typeof error === "object" && error !== null && "payload" in error && "status" in error ? errorResponseSchema.safeParse(error.payload) : null;
   const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
   if (!parsed?.success || parsed.data.statusCode !== status || ![400, 401, 403, 404, 409].includes(status as number)) { emitUnconfirmed(attempt.cartId, op, "unknown"); return; }
   const issue = status === 400 ? "validation" : status === 401 ? "authentication" : status === 403 ? "denied" : status === 404 ? "not-found" : "conflict";
   emit(attempt.cartId, op, { ...op.state, phase: status === 409 && parsed.data.code === "CART_VERSION_CONFLICT" ? "conflict" : "rejected", issue, result: undefined });
  }
 };
 return {
  runtime: native ? "native-session" as const : "fixture" as const, getSnapshot: () => snapshot, subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }, stateFor,
  isAvailable: available, canSubmit, canBeginRemove, isLocked: (id: string) => lock(stateFor(id)),
  canReadOriginal(cartId: string): boolean { return available() && operations.get(cartId)?.hadSent === true && !(stateFor(cartId).phase === "rejected" && ["authentication", "denied"].includes(stateFor(cartId).issue ?? "")); },
  attemptTarget(cartId: string): Readonly<{ cartId: string; itemId: string; expectedVersion: number }> | null {
   const op = operations.get(cartId);
   return available() && op?.attempt && op.state.itemId && !(op.state.phase === "rejected" && ["authentication", "denied"].includes(op.state.issue ?? "")) ? Object.freeze({ cartId, itemId: op.state.itemId, expectedVersion: op.state.input?.expectedVersion ?? op.attempt.input.expectedVersion }) : null;
  },
  workspaceObservation(cartId: string, itemId: string): CartWorkspaceObservation | null {
   const op = operations.get(cartId);
   if (!available() || !op?.attempt || op.state.itemId !== itemId || !( ["success", "unknown", "conflict", "source-changed", "read-error", "review", "prepared", "reading"].includes(op.state.phase) || op.state.phase === "rejected" && ["validation", "not-found", "conflict"].includes(op.state.issue ?? ""))) return null;
   const page = currentWorkspace?.();
   // A missing/loading/error page is not evidence of no active cart. Only the
   // actual typed workspace page can provide that nullable-current fact.
   if (!page || page.current !== currentCart() || page.items.some(cart => cart.buyerOrganizationId !== owner.organizationId)) return null;
   const current = page.current;
   if (current && (current.id === cartId || current.buyerOrganizationId !== owner.organizationId || !activeCart(current) || !cartVersionSchema.safeParse({ expectedVersion: current.version }).success)) return null;
   return Object.freeze({ page, current });
  },
  observeWorkspace(cartId: string, itemId: string, expected: CartWorkspaceObservation): boolean {
   const actual = this.workspaceObservation(cartId, itemId), op = operations.get(cartId);
   if (!op || !actual || actual.page !== expected.page || actual.current !== expected.current) return false;
   // No write is replayed or cancelled. An outstanding metadata read may be
   // superseded; its late completion is invalidated by the sequence change.
   op.sequence++; op.attempt = null; op.preparedSource = null; op.readSource = null;
   emit(cartId, op, { phase: "observed", operation: op.state.operation, itemId: op.state.itemId, priorUnknown: op.state.priorUnknown }); return true;
  },
  editingCart(cartId: string, itemId: string) { const op = operations.get(cartId), current = currentCart(); return op?.state.itemId === itemId && op.preparedSource === current && current?.id === cartId ? current : null; },
  async submit(cart: CartResponse, item: Item) {
   if (!canSubmit(cart, item) || !drafts.check(cart, item)) return; const draft = drafts.getLine(cart, item); if (!draft || checkQuantityText(draft.text, cart.version)) return;
   const input = Object.freeze(updateCartItemSchema.parse({ expectedVersion: cart.version, quantity: Number(draft.text.trim().replace(",", ".")) })); await execute(opFor(cart.id), Object.freeze({ ...base(cart, item, draft.text), kind: "quantity", input }));
  },
  beginRemove(cart: CartResponse, item: Item) {
   if (!canBeginRemove(cart, item)) return; const op = opFor(cart.id), input = Object.freeze(cartVersionSchema.parse({ expectedVersion: cart.version }));
   op.attempt = Object.freeze({ ...base(cart, item, drafts.getLine(cart, item)?.text ?? item.quantity), kind: "remove", input });
   emit(cart.id, op, { phase: "confirm-remove", operation: "remove", itemId: item.id, sourceQuantity: item.quantity, input, priorUnknown: op.state.priorUnknown });
  },
  canConfirmRemove(cartId: string, itemId: string) { const op = operations.get(cartId); return available() && !otherMutationLocked() && typeof commands?.removeCartItem === "function" && op?.state.phase === "confirm-remove" && op.attempt?.kind === "remove" && op.attempt.itemId === itemId && sameAttemptSource(op.attempt); },
  async confirmRemove(cartId: string, itemId: string) { const op = operations.get(cartId); if (!op || !this.canConfirmRemove(cartId, itemId) || op.attempt?.kind !== "remove") return; await execute(op, op.attempt); },
  cancelRemove(cartId: string, itemId: string) { const op = operations.get(cartId); if (!active || !op || op.state.phase !== "confirm-remove" || op.state.itemId !== itemId) return; op.sequence++; op.attempt = null; emit(cartId, op, { phase: "idle", itemId, priorUnknown: op.state.priorUnknown }); },
  canRead(cartId: string, itemId: string) { const op = operations.get(cartId); return available() && !!op?.attempt && op.state.itemId === itemId && needsRead(op.state) && currentCart()?.id === cartId; },
  async readCurrent(cartId: string, itemId: string) {
   const op = operations.get(cartId); if (!op || !this.canRead(cartId, itemId)) return; const attempt = op.attempt!, sequence = ++op.sequence; op.preparedSource = null; emit(cartId, op, { ...op.state, phase: "reading", input: attempt.input, sourceQuantity: attempt.sourceQuantity, rawText: attempt.rawText, latest: undefined, result: undefined });
   try {
    const current = await reloadCurrent(); if (!active || sequence !== op.sequence) return; if (!available()) { denyAll(); return; }
    if (current === undefined) { emit(cartId, op, { ...op.state, phase: "read-error" }); return; }
    if (!current || current.id !== cartId || current.buyerOrganizationId !== owner.organizationId || currentCart() !== current) { emitUnconfirmed(cartId, op, "source-changed"); return; }
    const value = decodeCommandCart(current, owner, cartId); if (!value || value.version < attempt.input.expectedVersion) { emit(cartId, op, { ...op.state, phase: "read-error" }); return; }
    op.readSource = current; emit(cartId, op, { ...op.state, phase: "review", latest: value });
   } catch { if (active && sequence === op.sequence) emit(cartId, op, { ...op.state, phase: "read-error" }); }
  },
  canReview(cartId: string, itemId: string) { const op = operations.get(cartId), cart = op?.readSource, item = cart && sourceItem(cart, itemId); return available() && op?.state.phase === "review" && op.state.itemId === itemId && !!cart && currentCart() === cart && activeCart(cart) && cart.version === op.state.latest?.version && item?.offerId === op.attempt?.offerId; },
  review(cartId: string, itemId: string) {
   const op = operations.get(cartId); if (!op || !this.canReview(cartId, itemId)) return; const cart = op.readSource!, item = sourceItem(cart, itemId)!, attempt = op.attempt!, raw = drafts.getLine(cart, item)?.text ?? attempt.rawText;
   drafts.syncCurrent(cart); if (!drafts.begin(cart, item)) return; drafts.change(cart, item, raw); op.preparedSource = cart;
   if (attempt.kind === "remove") {
    const input = Object.freeze(cartVersionSchema.parse({ expectedVersion: cart.version })); op.attempt = Object.freeze({ ...base(cart, item, raw), kind: "remove", input });
    emit(cartId, op, { ...op.state, phase: "confirm-remove", sourceQuantity: item.quantity, input, result: undefined, issue: undefined });
   } else {
    if (!drafts.check(cart, item)) return; const input = Object.freeze(updateCartItemSchema.parse({ expectedVersion: cart.version, quantity: Number(raw.trim().replace(",", ".")) })); emit(cartId, op, { ...op.state, phase: "prepared", input, result: undefined, issue: undefined });
   }
  },
  returnToReview(cartId: string, itemId: string) { const op = operations.get(cartId); if (!available() || !op || op.state.phase !== "prepared" || op.state.itemId !== itemId || currentCart() !== op.readSource) return; op.preparedSource = null; emit(cartId, op, { ...op.state, phase: "review" }); },
  cancelLocal(cartId: string, itemId: string): boolean { const op = operations.get(cartId); if (!op || op.state.phase === "idle") return true; if (!available() || op.state.itemId !== itemId || !(op.state.phase === "observed" || op.state.phase === "rejected" && op.state.issue === "validation")) return false; op.sequence++; op.attempt = null; op.readSource = null; op.preparedSource = null; emit(cartId, op, { phase: "idle", priorUnknown: op.state.priorUnknown }); return true; },
  canCloseRead(cartId: string, itemId: string): boolean { const op = operations.get(cartId); return available() && !!op && op.state.phase === "review" && op.state.itemId === itemId && currentCart() === op.readSource; },
  closeRead(cartId: string, itemId: string): boolean { const op = operations.get(cartId); if (!op || !this.canCloseRead(cartId, itemId)) return false; op.attempt = null; op.preparedSource = null; emit(cartId, op, { ...op.state, phase: "observed", input: undefined, rawText: undefined, result: undefined }); return true; },
  activate() { if (disposed) { disposed = false; active = true; } }, denyAll,
  dispose() { disposed = true; active = false; for (const op of operations.values()) op.sequence++; operations.clear(); listeners.clear(); snapshot = Object.freeze({}); },
 };
}
export type CartQuantityCommands = ReturnType<typeof createCartQuantityCommands>;

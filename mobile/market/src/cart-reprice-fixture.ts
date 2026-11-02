import { nativeCartAvailable, type NativeCartCommands } from "./native-cart-commands";
import { repriceCartSchema } from "../../../packages/schemas/src/index";
import { cartResponseSchema, cartValidationResponseSchema, errorResponseSchema, type CartResponse, type CartValidationResponse } from "../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import type { ReadScope } from "./read-controller";
import { authorizedCartFixture, decodeCommandCart, type CartCommandFixture, type CartRepriceInput } from "./cart-command-fixture";
import type { CartValidation } from "./cart-validation-fixture";
type Phase = "idle" | "prepared" | "pending" | "result" | "unknown" | "rejected" | "reading" | "review" | "read-error" | "observed";
export type CartRepriceState = Readonly<{ phase: Phase; cartId?: string; input?: CartRepriceInput; validation?: CartValidationResponse; result?: CartResponse; latest?: WorkspaceCartPage; priorUnknown?: boolean; issue?: "validation" | "authentication" | "denied" | "not-found" | "conflict" | "version" | "revalidation" | "context" | "invalid-result" }>;
type Frame = Readonly<{ page: WorkspaceCartPage; cart: CartResponse; id: string; version: number; currency: string; lines: string }>;
type Attempt = Readonly<{ frame: Frame; validation: CartValidationResponse; input: CartRepriceInput }>;
const receiptRoot = cartResponseSchema.pick({ id: true, buyerOrganizationId: true, version: true, currency: true }).strip();
const idle: CartRepriceState = Object.freeze({ phase: "idle" });
const lineFacts = (cart: CartResponse) => JSON.stringify(cart.items.map(item => [item.id, item.cartId, item.offerId, item.quantity, item.unitPriceMinor, item.totalPriceMinor, item.currency]));
function freezeInput<T>(value: T): T { if (value !== null && typeof value === "object") { Object.values(value).forEach(freezeInput); Object.freeze(value); } return value; }
export function createCartReprice(scope: ReadScope, fixture: CartCommandFixture | undefined, validation: CartValidation, currentPage: () => WorkspaceCartPage | null, reloadPage: () => Promise<WorkspaceCartPage | undefined>, otherOperationLocked: () => boolean = () => false, isWorkspaceActive: () => boolean = () => currentPage() !== null, native?: NativeCartCommands) {
 const commands = native ?? fixture;
 const owner = Object.freeze({ ...scope }), listeners = new Set<() => void>();
 let active = true, disposed = false, sequence = 0, state = idle, prepared: Attempt | null = null, reviewed: WorkspaceCartPage | null = null;
 const available = () => active && (native ? nativeCartAvailable(native, owner) : authorizedCartFixture(owner, fixture)) && typeof commands?.repriceCart === "function";
 const emit = (next: CartRepriceState) => { state = Object.freeze(next); listeners.forEach(listener => listener()); };
 const ownedPage = (page: WorkspaceCartPage) => currentPage() === page && (!page.current || page.current.buyerOrganizationId === owner.organizationId) && page.items.every(cart => cart.buyerOrganizationId === owner.organizationId);
 const sameFrame = (frame: Frame) => ownedPage(frame.page) && frame.page.current === frame.cart && frame.cart.id === frame.id && frame.cart.version === frame.version && frame.cart.currency === frame.currency && frame.cart.status === "ACTIVE" && frame.cart.checkout === null && lineFacts(frame.cart) === frame.lines;
 const inputFor = (quote: CartValidationResponse) => repriceCartSchema.safeParse({ expectedVersion: quote.cartVersion, acceptedItems: quote.items.flatMap(item => item.current ? [{ cartItemId: item.cartItemId, snapshot: item.current }] : []) });
 const canPrepare = (page: WorkspaceCartPage) => {
  if (!available() || otherOperationLocked() || !ownedPage(page) || !["idle", "observed"].includes(state.phase)) return false;
  const quote = validation.resultFor(page); return !!page.current && !!quote && quote.hasChanges && inputFor(quote).success;
 };
 const canConfirm = () => !!prepared && available() && !otherOperationLocked() && state.phase === "prepared" && sameFrame(prepared.frame) && validation.getSnapshot().phase === "ready" && validation.getSnapshot().result === prepared.validation;
 const denyAll = () => { active = false; sequence++; prepared = null; reviewed = null; emit({ phase: "rejected", issue: "denied" }); };
 return {
  runtime: native ? "native-session" as const : "fixture" as const, getSnapshot: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  isAvailable: available, canPrepare, canConfirm,
  blocksOtherMutations: () => active && !["idle", "observed"].includes(state.phase),
  preparationUnsupported(page: WorkspaceCartPage): boolean { const quote = validation.resultFor(page); return available() && !!quote && quote.hasChanges && !inputFor(quote).success; },
  prepare(page: WorkspaceCartPage): boolean {
   if (!canPrepare(page)) return false; const quote = validation.resultFor(page)!, cart = page.current!, parsed = inputFor(quote); if (!parsed.success) return false;
   const input = freezeInput(parsed.data), frame: Frame = Object.freeze({ page, cart, id: cart.id, version: cart.version, currency: cart.currency, lines: lineFacts(cart) });
   prepared = Object.freeze({ frame, validation: quote, input }); reviewed = null;
   emit({ phase: "prepared", cartId: cart.id, input, validation: freezeInput(cartValidationResponseSchema.parse(quote)), priorUnknown: state.priorUnknown }); return true;
  },
  cancelPreparation(): boolean { if (!available() || state.phase !== "prepared") return false; prepared = null; emit({ phase: "observed", priorUnknown: state.priorUnknown }); return true; },
  async confirm() {
   if (!canConfirm() || !prepared) return; const work = prepared, ownSequence = ++sequence; prepared = null; reviewed = null;
   emit({ phase: "pending", cartId: work.frame.id, input: work.input, priorUnknown: state.priorUnknown });
   const unknown = (issue?: CartRepriceState["issue"]) => emit({ ...state, phase: "unknown", priorUnknown: true, issue, result: undefined });
   try {
    const body = await commands!.repriceCart!(owner, work.frame.id, work.input);
    if (!active || ownSequence !== sequence) return; if (!available()) { denyAll(); return; }
    if (!sameFrame(work.frame)) { unknown("context"); return; }
    const root = receiptRoot.safeParse(body);
    if (!root.success || root.data.id !== work.frame.id || root.data.buyerOrganizationId !== owner.organizationId || root.data.version <= work.frame.version || root.data.currency !== work.frame.currency) { unknown("invalid-result"); return; }
    const result = decodeCommandCart(body, owner, work.frame.id);
    // requireCart runs after commit. Its snapshot can include subsequent writes.
    if (!result || result.version <= work.frame.version || result.currency !== work.frame.currency) { unknown("invalid-result"); return; }
    emit({ ...state, phase: "result", result, issue: undefined });
   } catch (error) {
    if (!active || ownSequence !== sequence) return; if (!available()) { denyAll(); return; }
    if (!sameFrame(work.frame)) { unknown("context"); return; }
    const parsed = typeof error === "object" && error !== null && "payload" in error && "status" in error ? errorResponseSchema.safeParse(error.payload) : null;
    const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
    if (!parsed?.success || parsed.data.statusCode !== status || ![400,401,403,404,409].includes(status as number)) { unknown(); return; }
    const issue = status === 400 ? "validation" : status === 401 ? "authentication" : status === 403 ? "denied" : status === 404 ? "not-found" : parsed.data.code === "CART_REVALIDATION_REQUIRED" ? "revalidation" : parsed.data.code === "CART_VERSION_CONFLICT" ? "version" : "conflict";
    // requireCart is called both before and after the transaction. A 403/404
    // receipt alone cannot prove that the already attempted write rolled back.
    emit({ ...state, phase: "rejected", issue, priorUnknown: state.priorUnknown || status === 403 || status === 404 });
   }
  },
  resultCart(): CartResponse | null { return available() && state.phase === "result" ? state.result ?? null : null; },
  canRead(): boolean { return available() && isWorkspaceActive() && ["result", "unknown", "rejected", "read-error", "review"].includes(state.phase) && !["authentication", "denied"].includes(state.issue ?? ""); },
  async readCurrent() {
   if (!this.canRead()) return; const ownSequence = ++sequence; reviewed = null; emit({ ...state, phase: "reading", result: undefined, latest: undefined });
   try {
    const page = await reloadPage(); if (!active || ownSequence !== sequence) return; if (!available()) { denyAll(); return; }
    if (!page || !ownedPage(page)) { emit({ ...state, phase: "read-error" }); return; }
    reviewed = page; emit({ ...state, phase: "review", latest: page, issue: undefined });
   } catch { if (active && ownSequence === sequence) emit({ ...state, phase: "read-error" }); }
  },
  canAcknowledge(): boolean { return available() && state.phase === "review" && !!reviewed && ownedPage(reviewed); },
  acknowledge(): boolean { if (!this.canAcknowledge()) return false; reviewed = null; emit({ phase: "observed", priorUnknown: state.priorUnknown }); return true; },
  denyAll,
  activate() { if (disposed) { disposed = false; active = true; } },
  dispose() { disposed = true; active = false; sequence++; prepared = null; reviewed = null; state = idle; listeners.clear(); },
 };
}
export type CartReprice = ReturnType<typeof createCartReprice>;

import { nativeCartAvailable, type NativeCartCommands } from "./native-cart-commands";
import { z } from "zod";
import { checkoutCartSchema } from "../../../packages/schemas/src/index";
import { cartResponseSchema, cartValidationResponseSchema, checkoutResponseSchema, cartItemResponseSchema, supplierOrderResponseSchema, errorResponseSchema, type CartResponse, type CartValidationResponse, type CheckoutResponse } from "../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import { hasCheckoutIdentity } from "../../../contracts/mobile-read/cart-read-identity";
import { authorizedCartFixture, type CartCheckoutInput, type CartCommandFixture } from "./cart-command-fixture";
import type { CartValidation } from "./cart-validation-fixture";
import type { CartQuantityDrafts } from "./cart-quantity-draft";
import type { ReadScope } from "./read-controller";
type Phase = "idle" | "prepared" | "key-error" | "pending" | "receipt" | "unknown" | "rejected" | "reading" | "review" | "read-error" | "observed";
export type CartCheckoutState = Readonly<{ phase: Phase; cartId?: string; version?: number; validation?: CartValidationResponse; input?: CartCheckoutInput; receipt?: CheckoutResponse; latest?: WorkspaceCartPage; unresolved?: boolean; issue?: "key" | "authentication" | "denied" | "not-found" | "validation" | "version" | "revalidation" | "unavailable-items" | "ambiguous-conflict" | "invalid-result" | "context" }>;
type Frame = Readonly<{ page: WorkspaceCartPage; cart: CartResponse; id: string; version: number; currency: string; lines: string; validation: CartValidationResponse }>;
type Operation = { state: CartCheckoutState; frame: Frame | null; input: CartCheckoutInput | null; receipt: CheckoutResponse | null; hadSent: boolean; unresolved: boolean; sequence: number; reviewed: WorkspaceCartPage | null; lastReadBody?: unknown };
const idle: CartCheckoutState = Object.freeze({ phase: "idle" });
const rootBinding = checkoutResponseSchema.pick({ id: true, cartId: true, buyerOrganizationId: true, idempotencyKey: true, currency: true }).strip();
const nestedBinding = rootBinding.extend({ cart: cartResponseSchema.pick({ id: true, buyerOrganizationId: true, version: true, currency: true }).strip().extend({ items: z.array(cartItemResponseSchema.pick({ id: true, cartId: true, offerId: true }).strip()) }), supplierOrders: z.array(supplierOrderResponseSchema.pick({ id: true, checkoutId: true, buyerOrganizationId: true, currency: true }).strip()) });
const lineFacts = (cart: CartResponse) => JSON.stringify(cart.items.map(item => [item.id,item.cartId,item.offerId,item.quantity,item.unitPriceMinor,item.totalPriceMinor,item.currency]));
function freezeReview<T>(value: T): T { if (value !== null && typeof value === "object") { Object.values(value).forEach(freezeReview); Object.freeze(value); } return value; }
/** Source checkout identity is cart + immutable original key, including FAILED receipts. */
export function createCartCheckout(scope: ReadScope, fixture: CartCommandFixture | undefined, validation: CartValidation, drafts: CartQuantityDrafts, currentPage: () => WorkspaceCartPage | null, reloadPage: () => Promise<WorkspaceCartPage | undefined>, otherOperationLocked: () => boolean = () => false, isWorkspaceActive: () => boolean = () => currentPage() !== null, native?: NativeCartCommands) {
 const commands = native ?? fixture;
 const owner = Object.freeze({ ...scope }), operations = new Map<string, Operation>(), issued = new Set<string>(), listeners = new Set<() => void>();
 let authority: "authentication" | "denied" | null = null;
 let active = true, disposed = false, snapshot: Readonly<Record<string, CartCheckoutState>> = Object.freeze({});
 const available = () => active && (native ? nativeCartAvailable(native, owner, true) : authorizedCartFixture(owner, fixture)) && typeof commands?.checkoutCart === "function" && typeof commands.nextCheckoutIdempotencyKey === "function";
 const stateFor = (cartId: string) => snapshot[cartId] ?? idle;
 const opFor = (cartId: string) => { let op = operations.get(cartId); if (!op) { op = { state: idle, frame: null, input: null, receipt: null, hadSent: false, unresolved: false, sequence: 0, reviewed: null }; operations.set(cartId, op); } return op; };
 const emit = (cartId: string, op: Operation, state: CartCheckoutState) => { op.state = Object.freeze(state); snapshot = Object.freeze({ ...snapshot, [cartId]: op.state }); listeners.forEach(listener => listener()); };
 const blocks = (state: CartCheckoutState) => !["idle", "observed"].includes(state.phase);
 const anotherAttemptBlocks = (cartId?: string) => [...operations].some(([id, op]) => id !== cartId && blocks(op.state));
 const ownedPage = (page: WorkspaceCartPage) => currentPage() === page && (!page.current || page.current.buyerOrganizationId === owner.organizationId) && page.items.every(cart => cart.buyerOrganizationId === owner.organizationId);
 const noLocalQuantity = (cart: CartResponse) => { const local = drafts.getSnapshot(); return local.source?.id !== cart.id || Object.keys(local.entries).length === 0; };
 const sameFrame = (frame: Frame) => ownedPage(frame.page) && frame.page.current === frame.cart && frame.cart.id === frame.id && frame.cart.version === frame.version && frame.cart.currency === frame.currency && frame.cart.status === "ACTIVE" && frame.cart.checkout === null && lineFacts(frame.cart) === frame.lines && noLocalQuantity(frame.cart);
 const canPrepare = (page: WorkspaceCartPage) => {
  if (!available() || authority || otherOperationLocked() || anotherAttemptBlocks() || !ownedPage(page)) return false;
  const cart = page.current, quote = validation.resultFor(page), op = cart && operations.get(cart.id);
  return !!cart && cart.status === "ACTIVE" && cart.checkout === null && cart.items.length > 0 && noLocalQuantity(cart) && !!quote && quote.canCheckout && !quote.requiresAcceptance && (!op || !op.unresolved && !op.receipt && ["idle", "observed"].includes(op.state.phase));
 };
 const canConfirm = (cartId: string) => { const op = operations.get(cartId), frame = op?.frame; return available() && !authority && !otherOperationLocked() && !anotherAttemptBlocks(cartId) && !!frame && !!op && ["prepared", "key-error"].includes(op.state.phase) && sameFrame(frame) && validation.getSnapshot().phase === "ready" && validation.getSnapshot().result === frame.validation; };
 const decode = (body: unknown, cartId: string, input: CartCheckoutInput, currency: string): CheckoutResponse | null => {
  const root = rootBinding.safeParse(body);
  if (!root.success || root.data.cartId !== cartId || root.data.buyerOrganizationId !== owner.organizationId || root.data.idempotencyKey !== input.idempotencyKey || root.data.currency !== currency || [...operations].some(([id, op]) => id !== cartId && op.receipt?.id === root.data.id)) return null;
  const nested = nestedBinding.safeParse(body);
  if (!nested.success || nested.data.cart.id !== cartId || nested.data.cart.buyerOrganizationId !== owner.organizationId || nested.data.cart.version <= input.expectedVersion! || nested.data.cart.currency !== currency || nested.data.cart.items.some(item => item.cartId !== cartId) || new Set(nested.data.cart.items.map(item => item.id)).size !== nested.data.cart.items.length || new Set(nested.data.supplierOrders.map(order => order.id)).size !== nested.data.supplierOrders.length || nested.data.supplierOrders.some(order => order.checkoutId !== root.data.id || order.buyerOrganizationId !== owner.organizationId || order.currency !== currency)) return null;
  const parsed = checkoutResponseSchema.safeParse(body);
  return parsed.success && hasCheckoutIdentity(parsed.data) && new Set(parsed.data.cart.items.map(item => item.id)).size === parsed.data.cart.items.length ? parsed.data : null;
 };
 const denyAll = () => { active = false; for (const [cartId, op] of operations) { op.sequence++; op.frame = null; op.input = null; op.receipt = null; op.reviewed = null; emit(cartId,op,{phase:"rejected",issue:"denied"}); } };
 const uncertain = (cartId: string, op: Operation, issue?: CartCheckoutState["issue"]) => { op.unresolved = true; emit(cartId,op,{...op.state,phase:"unknown",unresolved:true,issue,receipt:undefined,validation:undefined}); };
 const execute = async (cartId: string, op: Operation, input: CartCheckoutInput, replay: boolean) => {
  const frame = op.frame!, ownSequence = ++op.sequence; op.input = input; op.hadSent = true; op.reviewed = null;
  emit(cartId,op,{phase:"pending",cartId,version:input.expectedVersion,input,unresolved:op.unresolved});
  try {
   const body = await commands!.checkoutCart!(owner,cartId,input);
   if (!active || ownSequence !== op.sequence) return; if (!available()) { denyAll(); return; }
   const page = currentPage();
   if (!isWorkspaceActive() || page && !ownedPage(page) || !replay && !sameFrame(frame)) { uncertain(cartId,op,"context"); return; }
   const receipt = decode(body,cartId,input,frame.currency);
   if (!receipt) { uncertain(cartId,op,"invalid-result"); return; }
   op.receipt = receipt; op.unresolved = false;
   emit(cartId,op,{phase:"receipt",cartId,version:input.expectedVersion,input,receipt,unresolved:false});
  } catch (error) {
   if (!active || ownSequence !== op.sequence) return; if (!available()) { denyAll(); return; }
   const page = currentPage();
   if (!isWorkspaceActive() || page && !ownedPage(page) || !replay && !sameFrame(frame)) { uncertain(cartId,op,"context"); return; }
   const parsed = typeof error === "object" && error !== null && "payload" in error && "status" in error ? errorResponseSchema.safeParse(error.payload) : null;
   const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
   if (!parsed?.success || parsed.data.statusCode !== status || ![400,401,403,404,409].includes(status as number)) { uncertain(cartId,op); return; }
   const code = parsed.data.code;
   if (status === 409 && !["CART_VERSION_CONFLICT","CART_REVALIDATION_REQUIRED","CART_ITEMS_UNAVAILABLE"].includes(code ?? "")) { uncertain(cartId,op,"ambiguous-conflict"); return; }
   const issue = status === 400 ? "validation" : status === 401 ? "authentication" : status === 403 ? "denied" : status === 404 ? "not-found" : code === "CART_REVALIDATION_REQUIRED" ? "revalidation" : code === "CART_ITEMS_UNAVAILABLE" ? "unavailable-items" : "version";
   // A postcommit getCheckout can fail with403/404. A later known rejection also
   // cannot erase an earlier uncertain attempt with this same immutable key.
   op.unresolved ||= status === 403 || status === 404;
   if (issue === "authentication" || issue === "denied") authority = issue;
   emit(cartId,op,{...op.state,phase:"rejected",issue,unresolved:op.unresolved});
  }
 };
 return {
  runtime: native ? "native-session" as const : "fixture" as const, getSnapshot: () => snapshot, stateFor,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  isAvailable: available, canPrepare, canConfirm,
  blocksOtherMutations: () => active && (authority !== null || anotherAttemptBlocks()),
  authorityIssue: () => authority,
  hasLocalQuantity(page: WorkspaceCartPage): boolean { return available() && ownedPage(page) && !!page.current && !noLocalQuantity(page.current); },
  prepare(page: WorkspaceCartPage): boolean {
   if (!canPrepare(page)) return false; const cart = page.current!, quote = validation.resultFor(page)!, op = opFor(cart.id);
   op.frame = Object.freeze({page,cart,id:cart.id,version:cart.version,currency:cart.currency,lines:lineFacts(cart),validation:quote}); op.input = null; op.reviewed = null;
   emit(cart.id,op,{phase:"prepared",cartId:cart.id,version:cart.version,validation:freezeReview(cartValidationResponseSchema.parse(quote)),unresolved:false}); return true;
  },
  cancelPreparation(cartId: string): boolean { const op = operations.get(cartId); if (!available() || !op || !["prepared","key-error"].includes(op.state.phase)) return false; op.frame = null; op.input = null; emit(cartId,op,{phase:"observed",cartId,unresolved:false}); return true; },
  async confirm(cartId: string) {
   const op = operations.get(cartId); if (!op || !canConfirm(cartId)) return;
   let rawKey: string; try { rawKey = commands!.nextCheckoutIdempotencyKey!(); } catch { emit(cartId,op,{...op.state,phase:"key-error",issue:"key"}); return; }
   const parsed = checkoutCartSchema.safeParse({idempotencyKey:rawKey,expectedVersion:op.frame!.version});
   if (!parsed.success || issued.has(parsed.data.idempotencyKey)) { emit(cartId,op,{...op.state,phase:"key-error",issue:"key"}); return; }
   issued.add(parsed.data.idempotencyKey); await execute(cartId,op,Object.freeze(parsed.data),false);
  },
  canReplay(cartId: string): boolean {
   const op = operations.get(cartId), page = currentPage();
   return available() && !authority && isWorkspaceActive() && (!page || ownedPage(page)) && !otherOperationLocked() && !anotherAttemptBlocks(cartId) && !!op?.input && !!op.frame && op.hadSent && op.unresolved && !op.receipt && ["unknown","rejected","read-error","review","observed"].includes(op.state.phase) && !["authentication","denied"].includes(op.state.issue ?? "");
  },
  async replay(cartId: string) { const op = operations.get(cartId); if (op?.input && this.canReplay(cartId)) await execute(cartId,op,op.input,true); },
  /** Called only for a separately accepted scoped checkout read; a pointer is insufficient. */
  acceptKnownReceiptRead(body: unknown): boolean {
   if (!available()) return false;
   const target = checkoutResponseSchema.pick({ cartId: true }).strip().safeParse(body); if (!target.success) return false;
   const op = operations.get(target.data.cartId); if (!op?.hadSent || !op.input || !op.frame) return false;
   if (op.lastReadBody === body) return true;
   const receipt = decode(body,target.data.cartId,op.input,op.frame.currency); if (!receipt) return false;
   const observed = op.state.phase === "observed"; op.lastReadBody = body; op.sequence++; op.receipt = receipt; op.unresolved = false; op.reviewed = null;
   emit(target.data.cartId,op,{phase:observed ? "observed" : "receipt",cartId:target.data.cartId,version:op.input.expectedVersion,input:op.input,receipt,unresolved:false}); return true;
  },
  receiptFor(cartId: string): CheckoutResponse | null { return available() ? operations.get(cartId)?.receipt ?? null : null; },
  canRead(cartId: string): boolean { const op = operations.get(cartId); return available() && isWorkspaceActive() && !!op?.hadSent && !anotherAttemptBlocks(cartId) && ["receipt","unknown","rejected","read-error","review","observed"].includes(op.state.phase) && !["authentication","denied"].includes(op.state.issue ?? ""); },
  async readCurrent(cartId: string) {
   const op = operations.get(cartId); if (!op || !this.canRead(cartId)) return; const ownSequence = ++op.sequence; op.reviewed = null; emit(cartId,op,{...op.state,phase:"reading",latest:undefined});
   try {
    const page = await reloadPage(); if (!active || ownSequence !== op.sequence) return; if (!available()) { denyAll(); return; }
    if (!page || !ownedPage(page)) { emit(cartId,op,{...op.state,phase:"read-error"}); return; }
    op.reviewed = page; emit(cartId,op,{...op.state,phase:"review",latest:page,issue:undefined});
   } catch { if (active && ownSequence === op.sequence) emit(cartId,op,{...op.state,phase:"read-error"}); }
  },
  canAcknowledge(cartId: string): boolean { const op = operations.get(cartId); return available() && !!op && op.state.phase === "review" && !!op.reviewed && ownedPage(op.reviewed); },
  acknowledge(cartId: string): boolean { const op = operations.get(cartId); if (!op || !this.canAcknowledge(cartId)) return false; op.reviewed = null; emit(cartId,op,{phase:"observed",cartId,version:op.input?.expectedVersion,input:op.input ?? undefined,receipt:op.receipt ?? undefined,unresolved:op.unresolved}); return true; },
  denyAll,
  activate() { if (disposed) { disposed = false; active = true; } },
  dispose() { disposed = true; active = false; for (const op of operations.values()) op.sequence++; operations.clear(); issued.clear(); authority = null; listeners.clear(); snapshot = Object.freeze({}); },
 };
}
export type CartCheckout = ReturnType<typeof createCartCheckout>;

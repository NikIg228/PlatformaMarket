import { nativeCartAvailable, type NativeCartCommands } from "./native-cart-commands";
import { z } from "zod";
import { cartValidationResponseSchema, errorResponseSchema, type CartResponse, type CartValidationResponse } from "../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import { authorizedCartFixture, type CartCommandFixture } from "./cart-command-fixture";
import { decimalIdentity } from "./cart-quantity-draft";
import type { ReadScope } from "./read-controller";

type Phase = "idle" | "pending" | "ready" | "error" | "stale";
type Issue = "validation" | "authentication" | "denied" | "not-found" | "conflict" | "invalid-result" | "read-error";
export type CartValidationState = Readonly<{ phase: Phase; cartId?: string; version?: number; result?: CartValidationResponse; issue?: Issue }>;
type Line = Readonly<Pick<CartResponse["items"][number], "id" | "cartId" | "offerId" | "quantity" | "currency" | "unitPriceMinor" | "totalPriceMinor">>;
type Context = Readonly<{ page: WorkspaceCartPage; cart: CartResponse; id: string; version: number; currency: string; lines: readonly Line[] }>;
const idle: CartValidationState = Object.freeze({ phase: "idle" });
const rootBinding = cartValidationResponseSchema.pick({ cartId: true, cartVersion: true }).strip();
const itemBinding = rootBinding.extend({ items: z.array(cartValidationResponseSchema.shape.items.element.pick({ cartItemId: true, offerId: true }).strip()) });
const sameLine = (a: Line, b: Line) => a.id === b.id && a.cartId === b.cartId && a.offerId === b.offerId && a.quantity === b.quantity && a.currency === b.currency && a.unitPriceMinor === b.unitPriceMinor && a.totalPriceMinor === b.totalPriceMinor;

/** Existing validate POST is a quote read. It never accepts/reprices/merges a cart. */
export function createCartValidation(scope: ReadScope, fixture: CartCommandFixture | undefined, currentPage: () => WorkspaceCartPage | null, otherMutationLocked: () => boolean = () => false, native?: NativeCartCommands) {
 const commands = native ?? fixture;
 const owner = Object.freeze({ ...scope }), listeners = new Set<() => void>();
 let active = true, disposed = false, sequence = 0, state = idle, context: Context | null = null;
 const emit = (next: CartValidationState) => { state = Object.freeze(next); listeners.forEach(listener => listener()); };
 const available = () => active && (native ? nativeCartAvailable(native, owner) : authorizedCartFixture(owner, fixture)) && typeof commands?.validateCart === "function";
 const ownedCurrent = (page: WorkspaceCartPage) => currentPage() === page && page.current !== null && page.current.buyerOrganizationId === owner.organizationId && page.current.status === "ACTIVE" && page.current.checkout === null && Number.isInteger(page.current.version) && page.current.version > 0 && new Set(page.current.items.map(line => line.id)).size === page.current.items.length && page.current.items.every(line => line.cartId === page.current!.id) && page.items.every(cart => cart.buyerOrganizationId === owner.organizationId);
 const capture = (page: WorkspaceCartPage): Context => {
  const cart = page.current!;
  return Object.freeze({ page, cart, id: cart.id, version: cart.version, currency: cart.currency, lines: Object.freeze(cart.items.map(line => Object.freeze({ id: line.id, cartId: line.cartId, offerId: line.offerId, quantity: line.quantity, currency: line.currency, unitPriceMinor: line.unitPriceMinor, totalPriceMinor: line.totalPriceMinor }))) });
 };
 const sameContext = (value: Context) => ownedCurrent(value.page) && value.page.current === value.cart && value.cart.id === value.id && value.cart.version === value.version && value.cart.currency === value.currency && value.cart.items.length === value.lines.length && value.cart.items.every((line, index) => sameLine(line, value.lines[index]!));
 const canValidate = (page: WorkspaceCartPage) => available() && ownedCurrent(page) && !otherMutationLocked() && state.phase !== "pending" && !(state.phase === "error" && ["authentication", "denied"].includes(state.issue ?? ""));
 const decode = (body: unknown, value: Context): CartValidationResponse | null => {
  const root = rootBinding.safeParse(body); if (!root.success || root.data.cartId !== value.id || root.data.cartVersion !== value.version) return null;
  const bound = itemBinding.safeParse(body); if (!bound.success || bound.data.items.length !== value.lines.length || new Set(bound.data.items.map(item => item.cartItemId)).size !== value.lines.length || bound.data.items.some(item => !value.lines.some(line => line.id === item.cartItemId && line.offerId === item.offerId))) return null;
  const parsed = cartValidationResponseSchema.safeParse(body); if (!parsed.success) return null;
  // Identity and source line facts only: no price, total, tax, stock or rules engine.
  if (parsed.data.items.some(item => {
   const line = value.lines.find(row => row.id === item.cartItemId)!;
   return decimalIdentity(item.previous.quantity) !== decimalIdentity(line.quantity) || item.previous.currency !== line.currency || decimalIdentity(item.previous.unitPriceMinor) !== decimalIdentity(line.unitPriceMinor) || decimalIdentity(item.previous.totalPriceMinor) !== decimalIdentity(line.totalPriceMinor) || item.current !== null && (item.current.currency !== value.currency || decimalIdentity(item.current.quantity) !== decimalIdentity(line.quantity));
  })) return null;
  return parsed.data;
 };
 const denyAll = () => { active = false; sequence++; context = null; emit({ phase: "error", issue: "denied" }); };
 return {
  runtime: native ? "native-session" as const : "fixture" as const, getSnapshot: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  isAvailable: available, canValidate,
  blocksOtherMutations: () => active && state.phase === "pending",
  isCurrent(page: WorkspaceCartPage): boolean { return available() && !otherMutationLocked() && state.phase === "ready" && !!context && context.page === page && sameContext(context); },
  resultFor(page: WorkspaceCartPage): CartValidationResponse | null { return this.isCurrent(page) ? state.result ?? null : null; },
  async validate(page: WorkspaceCartPage) {
   if (!canValidate(page)) return; const captured = capture(page), ownSequence = ++sequence; context = captured;
   emit({ phase: "pending", cartId: captured.id, version: captured.version });
   try {
    const body = await commands!.validateCart!(owner, captured.id);
    if (!active || ownSequence !== sequence) return; if (!available()) { denyAll(); return; }
    if (!sameContext(captured) || otherMutationLocked()) { emit({ phase: "stale", cartId: captured.id, version: captured.version }); return; }
    const result = decode(body, captured);
    emit(result ? { phase: "ready", cartId: captured.id, version: captured.version, result } : { phase: "error", cartId: captured.id, version: captured.version, issue: "invalid-result" });
   } catch (error) {
    if (!active || ownSequence !== sequence) return; if (!available()) { denyAll(); return; }
    if (!sameContext(captured) || otherMutationLocked()) { emit({ phase: "stale", cartId: captured.id, version: captured.version }); return; }
    const parsed = typeof error === "object" && error !== null && "payload" in error && "status" in error ? errorResponseSchema.safeParse(error.payload) : null;
    const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
    const issue: Issue = parsed?.success && parsed.data.statusCode === status ? status === 400 ? "validation" : status === 401 ? "authentication" : status === 403 ? "denied" : status === 404 ? "not-found" : status === 409 ? "conflict" : "read-error" : "read-error";
    emit({ phase: "error", cartId: captured.id, version: captured.version, issue });
   }
  },
  denyAll,
  activate() { if (disposed) { disposed = false; active = true; } },
  dispose() { disposed = true; active = false; sequence++; context = null; state = idle; listeners.clear(); },
 };
}
export type CartValidation = ReturnType<typeof createCartValidation>;

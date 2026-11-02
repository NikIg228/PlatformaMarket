import { nativeCartAvailable, type NativeCartCommands } from "./native-cart-commands";
import { addCartItemSchema, cartVersionSchema } from "../../../packages/schemas/src/index";
import { cartItemResponseSchema, errorResponseSchema, type CartResponse, type OfferComparisonResponse } from "../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import { selectComparedOffer, type ReadScope } from "../../../contracts/mobile-read/read-adapter";
import { authorizedCartFixture, type CartAddInput, type CartCommandFixture } from "./cart-command-fixture";
import { checkCartAddOfferQuantity, usableOfferQuantityRules, type CartAddQuantityIssue } from "./cart-add-quantity";
import { decimalIdentity } from "./cart-quantity-draft";
import type { LocalListDraft, LocalListTarget } from "./local-list-draft";

type Choice = Readonly<{ target: LocalListTarget; raw: string; input: CartAddInput; currency: string; minimum: string; increment: string; productName: string; supplierName: string; packagingName: string }>;
type Item = CartResponse["items"][number];
type Frame = Readonly<{ page: WorkspaceCartPage; cart: CartResponse; cartId: string; version: number; currency: string; existingId?: string; existingQuantity?: string }>;
type Attempt = Readonly<{ choice: Choice; frame: Frame; input: CartAddInput }>;
export type CartAddState = Readonly<{
  phase: "idle" | "selected" | "pending" | "result" | "unknown" | "rejected" | "reading" | "review" | "prepared" | "read-error" | "observed";
  choice?: Choice;
  quantityIssue?: CartAddQuantityIssue;
  selectionIssue?: "source" | "availability" | "rules";
  selectionTarget?: LocalListTarget;
  checkedRaw?: string;
  result?: Item;
  latest?: WorkspaceCartPage;
  input?: CartAddInput;
  attemptedCartId?: string;
  sourceVersion?: number;
  priorUnknown?: boolean;
  issue?: "validation" | "authentication" | "denied" | "not-found" | "conflict" | "invalid-result" | "context";
}>;
const idle: CartAddState = Object.freeze({ phase: "idle" });
const itemRoot = cartItemResponseSchema.pick({ id: true, cartId: true, offerId: true }).strip();

export function createCartAddCommands(
  scope: ReadScope,
  fixture: CartCommandFixture | undefined,
  list: LocalListDraft,
  currentComparison: () => OfferComparisonResponse | null,
  currentPage: () => WorkspaceCartPage | null,
  reloadPage: () => Promise<WorkspaceCartPage | undefined>,
  otherMutationLocked: () => boolean = () => false,
  isWorkspaceActive: () => boolean = () => currentPage() !== null,
  supportsWorkspace: boolean = true,
  native?: NativeCartCommands,
) {
 const commands = native ?? fixture;
  const owner = Object.freeze({ ...scope }), listeners = new Set<() => void>();
  let active = true, disposed = false, sequence = 0, state = idle;
  let attempt: Attempt | null = null, prepared: Attempt | null = null, reviewed: WorkspaceCartPage | null = null;
  const emit = (next: CartAddState) => { state = Object.freeze(next); listeners.forEach(listener => listener()); };
  const sameScope = (): boolean => owner.product === list.context.product && owner.environment === list.context.environment && owner.userId === list.context.userId && owner.organizationId === list.context.organizationId && owner.generation === list.context.generation;
  const available = (): boolean => active && supportsWorkspace && sameScope() && (native ? nativeCartAvailable(native, owner) : authorizedCartFixture(owner, fixture)) && typeof commands?.addCartItem === "function";
  const blocks = (): boolean => active && !["idle", "selected", "observed"].includes(state.phase);
  const sourceValid = (choice: Choice): boolean => !!list.entryFor(choice.target);
  const ownedPage = (page: WorkspaceCartPage): boolean => currentPage() === page && (!page.current || page.current.buyerOrganizationId === owner.organizationId) && page.items.every(cart => cart.buyerOrganizationId === owner.organizationId);
  const frameFor = (page: WorkspaceCartPage, choice: Choice): Frame | null => {
    const cart = page.current;
    if (!ownedPage(page) || !cart || cart.status !== "ACTIVE" || cart.checkout !== null || cart.currency !== choice.currency || !cartVersionSchema.safeParse({ expectedVersion: cart.version }).success
      || cart.items.some(item => item.cartId !== cart.id) || new Set(cart.items.map(item => item.id)).size !== cart.items.length) return null;
    const lines = cart.items.filter(item => item.offerId === choice.input.offerId); if (lines.length > 1) return null;
    return Object.freeze({ page, cart, cartId: cart.id, version: cart.version, currency: cart.currency, existingId: lines[0]?.id, existingQuantity: lines[0]?.quantity });
  };
  const sameFrame = (frame: Frame, choice: Choice): boolean => {
    const now = frameFor(frame.page, choice);
    return !!now && now.cart === frame.cart && now.cartId === frame.cartId && now.version === frame.version && now.currency === frame.currency && now.existingId === frame.existingId && now.existingQuantity === frame.existingQuantity;
  };
  const canChoose = (target: LocalListTarget): boolean => available() && !otherMutationLocked() && !blocks() && !!list.entryFor(target);
  const initialChoiceCurrent = (choice: Choice): boolean => sourceValid(choice) && list.entryFor(choice.target)?.quantityText === choice.raw;
  const canSubmit = (page: WorkspaceCartPage): boolean => available() && !otherMutationLocked() && !!state.choice && ["selected", "observed"].includes(state.phase) && initialChoiceCurrent(state.choice) && !!frameFor(page, state.choice);
  const denyAll = () => { active = false; sequence++; attempt = null; prepared = null; reviewed = null; emit({ phase: "rejected", issue: "denied" }); };
  const execute = async (work: Attempt) => {
    attempt = work; prepared = null; reviewed = null; const ownSequence = ++sequence;
    emit({ phase: "pending", choice: work.choice, input: work.input, attemptedCartId: work.frame.cartId, sourceVersion: work.frame.version, priorUnknown: state.priorUnknown });
    const unknown = (issue?: CartAddState["issue"]) => emit({ ...state, phase: "unknown", priorUnknown: true, issue, result: undefined });
    try {
      const body = await commands!.addCartItem!(owner, work.frame.cartId, work.input);
      if (!active || ownSequence !== sequence) return;
      if (!available()) { denyAll(); return; }
      if (!sameFrame(work.frame, work.choice) || !sourceValid(work.choice)) { unknown("context"); return; }
      const root = itemRoot.safeParse(body);
      // This endpoint addresses an offer, not an item ID. A concurrent remove
      // and upsert can legitimately return a new line UUID for that offer.
      if (!root.success || root.data.cartId !== work.frame.cartId || root.data.offerId !== work.input.offerId) { unknown("invalid-result"); return; }
      const value = cartItemResponseSchema.safeParse(body);
      if (!value.success || value.data.currency !== work.frame.currency || decimalIdentity(value.data.quantity) !== decimalIdentity(String(work.input.quantity))) { unknown("invalid-result"); return; }
      emit({ ...state, phase: "result", result: value.data, issue: undefined });
    } catch (error) {
      if (!active || ownSequence !== sequence) return;
      if (!available()) { denyAll(); return; }
      if (!sameFrame(work.frame, work.choice) || !sourceValid(work.choice)) { unknown("context"); return; }
      const parsed = typeof error === "object" && error !== null && "payload" in error && "status" in error ? errorResponseSchema.safeParse(error.payload) : null;
      const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
      if (!parsed?.success || parsed.data.statusCode !== status || ![400, 401, 403, 404, 409].includes(status as number)) { unknown(); return; }
      emit({ ...state, phase: "rejected", issue: status === 400 ? "validation" : status === 401 ? "authentication" : status === 403 ? "denied" : status === 404 ? "not-found" : "conflict" });
    }
  };
  return {
    runtime: native ? "native-session" as const : "fixture" as const, getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    isAvailable: available, blocksOtherMutations: blocks, canChoose, canSubmit,
    selectedCurrency(): string | undefined { return available() && state.choice && sourceValid(state.choice) ? state.choice.currency : undefined; },
    select(target: LocalListTarget, comparison: OfferComparisonResponse): "selected" | "quantity" | "unavailable" {
      if (!canChoose(target) || currentComparison() !== comparison || comparison.product.id !== target.productId || comparison.selectedVariantId !== target.variantId) return "unavailable";
      const offer = selectComparedOffer(comparison, target.variantId, target.offerId), entry = list.entryFor(target)!;
      if (!offer) { emit({ ...state, selectionIssue: "source", quantityIssue: undefined, selectionTarget: target }); return "unavailable"; }
      if (!offer.availability.some(row => { const value = decimalIdentity(row.quantityAvailable); return value !== null && value !== "0" && !value.startsWith("-"); })) { emit({ ...state, selectionIssue: "availability", quantityIssue: undefined, selectionTarget: target }); return "unavailable"; }
      if (!usableOfferQuantityRules(offer.minimumOrderQuantity, offer.orderIncrement)) { emit({ ...state, selectionIssue: "rules", quantityIssue: undefined, selectionTarget: target }); return "unavailable"; }
      const issue = checkCartAddOfferQuantity(entry.quantityText, offer.minimumOrderQuantity, offer.orderIncrement);
      if (issue) { emit({ ...state, quantityIssue: issue, selectionIssue: undefined, selectionTarget: target, checkedRaw: entry.quantityText }); return "quantity"; }
      const input = Object.freeze(addCartItemSchema.parse({ offerId: target.offerId, quantity: Number(entry.quantityText.trim().replace(",", ".")) }));
      const choice: Choice = Object.freeze({ target, raw: entry.quantityText, input, currency: offer.price.currency, minimum: offer.minimumOrderQuantity, increment: offer.orderIncrement, productName: comparison.product.name, supplierName: offer.supplier.name, packagingName: offer.packaging.name });
      attempt = null; prepared = null; reviewed = null; emit({ phase: "selected", choice, priorUnknown: state.priorUnknown }); return "selected";
    },
    async submit(page: WorkspaceCartPage) { if (canSubmit(page)) { const choice = state.choice!; await execute(Object.freeze({ choice, input: choice.input, frame: frameFor(page, choice)! })); } },
    sourceIsCurrent(): boolean { return !!state.choice && initialChoiceCurrent(state.choice); },
    existingQuantity(page: WorkspaceCartPage): string | undefined { return state.choice ? frameFor(page, state.choice)?.existingQuantity : undefined; },
    canRead(): boolean { return available() && !!attempt && isWorkspaceActive() && ["result", "unknown", "rejected", "read-error", "review", "prepared"].includes(state.phase); },
    async readCurrent() {
      if (!this.canRead()) return;
      prepared = null;
      const ownSequence = ++sequence; emit({ ...state, phase: "reading", input: attempt!.input, attemptedCartId: attempt!.frame.cartId, sourceVersion: attempt!.frame.version, result: undefined, latest: undefined });
      try {
        const page = await reloadPage(); if (!active || ownSequence !== sequence) return;
        if (!available()) { denyAll(); return; }
        if (!page || !ownedPage(page)) { emit({ ...state, phase: "read-error", latest: undefined }); return; }
        reviewed = page; emit({ ...state, phase: "review", latest: page, issue: undefined });
      } catch { if (active && ownSequence === sequence) emit({ ...state, phase: "read-error", latest: undefined }); }
    },
    canPrepare(): boolean { return available() && !otherMutationLocked() && state.phase === "review" && !!attempt && !!reviewed && sourceValid(attempt.choice) && !!frameFor(reviewed, attempt.choice); },
    prepareNew() {
      if (!this.canPrepare()) return;
      prepared = Object.freeze({ choice: attempt!.choice, input: Object.freeze({ ...attempt!.input }), frame: frameFor(reviewed!, attempt!.choice)! });
      emit({ ...state, phase: "prepared", input: prepared.input, sourceVersion: prepared.frame.version, attemptedCartId: prepared.frame.cartId, latest: undefined });
    },
    canSubmitPrepared(): boolean { return available() && !otherMutationLocked() && state.phase === "prepared" && !!prepared && sourceValid(prepared.choice) && sameFrame(prepared.frame, prepared.choice); },
    async submitPrepared() { if (this.canSubmitPrepared()) await execute(prepared!); },
    returnToReview() { if (available() && state.phase === "prepared" && reviewed && ownedPage(reviewed)) { prepared = null; emit({ ...state, phase: "review", input: attempt?.input, attemptedCartId: attempt?.frame.cartId, sourceVersion: attempt?.frame.version, latest: reviewed }); } },
    canAcknowledge(): boolean { return available() && state.phase === "review" && !!reviewed && ownedPage(reviewed); },
    acknowledge(): boolean {
      if (!this.canAcknowledge()) return false;
      attempt = null; prepared = null; reviewed = null; emit({ phase: "observed", choice: state.choice, priorUnknown: state.priorUnknown }); return true;
    },
    resultCartId(): string | null { return available() && state.phase === "result" && attempt && sameFrame(attempt.frame, attempt.choice) ? attempt.frame.cartId : null; },
    discard() { if (available() && ["idle", "selected", "observed"].includes(state.phase)) { attempt = null; prepared = null; reviewed = null; emit({ phase: "idle", priorUnknown: state.priorUnknown }); } },
    activate() { if (disposed) { disposed = false; active = true; } }, denyAll,
    dispose() { disposed = true; active = false; sequence++; attempt = null; prepared = null; reviewed = null; state = idle; listeners.clear(); },
  };
}
export type CartAddCommands = ReturnType<typeof createCartAddCommands>;

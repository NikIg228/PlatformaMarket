import type { WorkspaceCartPage } from "../../../../packages/schemas/src/workspace-reads";
import type { MobileReadQuery } from "../../../../contracts/mobile-read/read-queries";
import type { ReadScope } from "../read-controller";
import { createMarketOperationScope } from "../market-operation-scope";
import { createScopedCoreReadQueries } from "../scoped-core-read-queries";
import { bindMarketReads } from "../market-transport";
import { createCartCommandTransport, type CartMutationMethod } from "../cart-command-transport";
import { createCartQuantityCommands } from "../cart-command-fixture";
import { createCartQuantityDrafts } from "../cart-quantity-draft";
import { cartCommandAuthorization } from "./cart-commands";

export type CartObservationKind = "quantity" | "remove";
export const cartObservationActions = ["review", "close-read", "prepare", "observe-workspace"] as const;
export type CartObservationAction = typeof cartObservationActions[number];
type Query = Extract<MobileReadQuery, { kind: "workspace-carts" }>;
/** Explicit source observation composition. Source CAS model performs its own review, no invented key or second write. */
export function createCartObservationKernel(scope: ReadScope, query: Query, read: (path: string) => Promise<unknown>, exchange: (method: CartMutationMethod, path: string, body?: Readonly<object>) => Promise<unknown>) {
  let active = true, retainedPriorRead = false, page: WorkspaceCartPage | null = null;
  const lifetime = createMarketOperationScope(scope, () => active, () => Error("Offline cart observation context unavailable"));
  const client = bindMarketReads(async path => { lifetime.assert(scope); const body = await read(path); lifetime.assert(scope); return body; }, scope.organizationId), queries = createScopedCoreReadQueries(scope, client), drafts = createCartQuantityDrafts(scope);
  const load = async () => {
    const before = queries.getState(), outcome = await queries.load(query), state = queries.getState();
    retainedPriorRead = outcome === "applied" && state === before && "read" in state;
    if ("read" in state && state.read.kind === "workspace-carts") { page = state.read.value; drafts.syncCurrent(page.current); return outcome === "applied" && !retainedPriorRead ? page : undefined; }
    page = null; drafts.syncCurrent(null); return undefined;
  };
  const raw = createCartCommandTransport(scope, exchange, () => active), fixture = { authorization: { ...cartCommandAuthorization(), scope }, updateCartItem: raw.update, removeCartItem: raw.remove };
  const model = createCartQuantityCommands(scope, fixture, drafts, () => page?.current ?? null, async () => (await load())?.current, () => false, () => page);
  return { model, drafts, load, page: () => page, retainedPriorRead: () => retainedPriorRead, readState: queries.getState, close() { active = false; lifetime.close(); model.dispose(); drafts.close(); raw.close(); queries.reset(scope, client); page = null; } };
}
type Kernel = ReturnType<typeof createCartObservationKernel>;
export async function submitCartObservationInitial(kernel: Kernel, kind: CartObservationKind, itemId: string, quantity: unknown): Promise<boolean> {
  const cart = kernel.page()?.current, item = cart?.items.find(row => row.id === itemId); if (!cart || !item) return false;
  if (kind === "quantity") { if (typeof quantity !== "number" || !kernel.drafts.begin(cart, item)) return false; kernel.drafts.change(cart, item, String(quantity)); if (!kernel.model.canSubmit(cart, item)) return false; await kernel.model.submit(cart, item); }
  else { kernel.model.beginRemove(cart, item); if (!kernel.model.canConfirmRemove(cart.id, item.id)) return false; await kernel.model.confirmRemove(cart.id, item.id); }
  return true;
}
export function applyCartObservationAction(kernel: Kernel, cartId: string, itemId: string, action: CartObservationAction): boolean {
  const model = kernel.model;
  if (action === "review") return model.stateFor(cartId).phase === "review";
  if (action === "close-read") return model.closeRead(cartId, itemId);
  if (action === "prepare") { if (!model.canReview(cartId, itemId)) return false; model.review(cartId, itemId); return ["prepared", "confirm-remove"].includes(model.stateFor(cartId).phase); }
  const selected = model.workspaceObservation(cartId, itemId); return !!selected && model.observeWorkspace(cartId, itemId, selected);
}

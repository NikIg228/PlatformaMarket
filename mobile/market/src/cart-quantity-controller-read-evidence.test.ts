import { createReadController, type MobileReadClient } from "./read-controller";
import type { CartCommandFixture } from "./cart-command-fixture";
import { cartCommandScope, cartCommandAuthorization, commandCart, cartCommandError } from "./test-fixtures/cart-commands";
import { savedPage } from "./test-fixtures/carts";
import { listDraftPayload } from "./test-fixtures/list-draft";

type Operation = "quantity" | "remove";
type Outcome = "unknown" | "conflict";
async function setup(operation: Operation = "quantity", outcome: Outcome = "unknown") {
  let current: ReturnType<typeof commandCart> | null = commandCart(3);
  const fail = async (): Promise<unknown> => { throw outcome === "conflict" ? cartCommandError(409) : new Error("SYNTHETIC response lost"); };
  const update = jest.fn(fail), remove = jest.fn(fail);
  const fixture: CartCommandFixture = { authorization: cartCommandAuthorization(), updateCartItem: update, removeCartItem: remove };
  const read = jest.fn(async () => savedPage(current, []));
  const client: MobileReadClient = {
    searchCatalog: async () => listDraftPayload("catalog-empty"),
    compareOffers: async () => listDraftPayload("comparison-exact-offer"),
    workspaceOrders: async () => listDraftPayload("workspace-orders-page"),
    getOrderWorkflow: async () => listDraftPayload("order-workflow-minimal"),
    workspaceCarts: read, workspaceCart: async () => current, cartCommandFixture: fixture,
  };
  const controller = createReadController({ scope: cartCommandScope, client });
  controller.subscribe(() => {});
  await controller.load({ kind: "workspace-carts", input: { limit: 1, q: "" } });
  const state = controller.getSnapshot().state;
  if (!("read" in state) || state.read.kind !== "workspace-carts" || !state.read.value.current) throw new Error("Missing fixture cart");
  const cart = state.read.value.current, item = cart.items[0]!;
  controller.quantityDrafts.begin(cart, item);
  controller.quantityDrafts.change(cart, item, " 3,5 ");
  if (operation === "quantity") await controller.cartQuantityCommands.submit(cart, item);
  else { controller.cartQuantityCommands.beginRemove(cart, item); await controller.cartQuantityCommands.confirmRemove(cart.id, item.id); }
  return { controller, cart, item, update, remove, read, command: operation === "quantity" ? update : remove, setCurrent(value: typeof current) { current = value; } };
}

const attempts: [Operation, Outcome][] = [["quantity", "unknown"], ["quantity", "conflict"], ["remove", "unknown"], ["remove", "conflict"]];
it.each(attempts)("keeps a retained newer view unconfirmed after %s/%s when GET returns an older cart", async (operation, outcome) => {
  const s = await setup(operation, outcome);
  try {
    expect(s.controller.cartQuantityCommands.stateFor(s.cart.id).phase).toBe(outcome);
    s.setCurrent(commandCart(2));
    await s.controller.cartQuantityCommands.readCurrent(s.cart.id, s.item.id);
    expect(s.controller.cartQuantityCommands.stateFor(s.cart.id)).toMatchObject({ phase: "read-error", priorUnknown: outcome === "unknown" ? true : undefined, input: { expectedVersion: 3 } });
    expect(s.controller.cartQuantityCommands.canReview(s.cart.id, s.item.id)).toBe(false);
    expect(s.controller.cartQuantityCommands.canCloseRead(s.cart.id, s.item.id)).toBe(false);
    s.controller.cartQuantityCommands.review(s.cart.id, s.item.id);
    expect(s.controller.cartQuantityCommands.closeRead(s.cart.id, s.item.id)).toBe(false);
    expect(s.controller.cartQuantityCommands.stateFor(s.cart.id).phase).toBe("read-error");
    const view = s.controller.getSnapshot().state;
    expect("read" in view && view.read.kind === "workspace-carts" && view.read.value.current).toBe(s.cart);
    expect(s.command).toHaveBeenCalledTimes(1);
    expect(s.read).toHaveBeenCalledTimes(2);
  } finally { s.controller.dispose(); }
});

it.each(attempts.flatMap(([operation, outcome]) => [3, 4].map(version => ({ operation, outcome, version }))))("accepts an independently read version $version for $operation/$outcome without sending again", async ({ operation, outcome, version }) => {
  const s = await setup(operation, outcome);
  try {
    s.setCurrent(commandCart(version, "4"));
    await s.controller.cartQuantityCommands.readCurrent(s.cart.id, s.item.id);
    expect(s.controller.cartQuantityCommands.stateFor(s.cart.id)).toMatchObject({ phase: "review", priorUnknown: outcome === "unknown" ? true : undefined, latest: { version } });
    expect(s.controller.cartQuantityCommands.canReview(s.cart.id, s.item.id)).toBe(true);
    s.controller.cartQuantityCommands.review(s.cart.id, s.item.id);
    expect(s.controller.cartQuantityCommands.stateFor(s.cart.id)).toMatchObject({ phase: operation === "quantity" ? "prepared" : "confirm-remove", input: { expectedVersion: version } });
    expect(s.command).toHaveBeenCalledTimes(1);
    expect(s.read).toHaveBeenCalledTimes(2);
  } finally { s.controller.dispose(); }
});

it.each(attempts.flatMap(([operation, outcome]) => ["absent", "different"].map(source => ({ operation, outcome, source }))))("keeps $source current-cart observation distinct from a failed read for $operation/$outcome", async ({ operation, outcome, source }) => {
  const s = await setup(operation, outcome);
  try {
    const different = commandCart(1);
    different.id = "00000000-0000-4000-8000-000000000078";
    different.items.forEach(item => { item.cartId = different.id; });
    s.setCurrent(source === "absent" ? null : different);
    await s.controller.cartQuantityCommands.readCurrent(s.cart.id, s.item.id);
    expect(s.controller.cartQuantityCommands.stateFor(s.cart.id)).toMatchObject({ phase: "source-changed", priorUnknown: true });
    expect(s.controller.cartQuantityCommands.canReview(s.cart.id, s.item.id)).toBe(false);
    expect(s.command).toHaveBeenCalledTimes(1);
  } finally { s.controller.dispose(); }
});

it.each(["quantity", "remove"] as const)("permits another explicit read after a retained older %s observation, without retrying the mutation", async operation => {
  const s = await setup(operation);
  try {
    s.setCurrent(commandCart(2));
    await s.controller.cartQuantityCommands.readCurrent(s.cart.id, s.item.id);
    expect(s.controller.cartQuantityCommands.stateFor(s.cart.id).phase).toBe("read-error");
    s.setCurrent(commandCart(3));
    await s.controller.cartQuantityCommands.readCurrent(s.cart.id, s.item.id);
    expect(s.controller.cartQuantityCommands.stateFor(s.cart.id)).toMatchObject({ phase: "review", priorUnknown: true });
    expect(s.controller.cartQuantityCommands.closeRead(s.cart.id, s.item.id)).toBe(true);
    expect(s.controller.cartQuantityCommands.stateFor(s.cart.id)).toMatchObject({ phase: "observed", priorUnknown: true });
    expect(s.command).toHaveBeenCalledTimes(1);
    expect(s.read).toHaveBeenCalledTimes(3);
  } finally { s.controller.dispose(); }
});

it.each(["quantity", "remove"] as const)("does not use the retained view after a failed %s reconciliation request", async operation => {
  const s = await setup(operation);
  try {
    s.read.mockRejectedValueOnce(new Error("SYNTHETIC read unavailable"));
    await s.controller.cartQuantityCommands.readCurrent(s.cart.id, s.item.id);
    expect(s.controller.cartQuantityCommands.stateFor(s.cart.id)).toMatchObject({ phase: "read-error", priorUnknown: true });
    expect(s.controller.cartQuantityCommands.canReview(s.cart.id, s.item.id)).toBe(false);
    expect(s.command).toHaveBeenCalledTimes(1);
  } finally { s.controller.dispose(); }
});

it.each((["quantity", "remove"] as const).flatMap(operation => ["dispose", "navigate"].map(change => ({ operation, change }))))("discards a late $operation observation after $change", async ({ operation, change }) => {
  const s = await setup(operation);
  let finish!: (page: ReturnType<typeof savedPage>) => void;
  try {
    s.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = s.controller.cartQuantityCommands.readCurrent(s.cart.id, s.item.id);
    expect(s.controller.cartQuantityCommands.stateFor(s.cart.id).phase).toBe("reading");
    if (change === "dispose") s.controller.dispose();
    else await s.controller.load({ kind: "workspace-carts", input: { limit: 1, q: "different selection" } });
    finish(savedPage(commandCart(4), []));
    await pending;
    expect(s.controller.cartQuantityCommands.stateFor(s.cart.id).phase).not.toBe("review");
    expect(s.controller.cartQuantityCommands.canReview(s.cart.id, s.item.id)).toBe(false);
    expect(s.command).toHaveBeenCalledTimes(1);
  } finally { s.controller.dispose(); }
});

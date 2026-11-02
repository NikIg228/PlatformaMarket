import type { CartResponse } from "../../../packages/schemas/src/core-api";
import { createReadController, type ReadController, type MobileReadClient } from "./read-controller";
import type { CartCommandFixture } from "./cart-command-fixture";
import { cartCommandScope, cartCommandAuthorization, commandCart, addCommandCart, cartAddComparison, recoveryCartSource } from "./test-fixtures/cart-commands";
import { savedPage } from "./test-fixtures/carts";
import { listDraftPayload } from "./test-fixtures/list-draft";
import { cartValidationResult } from "./test-fixtures/cart-validation";
import { repriceValidation } from "./test-fixtures/cart-reprice";

type Operation = "create" | "recover" | "add" | "reprice" | "checkout";
const operations: Operation[] = ["create", "recover", "add", "reprice", "checkout"];
function pageFor(controller: ReadController) {
  const state = controller.getSnapshot().state;
  if (!("read" in state) || state.read.kind !== "workspace-carts") throw new Error("Missing fixture workspace");
  return state.read.value;
}
async function setup(operation: Operation) {
  const cartAt = (version: number) => {
    const cart = operation === "add" ? addCommandCart(version) : commandCart(version);
    if (operation === "recover") cart.items = [];
    return cart;
  };
  let current: CartResponse | null = operation === "create" ? null : cartAt(3);
  const rows = operation === "recover" ? [recoveryCartSource()] : [];
  const comparison = cartAddComparison();
  const send = jest.fn(async (): Promise<unknown> => { throw new Error("SYNTHETIC response lost"); });
  const key = jest.fn(() => "SYNTHETIC controller checkout original key");
  const fixture: CartCommandFixture = {
    authorization: cartCommandAuthorization(), createCart: send, recoverCart: send,
    addCartItem: send, repriceCart: send, checkoutCart: send, nextCheckoutIdempotencyKey: key,
    validateCart: async () => operation === "reprice" ? repriceValidation(current!) : cartValidationResult(current!),
  };
  const read = jest.fn(async () => savedPage(current, rows));
  const client: MobileReadClient = {
    searchCatalog: async () => listDraftPayload("catalog-empty"), compareOffers: async () => comparison,
    workspaceOrders: async () => listDraftPayload("workspace-orders-page"), getOrderWorkflow: async () => listDraftPayload("order-workflow-minimal"),
    workspaceCarts: read, workspaceCart: async () => current, cartCommandFixture: fixture,
  };
  const controller = createReadController({ scope: cartCommandScope, client });
  controller.subscribe(() => {});
  if (operation === "add") {
    await controller.load({ kind: "comparison", input: { productId: comparison.product.id, quantity: 1, ...(comparison.selectedVariantId ? { variantId: comparison.selectedVariantId } : {}) } });
    const state = controller.getSnapshot().state;
    if (!("read" in state) || state.read.kind !== "comparison") throw new Error("Missing fixture comparison");
    const value = state.read.value, target = controller.localListDraft.begin(value, value.offers[0]!.offerId)!;
    controller.localListDraft.setText(target, "quantityText", " 3,5 ");
    expect(controller.cartAddCommands.select(target, value)).toBe("selected");
  }
  await controller.load({ kind: "workspace-carts", input: { limit: 1, q: "" } });
  const page = pageFor(controller), cartId = page.current?.id ?? commandCart().id;
  if (operation === "create") {
    await controller.cartWorkspaceCommands.start(page);
    // A separate display refresh can discover a current cart while the lost create remains unconfirmed.
    current = cartAt(3); await controller.retry();
  } else if (operation === "recover") await controller.cartWorkspaceCommands.startRecovery(page, page.items[0]!);
  else if (operation === "add") await controller.cartAddCommands.submit(page);
  else {
    await controller.cartValidation.validate(page);
    if (operation === "reprice") { expect(controller.cartReprice.prepare(page)).toBe(true); await controller.cartReprice.confirm(); }
    else { expect(controller.cartCheckout.prepare(page)).toBe(true); await controller.cartCheckout.confirm(cartId); }
  }
  const state = () => operation === "checkout" ? controller.cartCheckout.stateFor(cartId) : operation === "reprice" ? controller.cartReprice.getSnapshot() : operation === "add" ? controller.cartAddCommands.getSnapshot() : controller.cartWorkspaceCommands.getSnapshot();
  const observe = () => operation === "checkout" ? controller.cartCheckout.readCurrent(cartId) : operation === "reprice" ? controller.cartReprice.readCurrent() : operation === "add" ? controller.cartAddCommands.readCurrent() : controller.cartWorkspaceCommands.readCurrent();
  const acknowledge = () => operation === "checkout" ? controller.cartCheckout.acknowledge(cartId) : operation === "reprice" ? controller.cartReprice.acknowledge() : operation === "add" ? controller.cartAddCommands.acknowledge() : controller.cartWorkspaceCommands.acknowledge();
  expect(send).toHaveBeenCalledTimes(1);
  expect(state().phase).toBe("unknown");
  return { controller, send, key, read, cartId, state, observe, acknowledge, cartAt, setCurrent(cart: CartResponse | null) { current = cart; } };
}

it.each(operations)("does not acknowledge a retained newer workspace after an older %s reconciliation DTO", async operation => {
  const s = await setup(operation);
  try {
    const before = pageFor(s.controller);
    s.setCurrent(s.cartAt(2));
    await s.observe();
    expect(pageFor(s.controller)).toBe(before);
    expect(s.state().phase).toBe("read-error");
    expect(s.acknowledge()).toBe(false);
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.key).toHaveBeenCalledTimes(operation === "checkout" ? 1 : 0);
  } finally { s.controller.dispose(); }
});

it.each(operations.flatMap(operation => [3, 4].map(version => ({ operation, version }))))("accepts a fresh workspace version $version after unknown $operation without another command", async ({ operation, version }) => {
  const s = await setup(operation);
  try {
    const before = pageFor(s.controller);
    s.setCurrent(s.cartAt(version));
    await s.observe();
    expect(pageFor(s.controller)).not.toBe(before);
    expect(s.state().phase).toBe("review");
    expect(s.acknowledge()).toBe(true);
    expect(s.state().phase).toBe("observed");
    if (operation === "checkout") expect(s.controller.cartCheckout.stateFor(s.cartId).unresolved).toBe(true);
    else expect(s.state()).toMatchObject({ priorUnknown: true });
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.key).toHaveBeenCalledTimes(operation === "checkout" ? 1 : 0);
  } finally { s.controller.dispose(); }
});

it.each(operations.flatMap(operation => ["absent", "different"].map(source => ({ operation, source }))))("accepts an independent $source current-cart fact after unknown $operation", async ({ operation, source }) => {
  const s = await setup(operation);
  try {
    const different = s.cartAt(1);
    different.id = "00000000-0000-4000-8000-000000000078";
    different.items.forEach(item => { item.cartId = different.id; });
    s.setCurrent(source === "absent" ? null : different);
    await s.observe();
    expect(s.state().phase).toBe("review");
    expect(pageFor(s.controller).current?.id ?? null).toBe(source === "absent" ? null : different.id);
    expect(s.acknowledge()).toBe(true);
    if (operation === "checkout") expect(s.controller.cartCheckout.stateFor(s.cartId).unresolved).toBe(true);
    else expect(s.state()).toMatchObject({ priorUnknown: true });
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.key).toHaveBeenCalledTimes(operation === "checkout" ? 1 : 0);
  } finally { s.controller.dispose(); }
});

it.each(operations)("does not acknowledge a failed independent %s workspace request", async operation => {
  const s = await setup(operation);
  try {
    s.read.mockRejectedValueOnce(new Error("SYNTHETIC workspace request unavailable"));
    await s.observe();
    expect(s.state().phase).toBe("read-error");
    expect(s.acknowledge()).toBe(false);
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.key).toHaveBeenCalledTimes(operation === "checkout" ? 1 : 0);
  } finally { s.controller.dispose(); }
});

it.each(operations.flatMap(operation => ["dispose", "selection"].map(change => ({ operation, change }))))("discards late $operation reconciliation after $change changes", async ({ operation, change }) => {
  const s = await setup(operation);
  let finish!: (page: ReturnType<typeof savedPage>) => void;
  try {
    s.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = s.observe();
    expect(s.state().phase).toBe("reading");
    if (change === "dispose") s.controller.dispose();
    else await s.controller.load({ kind: "workspace-carts", input: { limit: 1, q: "other selection" } });
    finish(savedPage(s.cartAt(4), []));
    await pending;
    expect(s.state().phase).not.toBe("review");
    expect(s.acknowledge()).toBe(false);
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.key).toHaveBeenCalledTimes(operation === "checkout" ? 1 : 0);
  } finally { s.controller.dispose(); }
});

it.each(operations)("allows another explicit observation after a stale %s DTO without retrying the command", async operation => {
  const s = await setup(operation);
  try {
    s.setCurrent(s.cartAt(2));
    await s.observe();
    expect(s.state().phase).toBe("read-error");
    s.setCurrent(s.cartAt(3));
    await s.observe();
    expect(s.state().phase).toBe("review");
    expect(s.acknowledge()).toBe(true);
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.key).toHaveBeenCalledTimes(operation === "checkout" ? 1 : 0);
  } finally { s.controller.dispose(); }
});

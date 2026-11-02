import type { WorkspaceCartPage } from "../../../../packages/schemas/src/workspace-reads";
import type { ReadScope } from "../read-controller";
import { createCartCommandTransport, type CartMutationMethod } from "../cart-command-transport";
import { createCartValidation } from "../cart-validation-fixture";
import { createCartReprice, type CartReprice } from "../cart-reprice-fixture";
import { createCartCheckout, type CartCheckout } from "../cart-checkout-fixture";
import { createCartQuantityDrafts } from "../cart-quantity-draft";
import { cartCommandAuthorization } from "./cart-commands";

/** Test-only composition. Its synthetic authority never admits a native business operation. */
export function createCartCaptureKernel(scope: ReadScope, page: WorkspaceCartPage, exchange: (method: CartMutationMethod, path: string, body?: Readonly<object>) => Promise<unknown>, capturedKey: () => string) {
  let active = true, reloads = 0, reprice: CartReprice | undefined, checkout: CartCheckout | undefined;
  const raw = createCartCommandTransport(scope, exchange, () => active);
  const fixture = {
    authorization: { ...cartCommandAuthorization(), scope },
    validateCart: raw.validate, repriceCart: raw.reprice, checkoutCart: raw.checkout,
    nextCheckoutIdempotencyKey: capturedKey,
  };
  const drafts = createCartQuantityDrafts(scope); drafts.syncCurrent(page.current);
  const validation = createCartValidation(scope, fixture, () => page, () => !!reprice?.blocksOtherMutations() || !!checkout?.blocksOtherMutations());
  const reload = async () => { reloads++; return undefined; };
  reprice = createCartReprice(scope, fixture, validation, () => page, reload, () => validation.blocksOtherMutations() || !!checkout?.blocksOtherMutations(), () => active);
  checkout = createCartCheckout(scope, fixture, validation, drafts, () => page, reload, () => validation.blocksOtherMutations() || !!reprice?.blocksOtherMutations(), () => active);
  return {
    validation, reprice, checkout, reloads: () => reloads,
    close() { active = false; validation.dispose(); reprice!.dispose(); checkout!.dispose(); drafts.close(); raw.close(); },
  };
}

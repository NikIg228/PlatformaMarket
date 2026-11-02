import type { OfferComparisonResponse } from "../../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../../packages/schemas/src/workspace-reads";
import type { ReadScope } from "../read-controller";
import { createCartCommandTransport, type CartMutationMethod } from "../cart-command-transport";
import { createCartAddCommands } from "../cart-add-command-fixture";
import { createLocalListDraft } from "../local-list-draft";
import { cartCommandAuthorization } from "./cart-commands";

/** Standalone source-fixture composition only; never native operation admission. */
export function createCartAddCaptureKernel(scope: ReadScope, comparison: OfferComparisonResponse, page: WorkspaceCartPage, exchange: (method: CartMutationMethod, path: string, body?: Readonly<object>) => Promise<unknown>) {
  let active = true, reloads = 0;
  const raw = createCartCommandTransport(scope, exchange, () => active), list = createLocalListDraft(scope); list.syncComparison(comparison);
  const fixture = { authorization: { ...cartCommandAuthorization(), scope }, addCartItem: raw.add };
  const model = createCartAddCommands(scope, fixture, list, () => comparison, () => page, async () => { reloads++; return undefined; }, () => false, () => active, true);
  return { list, model, reloads: () => reloads, close() { active = false; model.dispose(); list.close(); raw.close(); } };
}

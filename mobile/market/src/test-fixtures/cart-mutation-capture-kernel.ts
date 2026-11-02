import type { WorkspaceCartPage } from "../../../../packages/schemas/src/workspace-reads";
import type { ReadScope } from "../read-controller";
import { createCartCommandTransport, type CartMutationMethod } from "../cart-command-transport";
import { createCartQuantityCommands } from "../cart-command-fixture";
import { createCartWorkspaceCommands, type CartWorkspaceCommands } from "../cart-workspace-command-fixture";
import { createCartQuantityDrafts } from "../cart-quantity-draft";
import { cartCommandAuthorization } from "./cart-commands";

export const cartMutationCaptureKinds = ["create", "recover", "quantity", "remove"] as const;
export type CartMutationCaptureKind = typeof cartMutationCaptureKinds[number];

/** Synthetic-only model authority; no native business admission, key provider or real transport. */
export function createCartMutationCaptureKernel(scope: ReadScope, page: WorkspaceCartPage, exchange: (method: CartMutationMethod, path: string, body?: Readonly<object>) => Promise<unknown>) {
  let active = true, reloads = 0, workspace: CartWorkspaceCommands | undefined;
  const raw = createCartCommandTransport(scope, exchange, () => active);
  const fixture = { authorization: { ...cartCommandAuthorization(), scope }, createCart: raw.create, recoverCart: raw.recover, updateCartItem: raw.update, removeCartItem: raw.remove };
  const drafts = createCartQuantityDrafts(scope); drafts.syncCurrent(page.current);
  const quantity = createCartQuantityCommands(scope, fixture, drafts, () => page.current, async () => { reloads++; return undefined; }, () => !!workspace?.blocksOtherMutations(), () => page);
  workspace = createCartWorkspaceCommands(scope, fixture, () => page, async () => { reloads++; return undefined; }, () => !!page.current && quantity.isLocked(page.current.id), () => active);
  return { drafts, quantity, workspace, reloads: () => reloads, close() { active = false; quantity.dispose(); workspace!.dispose(); drafts.close(); raw.close(); } };
}

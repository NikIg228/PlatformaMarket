import { createBuyerWorkspaceTransport } from "./buyer-workspace-transport";
import type { OrderCommentsFixtureClient } from "./order-comments-fixture-read";
import type { SavedListsFixtureClient } from "./saved-lists-fixture-read";
import type { ReadScope } from "./read-controller";

/** Existing authenticated GET routes. The view decoders still validate own identities before content. */
export function bindNativeBuyerWorkspaceReads(scope: ReadScope, read: (path: string) => Promise<unknown>, isCurrent: () => boolean): Readonly<Required<SavedListsFixtureClient & OrderCommentsFixtureClient>> {
  const transport = createBuyerWorkspaceTransport(scope, read, async () => { throw Error("Native workspace read binding cannot write"); }, isCurrent);
  return Object.freeze({ savedListsFixture: transport.savedLists, orderCommentsFixture: transport.orderComments });
}

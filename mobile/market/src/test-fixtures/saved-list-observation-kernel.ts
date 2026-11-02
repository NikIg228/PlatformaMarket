import { createReadController, type ReadScope } from "../read-controller";
import { bindMarketReads } from "../market-transport";
import { createBuyerWorkspaceTransport, type BuyerWorkspaceMutationMethod } from "../buyer-workspace-transport";
import { savedListWriteAuthorization } from "./saved-list-item-command";

/** Original controller/models with isolated synthetic authority and explicit saved exchanges. */
export function createSavedListObservationKernel(scope: ReadScope, comparisonRead: (path: string) => Promise<unknown>, workspaceRead: (path: string) => Promise<unknown>, exchange: (method: BuyerWorkspaceMutationMethod, path: string, body?: Readonly<object>) => Promise<unknown>) {
  let active = true;
  const raw = createBuyerWorkspaceTransport(scope, workspaceRead, exchange, () => active);
  const authorization = { ...savedListWriteAuthorization(), scope };
  const client = {
    ...bindMarketReads(comparisonRead, scope.organizationId),
    savedListsFixture: (owner: ReadScope) => raw.savedLists(owner),
    savedListCreateCommandFixture: { authorization, createSavedList: raw.createSavedList },
    savedListItemCommandFixture: { authorization, upsertSavedListItem: raw.upsertSavedListItem },
    savedListRemoveCommandFixture: { authorization, removeSavedListItem: raw.removeSavedListItem },
  };
  const controller = createReadController({ scope, client });
  return { controller, close() { active = false; controller.dispose(); raw.close(); } };
}

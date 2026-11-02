import { createReadController, type ReadScope } from "../read-controller";
import { bindMarketReads } from "../market-transport";
import { createBuyerWorkspaceTransport } from "../buyer-workspace-transport";

/** Test-only source composition. No command provider, actor proof, native key or real HTTP binding. */
export function createWorkspaceCaptureKernel(scope: ReadScope, kind: "saved-lists" | "order-comments", parentRead: (path: string) => Promise<unknown>, workspaceRead: (path: string) => Promise<unknown>) {
  let active = true, writes = 0;
  const raw = createBuyerWorkspaceTransport(scope, workspaceRead, async () => { writes++; throw Error("Unexpected offline workspace command"); }, () => active);
  const client = {
    ...bindMarketReads(parentRead, scope.organizationId),
    savedListsFixture: kind === "saved-lists" ? (owner: ReadScope) => raw.savedLists(owner) : undefined,
    orderCommentsFixture: kind === "order-comments" ? (owner: ReadScope, orderId: string) => raw.orderComments(owner, orderId) : undefined,
  };
  const controller = createReadController({ scope, client });
  return { controller, unexpectedWrites: () => writes, close() { active = false; controller.dispose(); raw.close(); } };
}

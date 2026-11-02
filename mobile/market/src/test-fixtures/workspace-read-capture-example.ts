import { commentScope, commentWorkflow, orderComments } from "./order-comments";
import { savedListFixture, savedListId } from "./saved-lists";
import { createWorkspaceCaptureKernel } from "./workspace-read-capture-kernel";
import type { WorkspaceCaptureKind } from "./workspace-read-capture-replay";

type Record = { method: "GET"; path: string; httpStatus: number; body: unknown };
export type WorkspaceCaptureExample = {
  formatVersion: 1; kind: WorkspaceCaptureKind; scope: typeof commentScope;
  expected?: { orderId: string; orderVersion: number }; parent?: Record; read: Record;
};
/** Synthetic input only; actual native GET candidates/source controller generate exact paths and selections. */
export async function workspaceReadCaptureExample(kind: WorkspaceCaptureKind = "saved-lists", empty = false): Promise<WorkspaceCaptureExample> {
  const scope = Object.freeze({ ...commentScope, environment: "https://market.example.invalid/api" }), workflow = commentWorkflow();
  const body = empty ? [] : kind === "order-comments" ? orderComments() : [savedListFixture(), savedListFixture({ id: savedListId(910), createdById: savedListId(911), items: [], isDefault: false })];
  let parent: Record | undefined, read: Record | undefined;
  const kernel = createWorkspaceCaptureKernel(scope, kind, async path => { parent = { method: "GET", path, httpStatus: 200, body: workflow }; return workflow; }, async path => { read = { method: "GET", path, httpStatus: 200, body }; return body; });
  try {
    if (kind === "order-comments") {
      await kernel.controller.load({ kind: "workflow", orderId: workflow.orderId }); const target = kernel.controller.selectOrderComments(); if (!target) throw Error("Synthetic comment parent unsupported");
      await kernel.controller.load({ kind: "order-comments", target });
    } else await kernel.controller.load({ kind: "saved-lists" });
    const state = kernel.controller.getSnapshot().state;
    if (!read || state.phase !== "ready" && state.phase !== "empty" || kernel.unexpectedWrites()) throw Error("Synthetic workspace fixture rejected");
    return { formatVersion: 1, kind, scope, ...(kind === "order-comments" ? { expected: { orderId: workflow.orderId, orderVersion: workflow.version }, parent } : {}), read };
  } finally { kernel.close(); }
}

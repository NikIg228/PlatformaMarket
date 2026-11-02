import { orderWorkflowCommandSchema, orderWorkflowResponseSchema, orderWorkflowResultSchema } from "../../../packages/schemas/src/order-workflow";
import type { ReadController } from "./read-controller";
import type { BuyerWorkflowInput } from "./order-workflow-command-fixture";
import { buyerWorkflowCaptureCases, buyerWorkflowCaptureExample, type BuyerWorkflowCaptureCase } from "./test-fixtures/buyer-workflow-capture-example";
import { buyerCaptureState, createBuyerWorkflowCaptureKernel, runBuyerCaptureReview } from "./test-fixtures/buyer-workflow-capture-kernel";
import { reorderWorkspace } from "./test-fixtures/order-reorder-command";

function ordinaryModel(controller: ReadController, input: BuyerWorkflowInput) {
  switch (input.action) {
    case "CANCEL": return controller.cancellationCommands;
    case "RECEIVE_SHIPMENT": return controller.receiptCommands;
    case "REQUEST_RETURN": return input.kind === "GOODS" ? controller.goodsReturnCommands : controller.moneyReturnCommands;
    case "SEND_RETURN_GOODS": return controller.returnSendCommands;
    case "RECEIVE_MANUAL_REFUND": return controller.refundReceiveCommands;
    case "ACCEPT_COMPOSITION": return controller.orderCompositionCommands;
    case "OPEN_PAYMENT_DISPUTE": return controller.paymentDisputeCommands;
    case "REORDER": throw new Error("Reorder has separate order/workspace observations");
  }
}
async function setup(caseId: BuyerWorkflowCaptureCase) {
  const example = await buyerWorkflowCaptureExample(caseId);
  let current = orderWorkflowResponseSchema.parse(example.parent.body);
  let workspace = example.workspace?.body;
  current.version = current.order.version = 3;
  const input = { ...orderWorkflowCommandSchema.parse(example.operation.requestBody), expectedVersion: 3 } as BuyerWorkflowInput;
  const send = jest.fn(async (_path: string, _body: Readonly<object>): Promise<unknown> => { throw new Error("SYNTHETIC workflow response lost"); });
  const read = jest.fn(async (path: string): Promise<unknown> => {
    if (path === example.parent.path) return current;
    if (example.workspace && path === example.workspace.path) return workspace;
    throw new Error("Unexpected fixture read path");
  });
  const key = jest.fn(() => input.idempotencyKey);
  const kernel = createBuyerWorkflowCaptureKernel(example.scope, read, send, key), controller = kernel.controller;
  controller.subscribe(() => {});
  await controller.load({ kind: "workflow", orderId: current.orderId });
  const initial = controller.getSnapshot().state;
  if (!("read" in initial) || initial.read.kind !== "workflow") throw new Error("Missing fixture workflow");
  expect(await runBuyerCaptureReview(controller, initial.read.value, input, () => {})).toBe(true);
  const id = current.orderId;
  const state = () => buyerCaptureState(controller, input, id);
  const readPhase = () => input.action === "REORDER" ? controller.orderReorderCommands.stateFor(id).orderRead : state().phase;
  const observe = () => input.action === "REORDER" ? controller.orderReorderCommands.readOrder(id) : ordinaryModel(controller, input).readCurrent(id);
  const acknowledge = () => input.action === "REORDER" ? controller.orderReorderCommands.acknowledgeOrder(id) : ordinaryModel(controller, input).acknowledge(id);
  const replay = () => input.action === "REORDER" ? controller.orderReorderCommands.replay(id) : ordinaryModel(controller, input).replay(id);
  expect(state()).toMatchObject({ phase: "unknown", unresolved: true });
  expect(send).toHaveBeenCalledTimes(1);
  expect(key).toHaveBeenCalledTimes(1);
  return { controller, kernel, example, input, send, read, key, id, state, readPhase, observe, acknowledge, replay, setWorkspace(value: unknown) { workspace = value; }, setVersion(version: number) { current = orderWorkflowResponseSchema.parse(current); current.version = current.order.version = version; } };
}

it.each(buyerWorkflowCaptureCases)("does not acknowledge a retained workflow after an older %s reconciliation response", async caseId => {
  const s = await setup(caseId);
  try {
    const before = s.controller.getSnapshot().state;
    s.setVersion(2);
    await s.observe();
    expect(s.controller.getSnapshot().state).toBe(before);
    expect(s.readPhase()).toBe(caseId === "reorder" ? "error" : "read-error");
    expect(s.acknowledge()).toBe(false);
    expect(s.state().unresolved).toBe(true);
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.key).toHaveBeenCalledTimes(1);
  } finally { s.kernel.close(); }
});

it("does not acknowledge a retained independent REORDER workspace after an older current cart", async () => {
  const s = await setup("reorder"), model = s.controller.orderReorderCommands;
  try {
    s.setWorkspace(reorderWorkspace(true));
    await model.readWorkspace(s.id);
    expect(model.stateFor(s.id).workspaceRead).toBe("review");
    expect(model.acknowledgeWorkspace(s.id)).toBe(true);
    const older = reorderWorkspace(true); older.current!.version = 6;
    s.setWorkspace(older);
    await model.readWorkspace(s.id);
    expect(model.stateFor(s.id).workspaceRead).toBe("error");
    expect(model.acknowledgeWorkspace(s.id)).toBe(false);
    expect(model.stateFor(s.id).unresolved).toBe(true);
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.key).toHaveBeenCalledTimes(1);
  } finally { s.kernel.close(); }
});

it.each([6, 7, 8])("requires an admitted independent workspace to prepare an unsent REORDER at cart version %s", async version => {
  const example = await buyerWorkflowCaptureExample("reorder");
  let workspace = reorderWorkspace(true);
  const send = jest.fn(async (): Promise<unknown> => { throw new Error("Unexpected command"); }), key = jest.fn(() => "00000000-0000-4000-8000-000000099801");
  const kernel = createBuyerWorkflowCaptureKernel(example.scope, async path => {
    if (path === example.parent.path) return example.parent.body;
    if (path === example.workspace!.path) return workspace;
    throw new Error("Unexpected fixture read");
  }, send, key);
  try {
    const controller = kernel.controller;
    await controller.load({ kind: "workflow", orderId: example.expected.orderId });
    const state = controller.getSnapshot().state;
    if (!("read" in state) || state.read.kind !== "workflow") throw new Error("Missing fixture workflow");
    const model = controller.orderReorderCommands, workflow = state.read.value;
    expect(await model.prepare(workflow)).toBe(true);
    expect(model.cancelPreparation(workflow.orderId)).toBe(true);
    workspace = reorderWorkspace(true); workspace.current!.version = version;
    expect(await model.prepare(workflow)).toBe(version >= 7);
    expect(model.stateFor(workflow.orderId).phase).toBe(version >= 7 ? "prepared" : "source-error");
    expect(model.canConfirm(workflow.orderId)).toBe(version >= 7);
    expect(send).not.toHaveBeenCalled();
    expect(key).not.toHaveBeenCalled();
  } finally { kernel.close(); }
});

it.each(buyerWorkflowCaptureCases.flatMap(caseId => [3, 4].map(version => ({ caseId, version }))))("accepts independently read workflow version $version after unknown $caseId without replaying the command", async ({ caseId, version }) => {
  const s = await setup(caseId);
  try {
    const before = s.controller.getSnapshot().state;
    s.setVersion(version);
    await s.observe();
    expect(s.controller.getSnapshot().state).not.toBe(before);
    expect(s.readPhase()).toBe("review");
    expect(s.acknowledge()).toBe(true);
    expect(s.readPhase()).toBe("observed");
    expect(s.state().unresolved).toBe(true);
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.key).toHaveBeenCalledTimes(1);
  } finally { s.kernel.close(); }
});

it.each(buyerWorkflowCaptureCases)("does not acknowledge a failed %s workflow request", async caseId => {
  const s = await setup(caseId);
  try {
    s.read.mockRejectedValueOnce(new Error("SYNTHETIC workflow read unavailable"));
    await s.observe();
    expect(s.readPhase()).toBe(caseId === "reorder" ? "error" : "read-error");
    expect(s.acknowledge()).toBe(false);
    expect(s.state().unresolved).toBe(true);
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.key).toHaveBeenCalledTimes(1);
  } finally { s.kernel.close(); }
});

it.each(buyerWorkflowCaptureCases.flatMap(caseId => ["dispose", "selection"].map(change => ({ caseId, change }))))("discards late $caseId workflow observation after $change changes", async ({ caseId, change }) => {
  const s = await setup(caseId);
  let finish!: (body: unknown) => void;
  try {
    s.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = s.observe();
    expect(s.readPhase()).toBe("reading");
    if (change === "dispose") s.kernel.close();
    else await s.controller.load({ kind: "workflow", orderId: "00000000-0000-4000-8000-000000099899" });
    finish(s.example.parent.body);
    await pending;
    expect(s.readPhase()).not.toBe("review");
    expect(s.acknowledge()).toBe(false);
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.key).toHaveBeenCalledTimes(1);
  } finally { s.kernel.close(); }
});

it.each(buyerWorkflowCaptureCases)("permits another explicit %s observation after a retained older DTO", async caseId => {
  const s = await setup(caseId);
  try {
    s.setVersion(2);
    await s.observe();
    expect(s.readPhase()).toBe(caseId === "reorder" ? "error" : "read-error");
    s.setVersion(3);
    await s.observe();
    expect(s.readPhase()).toBe("review");
    expect(s.acknowledge()).toBe(true);
    expect(s.state().unresolved).toBe(true);
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.key).toHaveBeenCalledTimes(1);
  } finally { s.kernel.close(); }
});

it.each(buyerWorkflowCaptureCases)("preserves explicit original-key %s replay after an older reconciliation DTO was ignored", async caseId => {
  const s = await setup(caseId);
  try {
    const originalBody = JSON.stringify(s.send.mock.calls[0]![1]);
    s.setVersion(2);
    await s.observe();
    expect(s.readPhase()).toBe(caseId === "reorder" ? "error" : "read-error");
    const receipt = orderWorkflowResultSchema.parse(s.example.operation.body); receipt.version = 4;
    s.send.mockResolvedValueOnce(receipt);
    await s.replay();
    expect(s.state()).toMatchObject({ phase: "receipt", unresolved: false });
    expect(s.send).toHaveBeenCalledTimes(2);
    expect(s.send.mock.calls[1]![0]).toBe(s.send.mock.calls[0]![0]);
    expect(JSON.stringify(s.send.mock.calls[1]![1])).toBe(originalBody);
    expect(s.key).toHaveBeenCalledTimes(1);
  } finally { s.kernel.close(); }
});

it.each(["same", "newer", "absent", "different"])("accepts a fresh %s independent REORDER workspace while retaining the unresolved original command", async source => {
  const s = await setup("reorder"), model = s.controller.orderReorderCommands;
  try {
    s.setWorkspace(reorderWorkspace(true));
    await model.readWorkspace(s.id);
    expect(model.acknowledgeWorkspace(s.id)).toBe(true);
    const page = reorderWorkspace(source !== "absent");
    if (page.current && source === "newer") page.current.version = 8;
    if (page.current && source === "different") { page.current.id = "00000000-0000-4000-8000-000000000078"; page.current.version = 1; }
    s.setWorkspace(page);
    await model.readWorkspace(s.id);
    expect(model.stateFor(s.id).workspaceRead).toBe("review");
    expect(model.acknowledgeWorkspace(s.id)).toBe(true);
    expect(model.stateFor(s.id).unresolved).toBe(true);
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.key).toHaveBeenCalledTimes(1);
  } finally { s.kernel.close(); }
});

it.each(["failure", "dispose"])("does not acknowledge independent REORDER workspace after %s", async change => {
  const s = await setup("reorder"), model = s.controller.orderReorderCommands;
  let finish!: (body: unknown) => void;
  try {
    if (change === "failure") {
      s.read.mockRejectedValueOnce(new Error("SYNTHETIC workspace unavailable"));
      await model.readWorkspace(s.id);
      expect(model.stateFor(s.id).workspaceRead).toBe("error");
    } else {
      s.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
      const pending = model.readWorkspace(s.id);
      expect(model.stateFor(s.id).workspaceRead).toBe("reading");
      s.kernel.close();
      finish(reorderWorkspace(true)); await pending;
      expect(model.stateFor(s.id).workspaceRead).not.toBe("review");
    }
    expect(model.acknowledgeWorkspace(s.id)).toBe(false);
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.key).toHaveBeenCalledTimes(1);
  } finally { s.kernel.close(); }
});

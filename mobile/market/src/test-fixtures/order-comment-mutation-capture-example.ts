import type { CreateOrderCommentInput } from "../order-comment-create-command";
import type { EditOrderCommentInput } from "../order-comment-edit-command";
import { commentCreateResult } from "./order-comment-create-command";
import { commentEditRawRow, commentEditResult } from "./order-comment-edit-command";
import { commentScope, commentWorkflow, orderComments } from "./order-comments";
import { createCommentMutationCaptureKernel, type CommentMutationCaptureKind } from "./order-comment-mutation-capture-kernel";

type CaptureRecord = { method: "GET" | "POST" | "PATCH"; path: string; httpStatus: number; body: unknown; requestBody?: unknown };
export type CommentMutationCaptureExample = {
  formatVersion: 1; kind: CommentMutationCaptureKind; scope: typeof commentScope;
  expected: { orderId: string; orderVersion: number; commentId?: string; commentVersion?: number };
  parent: CaptureRecord; comments: CaptureRecord; operation: CaptureRecord;
};
/** Synthetic initial review only. Actual controller issues author provenance and original models prepare commands. */
export async function commentMutationCaptureExample(kind: CommentMutationCaptureKind = "comment-create"): Promise<CommentMutationCaptureExample> {
  const scope = Object.freeze({ ...commentScope, environment: "https://market.example.invalid/api" }), workflow = commentWorkflow(), editRow = commentEditRawRow(), rows = kind === "comment-edit" ? [editRow] : orderComments();
  let parent: CaptureRecord | undefined, comments: CaptureRecord | undefined, operation: CaptureRecord | undefined;
  const kernel = createCommentMutationCaptureKernel(scope, kind, async path => { parent = { method: "GET", path, httpStatus: 200, body: workflow }; return workflow; }, async path => { comments = { method: "GET", path, httpStatus: 200, body: rows }; return rows; }, async (method, path, requestBody) => {
    if (method !== "POST" && method !== "PATCH") throw Error("Unexpected synthetic comment method");
    const body = kind === "comment-create" ? commentCreateResult(workflow.orderId, requestBody as CreateOrderCommentInput) : commentEditResult(editRow, requestBody as EditOrderCommentInput);
    operation = { method, path, httpStatus: 200, requestBody, body }; return body;
  }, () => "SYNTHETIC-reviewed-comment-capture-key");
  try {
    const controller = kernel.controller; await controller.load({ kind: "workflow", orderId: workflow.orderId }); const target = controller.selectOrderComments(); if (!target) throw Error("Synthetic comment parent rejected");
    await controller.load({ kind: "order-comments", target }); const state = controller.getSnapshot().state; if (!("read" in state) || state.read.kind !== "order-comments") throw Error("Synthetic comments rejected"); const window = state.read.value;
    let phase: string;
    if (kind === "comment-create") {
      const model = controller.orderCommentCreateCommands; if (!model.start(window)) throw Error("Synthetic comment form unavailable"); const key = model.stateFor(workflow.orderId).formKey!;
      model.setBody(workflow.orderId, key, "SYNTHETIC жаңа комментарий"); if (!model.prepare(window)) throw Error("Synthetic comment create review rejected"); await model.confirm(workflow.orderId, model.stateFor(workflow.orderId).review!); phase = model.stateFor(workflow.orderId).phase;
    } else {
      const model = controller.orderCommentEditCommands, row = window.comments[0]!; if (!model.begin(window, row)) throw Error("Synthetic comment author proof unavailable"); const token = model.stateFor(row.id).editToken!;
      model.setBody(row.id, token, "SYNTHETIC түзетілген комментарий"); if (!model.prepare(row.id)) throw Error("Synthetic comment edit review rejected"); await model.confirm(row.id, model.stateFor(row.id).review!); phase = model.stateFor(row.id).phase;
    }
    if (!parent || !comments || !operation || phase !== (kind === "comment-create" ? "receipt" : "result") || kernel.capturedKeyReads() !== Number(kind === "comment-create")) throw Error("Synthetic comment operation rejected");
    return { formatVersion: 1, kind, scope, expected: { orderId: workflow.orderId, orderVersion: workflow.version, ...(kind === "comment-edit" ? { commentId: editRow.id, commentVersion: editRow.version } : {}) }, parent, comments, operation };
  } finally { kernel.close(); }
}

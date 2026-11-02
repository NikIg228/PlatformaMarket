import { MarketHttpError } from "../market-transport";
import type { CreateSupportInput, AddSupportInput } from "../support-command-fixture";
import { createSupportCommandCaptureKernel, submitSupportCapture, type SupportCommandCaptureKind } from "./support-command-capture-kernel";
import { commandScope, commandFields, replyCommandText, commandEnvelope, createdTicket, postedSupportMessage } from "./support-commands";
import { supportSummary, supportDetail, supportId } from "./support";

type Record = { method: "GET" | "POST"; path: string; httpStatus: number; body: unknown; requestBody?: unknown };
export const supportRecoveryCases = ["create-http-500", "create-invalid-receipt", "reply-http-500", "reply-invalid-receipt"] as const;
export type SupportRecoveryCase = typeof supportRecoveryCases[number];
export type SupportRecoveryExample = { formatVersion: 1; kind: SupportCommandCaptureKind; scope: typeof commandScope; query?: { kind: "support-tickets"; input: { offset: number; q: string; sort: "recent" } }; expected?: { ticketId: string; ticketVersion: number }; parent: Record; initial: Record; observation: Record; replay: Record };

/** Explicit synthetic recovery only: original-context GET then original model retry with its retained input/key. */
export async function supportCommandRecoveryExample(caseId: SupportRecoveryCase = "reply-http-500"): Promise<SupportRecoveryExample> {
  if (!supportRecoveryCases.includes(caseId)) throw Error("Unknown synthetic support recovery case");
  const kind = caseId.startsWith("create") ? "support-create" : "support-reply", httpFailure = caseId.endsWith("http-500"), scope = Object.freeze({ ...commandScope, environment: "https://market.example.invalid/api" }), ticket = supportDetail();
  const query = { kind: "support-tickets" as const, input: { offset: 0, q: "SYNTHETIC", sort: "recent" as const } };
  let parent: Record | undefined, initial: Record | undefined, observation: Record | undefined, replay: Record | undefined;
  const kernel = createSupportCommandCaptureKernel(scope, async path => {
    if (!parent) { const body = kind === "support-create" ? [supportSummary()] : ticket; parent = { method: "GET", path, httpStatus: 200, body }; return body; }
    if (observation || !initial) throw Error("Unexpected synthetic support recovery read");
    const body = kind === "support-create" ? [createdTicket(initial.requestBody as CreateSupportInput)] : supportDetail({ version: ticket.version + 1, status: "CLOSED" });
    observation = { method: "GET", path, httpStatus: 200, body }; return body;
  }, async (path, requestBody) => {
    if (!initial) {
      const body = httpFailure ? { ...commandEnvelope(500).payload, path } : {}; initial = { method: "POST", path, httpStatus: httpFailure ? 500 : 201, requestBody, body };
      if (httpFailure) throw new MarketHttpError(500, body); return body;
    }
    if (replay || !observation) throw Error("Unexpected synthetic support recovery retry");
    const body = kind === "support-create" ? createdTicket(requestBody as CreateSupportInput) : postedSupportMessage(ticket.id, requestBody as AddSupportInput);
    replay = { method: "POST", path, httpStatus: 201, requestBody, body }; return body;
  }, () => supportId(339));
  try {
    const controller = kernel.controller, readQuery = kind === "support-create" ? query : { kind: "support-ticket" as const, ticketId: ticket.id };
    await controller.load(readQuery); const first = await submitSupportCapture(controller, kind, kind === "support-create" ? commandFields : { body: replyCommandText });
    if (first?.phase !== (httpFailure ? "unknown" : "invalid-result")) throw Error("Synthetic support initial unknown state rejected");
    const target = kind === "support-reply" ? controller.supportReplyDrafts.getSnapshot().entries[ticket.id]?.target : undefined;
    await controller.load(readQuery); const state = controller.getSnapshot().state; if (!("read" in state)) throw Error("Synthetic support independent observation rejected");
    if (kind === "support-create") { if (!controller.supportCreateCommand.canRetry()) throw Error("Synthetic support create retry unavailable"); await controller.supportCreateCommand.retry(); if (controller.supportCreateCommand.getSnapshot().phase !== "success") throw Error("Synthetic support create retry rejected"); }
    else { if (!target || !controller.supportReplyCommands.canRetry(target)) throw Error("Synthetic support reply retry unavailable"); await controller.supportReplyCommands.retry(target); if (controller.supportReplyCommands.stateFor(target).phase !== "success") throw Error("Synthetic support reply retry rejected"); }
    if (!parent || !initial || !observation || !replay || kernel.capturedKeyReads() !== 1) throw Error("Synthetic support recovery incomplete");
    return { formatVersion: 1, kind, scope, ...(kind === "support-create" ? { query } : { expected: { ticketId: ticket.id, ticketVersion: ticket.version } }), parent, initial, observation, replay };
  } finally { kernel.close(); }
}

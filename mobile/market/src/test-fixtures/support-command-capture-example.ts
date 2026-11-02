import { supportSummary, supportDetail, supportId } from "./support";
import { commandScope, commandFields, createdTicket, postedSupportMessage, replyCommandText } from "./support-commands";
import type { CreateSupportInput, AddSupportInput } from "../support-command-fixture";
import { createSupportCommandCaptureKernel, submitSupportCapture, supportCommandCaptureKinds, type SupportCommandCaptureKind } from "./support-command-capture-kernel";

type CaptureRecord = { method: "GET" | "POST"; path: string; httpStatus: number; body: unknown; requestBody?: unknown };
export type SupportCommandCaptureExample = { formatVersion: 1; kind: SupportCommandCaptureKind; scope: typeof commandScope; query?: { kind: "support-tickets"; input: { offset: number; q: string; sort: "recent" } }; expected?: { ticketId: string; ticketVersion: number }; parent: CaptureRecord; operation: CaptureRecord };
/** Synthetic only; original models prepare inputs and actual GET/POST factories supply paths. */
export async function supportCommandCaptureExample(kind: SupportCommandCaptureKind = "support-create"): Promise<SupportCommandCaptureExample> {
  if (!supportCommandCaptureKinds.includes(kind)) throw Error("Unknown synthetic support command kind");
  const scope = Object.freeze({ ...commandScope, environment: "https://market.example.invalid/api" }), ticket = supportDetail(), query = { kind: "support-tickets" as const, input: { offset: 0, q: "SYNTHETIC", sort: "recent" as const } };
  const parentBody = kind === "support-create" ? [supportSummary()] : ticket; let parent: CaptureRecord | undefined, operation: CaptureRecord | undefined;
  const kernel = createSupportCommandCaptureKernel(scope, async path => { parent = { method: "GET", path, httpStatus: 200, body: parentBody }; return parentBody; }, async (path, requestBody) => {
    const body = kind === "support-create" ? createdTicket(requestBody as CreateSupportInput) : postedSupportMessage(ticket.id, requestBody as AddSupportInput);
    operation = { method: "POST", path, httpStatus: 201, requestBody, body }; return body;
  }, () => supportId(339));
  try {
    const controller = kernel.controller; await controller.load(kind === "support-create" ? query : { kind: "support-ticket", ticketId: ticket.id });
    const proof = await submitSupportCapture(controller, kind, kind === "support-create" ? commandFields : { body: replyCommandText });
    if (!parent || !operation || proof?.phase !== "success" || kernel.capturedKeyReads() !== 1) throw Error("Synthetic support source response rejected");
    return { formatVersion: 1, kind, scope, ...(kind === "support-create" ? { query } : { expected: { ticketId: ticket.id, ticketVersion: ticket.version } }), parent, operation };
  } finally { kernel.close(); }
}

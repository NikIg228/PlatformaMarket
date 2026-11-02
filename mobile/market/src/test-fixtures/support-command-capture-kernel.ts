import { createReadController, type ReadScope } from "../read-controller";
import { bindMarketReads } from "../market-transport";
import { createMarketOperationScope } from "../market-operation-scope";
import { createSupportCommandTransport } from "../support-command-transport";
import type { SupportCommandState } from "../support-command-fixture";
import { syntheticSupportAuthorization } from "./support-commands";

export const supportCommandCaptureKinds = ["support-create", "support-reply"] as const;
export type SupportCommandCaptureKind = typeof supportCommandCaptureKinds[number];
/** Original support readers, drafts and commands with explicit synthetic authority and saved synthetic key only. */
export function createSupportCommandCaptureKernel(scope: ReadScope, read: (path: string) => Promise<unknown>, exchange: (path: string, body: Readonly<object>) => Promise<unknown>, savedKey: () => string) {
  let active = true, capturedKeyReads = 0;
  const lifetime = createMarketOperationScope(scope, () => active, () => Error("Offline support capture context unavailable"));
  const raw = createSupportCommandTransport(scope, exchange, () => active);
  const client = {
    ...bindMarketReads(async path => { lifetime.assert(scope); const result = await read(path); lifetime.assert(scope); return result; }, scope.organizationId),
    supportCommandFixture: {
      authorization: { ...syntheticSupportAuthorization(), scope, permissions: ["support.ticket.create", "support.ticket.view"] },
      nextIdempotencyKey: () => { capturedKeyReads++; return savedKey(); }, createSupportTicket: raw.create, addSupportMessage: raw.publicReply,
    },
  };
  const controller = createReadController({ scope, client });
  return { controller, capturedKeyReads: () => capturedKeyReads, close() { active = false; lifetime.close(); controller.dispose(); raw.close(); } };
}
type Controller = ReturnType<typeof createSupportCommandCaptureKernel>["controller"];
export type SupportCaptureProof = Readonly<{ phase: ReturnType<Controller["supportCreateCommand"]["getSnapshot"]>["phase"]; issue?: string }>;
export async function submitSupportCapture(controller: Controller, kind: SupportCommandCaptureKind, input: Readonly<Record<string, unknown>>): Promise<SupportCaptureProof | null> {
  let state: SupportCommandState<unknown>;
  if (kind === "support-create") {
    const draft = controller.supportTicketDraft;
    if (!draft.begin()) return null;
    for (const field of ["subject", "description", "category"] as const) { const text = input[field]; if (typeof text !== "string" || !draft.setText(field, text)) return null; }
    if (typeof input.priority !== "string" || !draft.setPriority(input.priority) || !draft.check().valid) return null;
    await controller.supportCreateCommand.submit(); state = controller.supportCreateCommand.getSnapshot();
  } else {
    const read = controller.getSnapshot().state; if (!("read" in read) || read.read.kind !== "support-ticket" || typeof input.body !== "string") return null;
    const drafts = controller.supportReplyDrafts, target = drafts.begin(read.read.value); if (!target) return null;
    if (!drafts.setText(target, input.body) || !drafts.check(target) || !controller.supportReplyCommands.canSubmit(target)) return null;
    await controller.supportReplyCommands.submit(target); state = controller.supportReplyCommands.stateFor(target);
  }
  return Object.freeze({ phase: state.phase, ...("issue" in state ? { issue: state.issue } : {}) });
}

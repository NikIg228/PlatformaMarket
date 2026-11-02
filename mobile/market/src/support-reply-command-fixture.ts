import { nativeSupportAvailable, type NativeSupportCommands } from "./native-support-commands";
import { addSupportMessageSchema } from "../../../packages/schemas/src/commercial";
import { supportMessageResponseSchema, type SupportTicketDetail } from "../../../packages/schemas/src/support-workflow";
import type { z } from "zod";
import type { ReadScope } from "./read-controller";
import type { SupportReplyDrafts, ReplyDraftTarget } from "./support-reply-draft";
import { authorizedSupportFixture, supportCommandRejection, type AddSupportInput, type SupportCommandFixture, type SupportCommandState } from "./support-command-fixture";
export type SupportReplyResult = z.output<typeof supportMessageResponseSchema>;
type State = SupportCommandState<SupportReplyResult>;
type Attempt = Readonly<{ ticketId: string; target: ReplyDraftTarget; input: AddSupportInput }>;
type Operation = { state: State; attempt: Attempt | null; sequence: number; unresolved: boolean };
const idle: State = Object.freeze({ phase: "idle" });
const binding = supportMessageResponseSchema.pick({ id: true, ticketId: true, authorId: true, isInternal: true });
const open = (status: string) => status === "OPEN" || status === "IN_PROGRESS" || status === "WAITING_CUSTOMER";
const locked = (state: State) => state.phase === "pending" || state.phase === "unknown" || state.phase === "invalid-result" || state.phase === "success";
export type SupportReplyCommandGuard = Readonly<{
  isAvailable?: () => boolean;
  captureContext?: (ticket: SupportTicketDetail) => unknown;
  isContextCurrent?: (proof: unknown) => boolean;
  onAccessIssue?: (issue: "authentication" | "denied", ticketId: string) => void;
}>;
export function createSupportReplyCommands(scope: ReadScope, fixture: SupportCommandFixture | undefined, drafts: SupportReplyDrafts, currentTicket: () => SupportTicketDetail | null, guard: SupportReplyCommandGuard = {}, native?: NativeSupportCommands) {
  const commands = native ?? fixture;
  const owner = Object.freeze({ ...scope }), operations = new Map<string, Operation>(), issued = new Set<string>(), blocked = new Set<string>(), listeners = new Set<() => void>();
  let active = true, disposed = false, snapshot: Readonly<Record<string, State>> = Object.freeze({});
  const available = () => active && (guard.isAvailable?.() ?? true) && (native ? nativeSupportAvailable(native, owner) : authorizedSupportFixture(owner, fixture)) && typeof commands?.addSupportMessage === "function" && typeof commands.nextIdempotencyKey === "function";
  const emit = (id: string, operation: Operation, state: State) => { operation.state = Object.freeze(state); snapshot = Object.freeze({ ...snapshot, [id]: operation.state }); listeners.forEach(fn => fn()); };
  const operationFor = (id: string) => { let operation = operations.get(id); if (!operation) { operation = { state: idle, attempt: null, sequence: 0, unresolved: false }; operations.set(id, operation); } return operation; };
  const currentOwnTicket = (id: string) => { const ticket = currentTicket(); return ticket?.id === id && ticket.organizationId === owner.organizationId ? ticket : null; };
  const canSubmit = (target: ReplyDraftTarget) => {
    if (!available() || blocked.has(target.id) || locked(operations.get(target.id)?.state ?? idle)) return false;
    const ticket = currentOwnTicket(target.id), entry = drafts.entryFor(target);
    return !!ticket && ticket.version === target.version && ticket.status === target.status && open(ticket.status) && entry?.target === target && entry.started && entry.available;
  };
  const denyTicket = (id: string) => { const op = operations.get(id); if (!op || blocked.has(id)) return; blocked.add(id); op.unresolved ||= op.state.phase === "pending"; op.sequence++; op.attempt = null; emit(id, op, op.unresolved ? { phase: "unknown" } : { phase: "rejected", issue: "unavailable" }); };
  const observeDrafts = () => drafts.subscribe(() => {
    const rows = drafts.getSnapshot().entries;
    for (const [id, op] of operations) {
      const target = op.attempt?.target, row = rows[id];
      // Keep an unresolved original operation across a returned newer ticket:
      // message input has no expectedVersion, and same-key replay resolves it.
      // Actual same-version cancellation/context invalidation cannot resurrect it.
      if (target && (!row || (!row.started && row.target.version === target.version && row.target.status === target.status))) denyTicket(id);
    }
  });
  let unsubscribe = observeDrafts();
  const canRetry = (target: ReplyDraftTarget) => {
    const op = operations.get(target.id);
    if (!available() || blocked.has(target.id) || !currentOwnTicket(target.id) || !op?.attempt) return false;
    if (op.state.phase === "unknown" || op.state.phase === "invalid-result") return true;
    if (op.state.phase !== "rejected") return false;
    const row = drafts.entryFor(target); return row?.target === target && row.started && row.body.trim() === op.attempt.input.body;
  };
  const execute = async (id: string, op: Operation) => {
    if (!available() || blocked.has(id) || !op.attempt || op.state.phase === "pending" || op.state.phase === "success" || !currentOwnTicket(id)) return;
    const ticket = currentOwnTicket(id); if (!ticket) return;
    const proof = guard.captureContext?.(ticket);
    if (guard.captureContext && (proof == null || !guard.isContextCurrent?.(proof))) return;
    const contextCurrent = () => !guard.captureContext || !!guard.isContextCurrent?.(proof);
    const unknown = () => { op.unresolved = true; emit(id, op, { phase: "unknown" }); };
    const invalid = () => { op.unresolved = true; emit(id, op, { phase: "invalid-result" }); };
    const attempt = op.attempt, sequence = ++op.sequence; emit(id, op, { phase: "pending" });
    try {
      const body = await commands!.addSupportMessage!(owner, attempt.ticketId, attempt.input);
      if (!active || sequence !== op.sequence) return;
      if (!available()) { denyTicket(id); return; }
      if (!contextCurrent()) { unknown(); return; }
      const ids = binding.safeParse(body);
      if (!ids.success || ids.data.ticketId !== attempt.ticketId || ids.data.authorId !== owner.userId || ids.data.isInternal) { invalid(); return; }
      // No file references were sent in this subset. Do not inspect unexpected
      // attachment descriptors while checking the returned command result.
      const files = (body as { attachments?: unknown }).attachments;
      if (files !== null && (!Array.isArray(files) || files.length !== 0)) { invalid(); return; }
      const parsed = supportMessageResponseSchema.safeParse(body);
      if (!parsed.success || parsed.data.body !== attempt.input.body) { invalid(); return; }
      op.unresolved = false; emit(id, op, { phase: "success", value: Object.freeze(parsed.data) });
    } catch (error) {
      if (!active || sequence !== op.sequence) return;
      if (!available()) { denyTicket(id); return; }
      if (!contextCurrent()) { unknown(); return; }
      const issue = supportCommandRejection(error);
      if (!issue || op.unresolved) unknown(); else emit(id, op, { phase: "rejected", issue });
      if (issue === "authentication" || issue === "denied") guard.onAccessIssue?.(issue, id);
    }
  };
  return {
    runtime: native ? "native-session" as const : "fixture" as const,
    getSnapshot: () => snapshot, subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    stateFor: (target: ReplyDraftTarget): State => snapshot[target.id] ?? idle,
    previewFor: (target: ReplyDraftTarget) => operations.get(target.id)?.attempt?.input.body ?? null,
    isAvailable: available, canSubmit, canRetry, isLocked: (target: ReplyDraftTarget) => locked(snapshot[target.id] ?? idle),
    activate() { if (disposed) { disposed = false; active = true; unsubscribe = observeDrafts(); } },
    async submit(target: ReplyDraftTarget) {
      if (!canSubmit(target) || !drafts.check(target)) return;
      const row = drafts.entryFor(target); if (!row?.started || row.target !== target) return;
      const op = operationFor(target.id);
      if (!op.attempt || row.body.trim() !== op.attempt.input.body) {
        op.attempt = null; op.unresolved = false;
        let key: string; try { key = commands!.nextIdempotencyKey(); } catch { emit(target.id, op, { phase: "rejected", issue: "key" }); return; }
        const parsed = addSupportMessageSchema.safeParse({ idempotencyKey: key, body: row.body, isInternal: false, attachments: [] });
        if (!parsed.success || issued.has(key)) { emit(target.id, op, { phase: "rejected", issue: "key" }); return; }
        issued.add(key); Object.freeze(parsed.data.attachments); op.attempt = Object.freeze({ ticketId: target.id, target, input: Object.freeze(parsed.data) });
      }
      await execute(target.id, op);
    },
    async retry(target: ReplyDraftTarget) { const op = operations.get(target.id); if (op && canRetry(target)) await execute(target.id, op); },
    complete(target: ReplyDraftTarget) { const op = operations.get(target.id); if (!op || op.state.phase !== "success") return; op.attempt = null; op.unresolved = false; emit(target.id, op, idle); drafts.cancel(target); },
    denyTicket,
    denyAll() { active = false; for (const id of operations.keys()) denyTicket(id); },
    dispose() { disposed = true; active = false; unsubscribe(); for (const op of operations.values()) { op.sequence++; op.attempt = null; } operations.clear(); blocked.clear(); listeners.clear(); snapshot = Object.freeze({}); },
  };
}
export type SupportReplyCommands = ReturnType<typeof createSupportReplyCommands>;

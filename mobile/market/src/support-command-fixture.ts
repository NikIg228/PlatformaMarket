import { nativeSupportAvailable, type NativeSupportCommands } from "./native-support-commands";
import { addSupportMessageSchema, createSupportTicketSchema } from "../../../packages/schemas/src/commercial";
import { supportTicketSummarySchema, type SupportTicketSummary } from "../../../packages/schemas/src/support-workflow";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import type { z } from "zod";
import type { ReadScope } from "../../../contracts/mobile-read/read-adapter";
import type { SupportTicketDraft } from "./support-ticket-draft";
export type AddSupportInput = Readonly<z.output<typeof addSupportMessageSchema>>;
export type CreateSupportInput = Readonly<z.output<typeof createSupportTicketSchema>>;
/** Explicit source-contract test authorization, never a production grant or BUYER inference. */
export type SupportCommandFixture = {
  authorization: Readonly<{ provenance: "synthetic-source-contract"; scope: ReadScope; permissions: readonly string[]; operator: false }>;
  nextIdempotencyKey: () => string;
  addSupportMessage?: (scope: ReadScope, ticketId: string, input: AddSupportInput) => Promise<unknown>;
  createSupportTicket?: (scope: ReadScope, input: CreateSupportInput) => Promise<unknown>;
};
export type SupportCommandFixtureClient = { supportCommandFixture?: SupportCommandFixture };
export type CommandIssue = "authentication" | "denied" | "conflict" | "validation" | "unavailable" | "key" | "contract";
export type SupportCommandState<T> = { phase: "idle" } | { phase: "pending" | "unknown" | "invalid-result" } | { phase: "rejected"; issue: CommandIssue } | { phase: "success"; value: T };
function sameScope(a: ReadScope, b: ReadScope) { return a.product === b.product && a.environment === b.environment && a.userId === b.userId && a.organizationId === b.organizationId && a.generation === b.generation; }
export function authorizedSupportFixture(scope: ReadScope, fixture?: SupportCommandFixture) {
  const auth = fixture?.authorization;
  return !!auth && typeof auth.scope === "object" && auth.scope !== null && Array.isArray(auth.permissions) && scope.product === "market" && auth.provenance === "synthetic-source-contract" && auth.operator === false && sameScope(scope, auth.scope) && auth.permissions.includes("support.ticket.create");
}
export function supportCommandRejection(error: unknown): CommandIssue | null {
  if (typeof error !== "object" || error === null || !("status" in error) || !("payload" in error)) return null;
  const parsed = errorResponseSchema.safeParse(error.payload);
  if (!parsed.success || parsed.data.statusCode !== error.status) return null;
  // Known source controller/guard/service rejections. Everything else, including
  // transport/timeout/5xx, remains an unknown result with the original key.
  return error.status === 400 ? "validation" : error.status === 401 ? "authentication" : error.status === 403 ? "denied" : error.status === 404 ? "unavailable" : error.status === 409 ? "conflict" : null;
}
const createFields = createSupportTicketSchema.pick({ subject: true, description: true, category: true, priority: true });
const ticketBinding = supportTicketSummarySchema.pick({ id: true, organizationId: true, requesterId: true });
export function createSupportCreateCommand(scope: ReadScope, fixture: SupportCommandFixture | undefined, draft: SupportTicketDraft, guard: Readonly<{ isAvailable?: () => boolean; onAccessIssue?: (issue: "authentication" | "denied") => void }> = {}, native?: NativeSupportCommands) {
  const commands = native ?? fixture;
  const owner = Object.freeze({ ...scope }), listeners = new Set<() => void>(), issued = new Set<string>();
  let state: SupportCommandState<SupportTicketSummary> = Object.freeze({ phase: "idle" }), active = true, disposed = false, sequence = 0, unresolved = false;
  let attempt: { input: CreateSupportInput; fingerprint: string } | null = null;
  const emit = (next: SupportCommandState<SupportTicketSummary>) => { state = Object.freeze(next); listeners.forEach(fn => fn()); };
  const allowed = () => active && (guard.isAvailable?.() ?? true) && (native ? nativeSupportAvailable(native, owner) : authorizedSupportFixture(owner, fixture)) && typeof commands?.createSupportTicket === "function" && typeof commands.nextIdempotencyKey === "function";
  const locked = () => state.phase === "pending" || state.phase === "unknown" || state.phase === "invalid-result" || state.phase === "success";
  const unknown = () => { unresolved = true; emit({ phase: "unknown" }); };
  const invalid = () => { unresolved = true; emit({ phase: "invalid-result" }); };
  const denyAccess = () => { unresolved ||= state.phase === "pending"; sequence++; active = false; attempt = null; emit(unresolved ? { phase: "unknown" } : { phase: "rejected", issue: "unavailable" }); };
  const execute = async () => {
    if (!allowed() || !attempt || state.phase === "pending" || state.phase === "success") return;
    const current = attempt, ticket = ++sequence; emit({ phase: "pending" });
    try {
      const body = await commands!.createSupportTicket!(owner, current.input);
      if (!active || ticket !== sequence) return;
      if (!allowed()) { denyAccess(); return; }
      const binding = ticketBinding.safeParse(body);
      if (!binding.success || binding.data.organizationId !== owner.organizationId || binding.data.requesterId !== owner.userId) { invalid(); return; }
      const parsed = supportTicketSummarySchema.safeParse(body);
      if (!parsed.success || parsed.data.subject !== current.input.subject || parsed.data.description !== current.input.description || parsed.data.category !== current.input.category || parsed.data.priority !== current.input.priority) { invalid(); return; }
      unresolved = false; emit({ phase: "success", value: Object.freeze(parsed.data) });
    } catch (error) {
      if (!active || ticket !== sequence) return;
      if (!allowed()) { denyAccess(); return; }
      const issue = supportCommandRejection(error);
      if (!issue || unresolved) unknown(); else emit({ phase: "rejected", issue });
      if (issue === "authentication" || issue === "denied") guard.onAccessIssue?.(issue);
    }
  };
  const observeDraft = () => draft.subscribe(() => {
    const row = draft.getSnapshot();
    if ((!row.available || !row.started) && attempt) { denyAccess(); }
  });
  let unsubscribe = observeDraft();
  const canRetry = () => !!attempt && (state.phase === "unknown" || state.phase === "invalid-result" || (state.phase === "rejected" && (() => { const parsed = createFields.safeParse(draft.getSnapshot().values); return parsed.success && JSON.stringify(parsed.data) === attempt?.fingerprint; })()));
  return {
    runtime: native ? "native-session" as const : "fixture" as const,
    getSnapshot: () => state, subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    isAvailable: allowed, isLocked: locked, canRetry, denyAccess,
    activate() { if (disposed) { disposed = false; active = true; unsubscribe = observeDraft(); } },
    async submit() {
      if (!allowed() || locked()) return;
      const row = draft.getSnapshot(); if (!row.available || !row.started || !draft.check().valid) return;
      const fingerprint = JSON.stringify(createFields.parse(row.values));
      if (!attempt || attempt.fingerprint !== fingerprint) {
        attempt = null; unresolved = false;
        let key: string; try { key = commands!.nextIdempotencyKey(); } catch { emit({ phase: "rejected", issue: "key" }); return; }
        const parsed = createSupportTicketSchema.safeParse({ ...row.values, idempotencyKey: key, links: [] });
        if (!parsed.success || issued.has(key)) { emit({ phase: "rejected", issue: "key" }); return; }
        issued.add(key); Object.freeze(parsed.data.links); attempt = Object.freeze({ fingerprint, input: Object.freeze(parsed.data) });
      }
      await execute();
    },
    retry: async () => { if (canRetry()) await execute(); },
    startNew() { if (!active || state.phase !== "success") return; attempt = null; unresolved = false; emit({ phase: "idle" }); draft.cancel(); draft.begin(); },
    dispose() { disposed = true; active = false; sequence++; attempt = null; unsubscribe(); listeners.clear(); state = Object.freeze({ phase: "idle" }); },
  };
}
export type SupportCreateCommand = ReturnType<typeof createSupportCreateCommand>;

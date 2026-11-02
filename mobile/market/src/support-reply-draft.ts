import { addSupportMessageSchema } from "../../../packages/schemas/src/commercial";
import { z } from "zod";
import type { SupportTicketDetail, SupportTicketSummary } from "../../../packages/schemas/src/support-workflow";
import type { ReadScope } from "../../../contracts/mobile-read/read-adapter";

// Consume the real body/attachment fields AND the actual object-level checks.
// A pick/omit would lose or reject the body-or-attachments refinement in Zod 4.
// Only { body } enters this private validator, so the real attachments default is
// empty. There is no command key or complete message payload; output is ignored.
const localTextCheck = new z.ZodObject({ ...addSupportMessageSchema.def, shape: { body: addSupportMessageSchema.shape.body, attachments: addSupportMessageSchema.shape.attachments } });
export type ReplyDraftIssue = { kind: "required" | "format" } | { kind: "maximum"; count: string };
export function checkSupportReplyText(body: string): ReplyDraftIssue | null {
  const parsed = localTextCheck.safeParse({ body });
  if (parsed.success) return null;
  const issue = parsed.error.issues.find(item => item.path[0] === "body");
  return Object.freeze(issue?.code === "too_big" ? { kind: "maximum", count: String(issue.maximum) }
    : issue?.code === "custom" ? { kind: "required" } : { kind: "format" });
}
type TicketSource = Pick<SupportTicketDetail, "id" | "organizationId" | "version" | "status">;
export type ReplyDraftTarget = Readonly<TicketSource>;
export type ReplyDraftEntry = Readonly<{ target: ReplyDraftTarget; available: boolean; started: boolean; body: string; dirty: boolean; checked: boolean; issue: ReplyDraftIssue | null; discarded: boolean }>;
export type ReplyDraftSnapshot = Readonly<{ entries: Readonly<Record<string, ReplyDraftEntry>> }>;
const openForLocalText = (ticket: TicketSource) => ticket.status === "OPEN" || ticket.status === "IN_PROGRESS" || ticket.status === "WAITING_CUSTOMER";
const matches = (a: TicketSource, b: TicketSource) => a.id === b.id && a.organizationId === b.organizationId && a.version === b.version && a.status === b.status;
export function createSupportReplyDrafts(scope: ReadScope) {
  const owner = Object.freeze({ ...scope });
  let active = true, snapshot: ReplyDraftSnapshot = Object.freeze({ entries: Object.freeze({}) });
  const listeners = new Set<() => void>();
  const emit = (entries: Readonly<Record<string, ReplyDraftEntry>>) => { snapshot = Object.freeze({ entries: Object.freeze(entries) }); listeners.forEach(listener => listener()); };
  const put = (entry: ReplyDraftEntry) => emit({ ...snapshot.entries, [entry.target.id]: Object.freeze(entry) });
  const reset = (ticket: TicketSource, available: boolean, discarded: boolean): ReplyDraftEntry => ({ target: Object.freeze({ id: ticket.id, organizationId: ticket.organizationId, version: ticket.version, status: ticket.status }), available, discarded, started: false, body: "", dirty: false, checked: false, issue: null });
  const entryFor = (ticket: TicketSource) => {
    const entry = snapshot.entries[ticket.id];
    return active && ticket.organizationId === owner.organizationId && entry && matches(entry.target, ticket) ? entry : null;
  };
  const current = (target: ReplyDraftTarget) => {
    const entry = entryFor(target);
    return entry?.available && entry.target === target ? entry : null;
  };
  const invalidate = (ticketId: string) => {
    const entry = snapshot.entries[ticketId];
    if (entry && (entry.available || entry.started)) put(reset(entry.target, false, entry.started || entry.discarded));
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    entryFor,
    activate() { active = true; },
    clear() { if (Object.keys(snapshot.entries).length) emit({}); },
    close() { active = false; if (Object.keys(snapshot.entries).length) emit({}); },
    invalidate,
    syncTicket(ticket: SupportTicketDetail) {
      if (!active) return;
      if (ticket.organizationId !== owner.organizationId) { invalidate(ticket.id); return; }
      const previous = snapshot.entries[ticket.id];
      // Message pages can contain an older ticket version. Never rebase a newer
      // draft onto it or make that stale page editable.
      if (previous && ticket.version < previous.target.version) return;
      const available = openForLocalText(ticket);
      if (previous && matches(previous.target, ticket) && previous.available === available) return;
      put(reset(ticket, available, previous?.started === true || previous?.discarded === true));
    },
    syncSummaries(tickets: readonly SupportTicketSummary[]) {
      if (!active) return;
      // A paginated list may invalidate a known detail; it cannot grant a draft.
      for (const ticket of tickets) {
        const previous = snapshot.entries[ticket.id];
        if (previous && ticket.organizationId === owner.organizationId && ticket.version >= previous.target.version && !matches(previous.target, ticket)) put(reset(ticket, false, previous.started || previous.discarded));
      }
    },
    begin(ticket: SupportTicketDetail): ReplyDraftTarget | null {
      const entry = entryFor(ticket);
      if (!entry?.available) return null;
      if (!entry.started) put({ ...entry, started: true, discarded: false });
      return entry.target;
    },
    setText(target: ReplyDraftTarget, body: string): boolean {
      const entry = current(target);
      if (!entry?.started || typeof body !== "string") return false;
      put({ ...entry, body, dirty: body !== "", checked: false, issue: null }); return true;
    },
    check(target: ReplyDraftTarget): boolean {
      const entry = current(target);
      if (!entry?.started) return false;
      const issue = checkSupportReplyText(entry.body); put({ ...entry, checked: true, issue }); return issue === null;
    },
    cancel(target: ReplyDraftTarget) {
      const entry = current(target); if (entry) put(reset(target, entry.available, false));
    },
  };
}
export type SupportReplyDrafts = ReturnType<typeof createSupportReplyDrafts>;

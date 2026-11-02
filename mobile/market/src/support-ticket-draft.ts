import { createSupportTicketSchema } from "../../../packages/schemas/src/commercial";
import type { z } from "zod";
import type { ReadScope } from "../../../contracts/mobile-read/read-adapter";

// Shared field validators only; the full create contract is intentionally never parsed here.
const localFields = createSupportTicketSchema.pick({ subject: true, description: true, category: true, priority: true });
export const supportDraftPriorities = Object.freeze([...createSupportTicketSchema.shape.priority.unwrap().options]);
export type LocalSupportText = Readonly<z.output<typeof localFields>>;
export const supportTextFields = Object.freeze(["subject", "description", "category"] as const);
export type SupportTextField = typeof supportTextFields[number];
export type SupportDraftField = SupportTextField | "priority";
export type SupportDraftIssue = { kind: "minimum" | "maximum"; count: string } | { kind: "choice" | "format" };
export type SupportDraftErrors = Readonly<Partial<Record<SupportDraftField, SupportDraftIssue>>>;
export type SupportDraftSnapshot = Readonly<{ available: boolean; started: boolean; values: LocalSupportText; dirty: boolean; checked: boolean; errors: SupportDraftErrors; discarded: boolean }>;
const fields: readonly SupportDraftField[] = [...supportTextFields, "priority"];
const isField = (value: unknown): value is SupportDraftField => fields.some(field => field === value);
export function checkLocalSupportFields(values: LocalSupportText): SupportDraftErrors {
  const parsed = localFields.safeParse(values);
  if (parsed.success) return Object.freeze({});
  const errors: Partial<Record<SupportDraftField, SupportDraftIssue>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0]; if (!isField(field) || errors[field]) continue;
    errors[field] = Object.freeze(issue.code === "too_small" ? { kind: "minimum", count: String(issue.minimum) }
      : issue.code === "too_big" ? { kind: "maximum", count: String(issue.maximum) }
      : field === "priority" ? { kind: "choice" } : { kind: "format" });
  }
  return Object.freeze(errors);
}
export function createSupportTicketDraft(scope: ReadScope) {
  const owner = Object.freeze({ ...scope });
  const initial: LocalSupportText = Object.freeze({ subject: "", description: "", category: "", priority: createSupportTicketSchema.shape.priority.parse(undefined) });
  let active = true;
  const listeners = new Set<() => void>();
  let snapshot: SupportDraftSnapshot = Object.freeze({ available: false, started: false, values: initial, dirty: false, checked: false, errors: Object.freeze({}), discarded: false });
  const emit = (next: SupportDraftSnapshot) => { snapshot = Object.freeze(next); listeners.forEach(listener => listener()); };
  const empty = (available: boolean, discarded: boolean): SupportDraftSnapshot => ({ available, discarded, started: false, values: initial, dirty: false, checked: false, errors: Object.freeze({}) });
  const sameOwner = (current: ReadScope) => owner.product === current.product && owner.environment === current.environment && owner.userId === current.userId && owner.organizationId === current.organizationId && owner.generation === current.generation;
  const change = (field: SupportDraftField, next: LocalSupportText) => {
    const values = Object.freeze(next);
    const errors = { ...snapshot.errors }; delete errors[field];
    emit({ ...snapshot, values, dirty: fields.some(key => values[key] !== initial[key]), checked: false, errors: Object.freeze(errors), discarded: false });
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate() { active = true; },
    close() { active = false; emit(empty(false, false)); },
    setReadAccess(current: ReadScope, allowed: boolean) {
      if (!active) return;
      if (!sameOwner(current) || !allowed) { if (snapshot.available || snapshot.started) emit(empty(false, snapshot.started)); return; }
      if (!snapshot.available) emit({ ...snapshot, available: true });
    },
    begin(): boolean {
      if (!active || !snapshot.available) return false;
      if (!snapshot.started) emit({ ...snapshot, started: true, discarded: false });
      return true;
    },
    setText(field: SupportTextField, text: string): boolean {
      if (!active || !snapshot.available || !snapshot.started || !supportTextFields.some(key => key === field) || typeof text !== "string") return false;
      change(field, { ...snapshot.values, [field]: text }); return true;
    },
    setPriority(value: string): boolean {
      if (!active || !snapshot.available || !snapshot.started) return false;
      const parsed = createSupportTicketSchema.shape.priority.safeParse(value);
      if (!parsed.success) return false;
      change("priority", { ...snapshot.values, priority: parsed.data }); return true;
    },
    check(): { valid: boolean; firstError: SupportDraftField | null } {
      if (!active || !snapshot.available || !snapshot.started) return { valid: false, firstError: null };
      const errors = checkLocalSupportFields(snapshot.values), firstError = fields.find(field => errors[field]) ?? null;
      emit({ ...snapshot, checked: true, errors }); return { valid: firstError === null, firstError };
    },
    cancel() { if (active) emit(empty(snapshot.available, false)); },
  };
}
export type SupportTicketDraft = ReturnType<typeof createSupportTicketDraft>;

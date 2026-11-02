import { z } from "zod";
import { conversationMessageInputSchema } from "../../../packages/schemas/src/conversations";
import type { ReadScope } from "./read-controller";
import type { OrderConversationWindow } from "./order-conversation-read";
// Retain the actual body-or-attachments refinement without generating a command key.
const textInput = new z.ZodObject({ ...conversationMessageInputSchema.def, shape: { body: conversationMessageInputSchema.shape.body, attachments: conversationMessageInputSchema.shape.attachments } });
export type ConversationTextIssue = "required" | "too-long" | "format";
export function checkConversationText(rawBody: string): ConversationTextIssue | null {
  const parsed = textInput.safeParse({ body: rawBody });
  return parsed.success ? null : parsed.error.issues.some(issue => issue.code === "too_big") ? "too-long" : parsed.error.issues.some(issue => issue.code === "custom") ? "required" : "format";
}
export type ConversationDraftTarget = Readonly<{ conversationId: string; orderId: string; version: number }>;
export type ConversationDraftEntry = Readonly<{ target: ConversationDraftTarget; formKey: object; started: boolean; phase: "editing" | "paused"; rawBody: string; checked: boolean; issue: ConversationTextIssue | null }>;
export type ConversationDraftSnapshot = Readonly<Record<string, ConversationDraftEntry>>;
export function createOrderConversationDrafts(scope: ReadScope, currentWindow: () => OrderConversationWindow | null, locked: (conversationId:string)=>boolean = ()=>false) {
  const owner = Object.freeze({ ...scope }), listeners = new Set<() => void>();
  let active = true, snapshot: ConversationDraftSnapshot = Object.freeze({}), frame: OrderConversationWindow | null = null;
  const emit = (next: ConversationDraftSnapshot) => { snapshot = Object.freeze(next); listeners.forEach(listener => listener()); };
  const put = (entry: ConversationDraftEntry) => emit({ ...snapshot, [entry.target.conversationId]: Object.freeze(entry) });
  const owned = (window: OrderConversationWindow) => active && currentWindow() === window && window.conversation !== null && window.context.buyerOrganizationId === owner.organizationId && window.conversation.buyerOrganizationId === owner.organizationId && window.conversation.contextType === "ORDER" && window.conversation.contextId === window.context.orderId && window.conversation.supplierOrganizationId === window.context.supplierOrganizationId;
  const entryFor = (window: OrderConversationWindow) => {
    if (!owned(window) || frame !== window) return null;
    const row = snapshot[window.conversation!.id];
    return row && row.target.orderId === window.context.orderId && row.target.version === window.conversation!.version ? row : null;
  };
  const editing = (target: ConversationDraftTarget) => {
    const window = currentWindow(), row = window ? entryFor(window) : null;
    return row?.started && !locked(target.conversationId) && row.phase === "editing" && row.target === target ? row : null;
  };
  const paused = (row: ConversationDraftEntry): ConversationDraftEntry => Object.freeze({ ...row, phase: "paused" });
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    entryFor,
    syncWindow(window: OrderConversationWindow) {
      if (!owned(window)) return;
      if (frame === window) return;
      frame = window;
      const thread = window.conversation!, previous = snapshot[thread.id];
      const target = Object.freeze({ conversationId: thread.id, orderId: window.context.orderId, version: thread.version });
      // A fresh read rotates callbacks while retaining unsent text and cursor ownership.
      put(previous && previous.target.orderId === target.orderId ? { ...paused(previous), target } : { target, formKey: Object.freeze({}), started: false, phase: "paused", rawBody: "", checked: false, issue: null });
    },
    begin(window: OrderConversationWindow): ConversationDraftTarget | null {
      const row = entryFor(window); if (!row || locked(row.target.conversationId)) return null;
      const target=Object.freeze({...row.target}); put({ ...row, target, started: true, phase: "editing" }); return target;
    },
    setText(target: ConversationDraftTarget, rawBody: string) {
      const row = editing(target); if (!row || typeof rawBody !== "string") return false;
      put({ ...row, rawBody, checked: false, issue: null }); return true;
    },
    check(target: ConversationDraftTarget) {
      const row = editing(target); if (!row) return false;
      const issue = checkConversationText(row.rawBody); put({ ...row, checked: true, issue }); return issue === null;
    },
    pause(target: ConversationDraftTarget) {
      const row = editing(target); if (!row) return false; put(paused(row)); return true;
    },
    discard(target: ConversationDraftTarget) {
      const row = editing(target); if (!row) return false;
      put({ ...row, target:Object.freeze({...row.target}), formKey: Object.freeze({}), started: false, phase: "paused", rawBody: "", checked: false, issue: null }); return true;
    },
    deactivate() { frame = null; const next = Object.fromEntries(Object.entries(snapshot).map(([id, row]) => [id, paused(row)])); if (Object.values(snapshot).some(row => row.phase === "editing")) emit(next); },
    invalidateOrder(orderId: string) { frame = null; const next = Object.fromEntries(Object.entries(snapshot).filter(([,row]) => row.target.orderId !== orderId)); if (Object.keys(next).length !== Object.keys(snapshot).length) emit(next); },
    clear() { frame = null; if (Object.keys(snapshot).length) emit({}); },
    activate() { active = true; },
    close() { active = false; frame = null; emit({}); listeners.clear(); },
  };
}
export type OrderConversationDrafts = ReturnType<typeof createOrderConversationDrafts>;

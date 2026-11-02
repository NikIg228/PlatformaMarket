import { supportAttachmentSchema, type SupportAttachment } from "../../../packages/schemas/src/support-files";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import type { SupportTicketDetail } from "../../../packages/schemas/src/support-workflow";
import type { OrderConversationWindow } from "./order-conversation-read";
import type { OfferConversationWindow } from "./offer-conversation-read";
import { AttachmentBinaryError } from "./market-transport";
import type { NativeAttachmentImages, AttachmentImageRequest } from "./native-attachment-images";
import type { ReadScope } from "./read-controller";
export type AttachmentParent = Readonly<{ kind: "support"; value: SupportTicketDetail } | { kind: "order"; value: OrderConversationWindow } | { kind: "offer"; value: OfferConversationWindow }>;
export type AttachmentImageIssue = "authentication" | "denied" | "missing" | "contract" | "size" | "network" | "decode";
type Selection = Readonly<{ parent: AttachmentParent; messageId: string; file: Readonly<SupportAttachment>; request: AttachmentImageRequest }>;
export type AttachmentImageState = Readonly<{ phase: "idle" | "loading" | "ready" | "error"; selected?: Selection; uri?: string; issue?: AttachmentImageIssue }>;
const idle: AttachmentImageState = Object.freeze({ phase: "idle" });
function classify(error: unknown): AttachmentImageIssue { if (error instanceof AttachmentBinaryError) return error.code; try { if (typeof error === "object" && error && "status" in error && "payload" in error) { const parsed = errorResponseSchema.safeParse(error.payload); if (parsed.success && parsed.data.statusCode === error.status) return error.status === 401 ? "authentication" : error.status === 403 ? "denied" : error.status === 404 ? "missing" : "network"; } } catch { /* Untrusted error has no permission receipt. */ } return "network"; }
/** Only bytes from the scoped native stream become data: images; there is no remote URL or persistent file cache. */
function imageUri(bytes: Uint8Array, mime: "image/png" | "image/jpeg") { const parts: string[] = []; for (let offset = 0; offset < bytes.byteLength; offset += 12_288) parts.push(globalThis.btoa(String.fromCharCode(...bytes.subarray(offset, offset + 12_288)))); return `data:${mime};base64,${parts.join("")}`; }
export function createAttachmentImages(scope: ReadScope, port: NativeAttachmentImages | undefined, currentParent: () => AttachmentParent | null) {
  const owner = Object.freeze({ ...scope }), listeners = new Set<() => void>(); let active = true, state = idle, pending: AbortController | null = null;
  const publish = (value: AttachmentImageState) => { state = Object.freeze(value); listeners.forEach(fn => fn()); };
  const sameParent = (a: AttachmentParent, b: AttachmentParent | null) => b?.kind === a.kind && b.value === a.value;
  const select = (parent: AttachmentParent, messageId: string, file: Readonly<SupportAttachment>): Selection | null => {
    try {
      if (!active || !port?.available(owner) || !sameParent(parent, currentParent())) return null;
      let parentId: string, messageFiles: readonly Readonly<SupportAttachment>[] | null | undefined;
      if (parent.kind === "support") { if (parent.value.organizationId !== owner.organizationId) return null; parentId = parent.value.id; const message = parent.value.messages.find(row => row.id === messageId); if (!message || message.ticketId !== parentId || message.isInternal) return null; messageFiles = message.attachments; }
      else { const window = parent.value, thread = window.conversation; if (!thread || window.context.buyerOrganizationId !== owner.organizationId || window.context.supplierOrganizationId === owner.organizationId || thread.buyerOrganizationId !== window.context.buyerOrganizationId || thread.supplierOrganizationId !== window.context.supplierOrganizationId || thread.contextType !== (parent.kind === "order" ? "ORDER" : "OFFER") || thread.contextId !== (parent.kind === "order" ? (window as OrderConversationWindow).context.orderId : (window as OfferConversationWindow).context.offerId)) return null; parentId = thread.id; const message = window.messages.find(row => row.id === messageId); if (!message || message.conversationId !== parentId) return null; messageFiles = message.attachments; }
      if (!messageFiles?.includes(file) || messageFiles.filter(row => row.assetId === file.assetId).length !== 1) return null;
      const parsed = supportAttachmentSchema.safeParse(file); if (!parsed.success || parsed.data.contentType !== "image/png" && parsed.data.contentType !== "image/jpeg") return null;
      return Object.freeze({ parent, messageId, file, request: Object.freeze({ kind: parent.kind === "support" ? "support" : "conversation", parentId, messageId, assetId: parsed.data.assetId, contentType: parsed.data.contentType, sizeBytes: parsed.data.sizeBytes }) });
    } catch { return null; }
  };
  const valid = (selected: Selection) => { const current = select(selected.parent, selected.messageId, selected.file); return current !== null && JSON.stringify(current.request) === JSON.stringify(selected.request); };
  const clear = () => { pending?.abort(); pending = null; if (state !== idle) publish(idle); };
  return {
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    available(parent: AttachmentParent, messageId: string, file: Readonly<SupportAttachment>) { return select(parent, messageId, file) !== null; },
    viewFor(parent: AttachmentParent, messageId: string, file: Readonly<SupportAttachment>): AttachmentImageState { return state.selected && sameParent(state.selected.parent, parent) && state.selected.messageId === messageId && state.selected.file === file && valid(state.selected) ? state : idle; },
    async open(parent: AttachmentParent, messageId: string, file: Readonly<SupportAttachment>) {
      const selected = select(parent, messageId, file); if (!selected) return;
      if (state.phase === "loading" && state.selected && sameParent(state.selected.parent, parent) && state.selected.messageId === messageId && state.selected.file === file) return;
      clear(); const controller = new AbortController(); pending = controller; publish({ phase: "loading", selected });
      try { const bytes = await port!.read(owner, selected.request, controller.signal); if (!active || pending !== controller || controller.signal.aborted || !valid(selected)) return;
        if (!(bytes instanceof Uint8Array) || bytes.byteLength !== selected.request.sizeBytes) throw new AttachmentBinaryError("size");
        const uri = imageUri(bytes, selected.request.contentType); if (!active || pending !== controller || !valid(selected)) return; pending = null; publish({ phase: "ready", selected, uri });
      } catch (error) { if (active && pending === controller && !controller.signal.aborted && valid(selected)) { pending = null; publish({ phase: "error", selected, issue: classify(error) }); } }
      finally { if (pending === controller) { pending = null; if (active) publish(idle); } }
    },
    hide(parent: AttachmentParent, messageId: string, file: Readonly<SupportAttachment>) { if (!state.selected || !sameParent(state.selected.parent, parent) || state.selected.messageId !== messageId || state.selected.file !== file) return false; clear(); return true; },
    renderFailed(parent: AttachmentParent, messageId: string, file: Readonly<SupportAttachment>, expected: AttachmentImageState) { const selected = state.selected; if (state !== expected || !selected || state.phase !== "ready" || !sameParent(selected.parent, parent) || selected.messageId !== messageId || selected.file !== file || !valid(selected)) return; publish({ phase: "error", selected, issue: "decode" }); },
    syncCurrent() { if (state.selected && !valid(state.selected)) clear(); },
    activate() { active = true; },
    close() { active = false; clear(); listeners.clear(); },
  };
}
export type AttachmentImages = ReturnType<typeof createAttachmentImages>;

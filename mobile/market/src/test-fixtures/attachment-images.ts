import { api } from "./market-session";
import type { FetchTransport } from "../market-transport";
import { supportAttachmentSchema } from "../../../../packages/schemas/src/support-files";
import { supportDetail } from "./support";
import { conversationScope, conversationWorkflow, orderConversationPage } from "./order-conversation";
import { createOrderConversationRead } from "../order-conversation-read";
import { createOfferConversationRead } from "../offer-conversation-read";
import { offerConversationPage, offerConversationLookup, offerComparison, offerConversationScope } from "./offer-conversation";
import { listDraftId as id } from "./list-draft";
// Synthetic1x1 PNG; no user file content. Binary adapter only, never real fetch.
export const imageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9qkAAAAASUVORK5CYII=", imageBytes = () => Uint8Array.from(globalThis.atob(imageBase64), value => value.charCodeAt(0));
export const imageScope = { ...conversationScope, environment: api }, imageId = id;
export function imageFile(n = 0) { return { ...supportAttachmentSchema.parse({ assetId: id(130001 + n), name: `SYNTHETIC-image-${n}.png`, contentType: "image/png", sizeBytes: imageBytes().byteLength }), contentType: "image/png" as const }; }
export function imageTicket() { const ticket = supportDetail(); ticket.organizationId = imageScope.organizationId; ticket.requesterId = imageScope.userId; ticket.messages = ticket.messages.filter(row => !row.isInternal); ticket.messages[0]!.attachments = [imageFile(), imageFile(1), { ...imageFile(2), name: "SYNTHETIC-file.pdf", contentType: "application/pdf" }]; return ticket; }
export function binaryImage(options: { bytes?: Uint8Array; contentType?: string; headers?: Record<string, string | null>; chunkSize?: number } = {}): Awaited<ReturnType<FetchTransport>> & { cancel: jest.Mock } {
  const bytes = options.bytes ?? imageBytes(), values: Record<string, string | null> = { "content-type": options.contentType ?? "image/png", "content-disposition": "attachment; filename*=UTF-8''SYNTHETIC-image.png", "cache-control": "private, no-store", "x-content-type-options": "nosniff", ...options.headers }, cancel = jest.fn(async () => undefined); let cursor = 0;
  return { status: 200, ok: true, text: async () => { throw Error("Binary success must not use text/JSON"); }, headers: { get: key => values[key.toLowerCase()] ?? null }, body: { getReader: () => ({ read: async () => { if (cursor >= bytes.length) return { done: true, value: undefined }; const value = bytes.slice(cursor, cursor + (options.chunkSize ?? 11)); cursor += value.length; return { done: false, value }; }, cancel, releaseLock: () => undefined }) }, cancel };
}
export function imageOrderDetail() { const value = orderConversationPage(); value.messages[0]!.attachments = [imageFile(), { ...imageFile(2), name: "SYNTHETIC-file.pdf", contentType: "application/pdf" }]; return value; }
export function imageOfferDetail() { const value = offerConversationPage(); value.messages[0]!.attachments = [imageFile()]; return value; }
export async function imageOrderWindow() { const workflow = conversationWorkflow(), detail = imageOrderDetail(), model = createOrderConversationRead(imageScope, { orderConversationLookupFixture: async () => ({ conversationId: detail.conversation.id }), orderConversationDetailFixture: async () => detail }); const target = model.select(workflow)!; await model.load(target); const state = model.getState(); if (!("read" in state)) throw Error(`Synthetic ORDER window ${state.phase}`); return state.read.value; }
export async function imageOfferWindow() { const detail = imageOfferDetail(), comparison = offerComparison(), model = createOfferConversationRead(offerConversationScope, undefined, { available: () => true, lookup: async () => offerConversationLookup(), get: async () => detail, list: async () => ({}) }); const offer = comparison.offers[0]!, target = model.select(comparison, offer.offerId, comparison.product.id, offer.variantId)!; await model.load(target); const state = model.getState(); if (!("read" in state)) throw Error(`Synthetic OFFER window ${state.phase}`); return state.read.value; }

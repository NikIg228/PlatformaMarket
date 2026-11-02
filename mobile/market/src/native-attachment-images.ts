import { DOCUMENT_UPLOAD_MAX_BYTES } from "../../../packages/schemas/src/document-upload-limits";
import { z } from "zod";
import { createMarketOperationScope } from "./market-operation-scope";
import type { ReadScope } from "./read-controller";
import type { AttachmentBinaryExpectation } from "./market-transport";
export type AttachmentImageRequest = Readonly<{ kind: "support" | "conversation"; parentId: string; messageId: string; assetId: string } & AttachmentBinaryExpectation>;
export type NativeAttachmentImages = Readonly<{ available(scope: ReadScope): boolean; read(scope: ReadScope, input: AttachmentImageRequest, signal: AbortSignal): Promise<Uint8Array> }>;
export type NativeAttachmentImageClient = { nativeAttachmentImages?: NativeAttachmentImages };
export class NativeAttachmentImageError extends Error { constructor(readonly code: "scope" | "input") { super("Attachment image request is unavailable"); this.name = "NativeAttachmentImageError"; } }
const inputSchema = z.object({ kind: z.enum(["support", "conversation"]), parentId: z.uuid(), messageId: z.uuid(), assetId: z.uuid(), contentType: z.enum(["image/png", "image/jpeg"]), sizeBytes: z.number().int().positive().max(DOCUMENT_UPLOAD_MAX_BYTES) }).strict();
/** Source binary GET capability only; parent/message membership is checked by the reviewed read model and server. */
export function bindNativeAttachmentImages(scope: ReadScope, read: (path: string, expected: AttachmentBinaryExpectation, signal: AbortSignal) => Promise<Uint8Array>, isCurrent: () => boolean) {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new NativeAttachmentImageError("scope"));
  const port: NativeAttachmentImages = Object.freeze({
    available(candidate) { try { lifetime.assert(candidate); return true; } catch { return false; } },
    async read(candidate, input, signal) { lifetime.assert(candidate); const parsed = inputSchema.safeParse(input); if (!parsed.success) throw new NativeAttachmentImageError("input"); const value = parsed.data, path = value.kind === "support" ? `/support/tickets/${value.parentId}/messages/${value.messageId}/attachments/${value.assetId}` : `/conversations/${value.parentId}/messages/${value.messageId}/attachments/${value.assetId}`;
      try { const result = await read(path, Object.freeze({ contentType: value.contentType, sizeBytes: value.sizeBytes }), signal); lifetime.assert(candidate); return result; } catch (error) { lifetime.assert(candidate); throw error; }
    },
  });
  return Object.freeze({ port, close: () => lifetime.close() });
}

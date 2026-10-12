import { z } from "zod";
import { DOCUMENT_UPLOAD_MAX_BYTES, DOCUMENT_UPLOAD_MAX_BASE64_CHARACTERS } from "./document-upload-limits.js";

export const CONVERSATION_FILE_MAX_BYTES = DOCUMENT_UPLOAD_MAX_BYTES;
export const CONVERSATION_FILE_MAX_COUNT = 10;
export const CONVERSATION_FILE_ACCEPT = ".png,.jpg,.jpeg,.pdf";
export const conversationAttachmentReferenceSchema = z.object({ assetId: z.uuid() }).strict();
export const conversationAttachmentReferencesSchema = z.array(conversationAttachmentReferenceSchema).max(CONVERSATION_FILE_MAX_COUNT)
  .refine(files => new Set(files.map(file => file.assetId)).size === files.length, "Duplicate attachments are not allowed");
export const conversationAttachmentSchema = conversationAttachmentReferenceSchema.extend({
  name: z.string().min(1).max(240), contentType: z.enum(["image/png", "image/jpeg", "application/pdf"]),
  sizeBytes: z.number().int().positive().max(CONVERSATION_FILE_MAX_BYTES),
});
export const uploadedConversationAttachmentSchema = conversationAttachmentSchema.extend({ expiresAt: z.iso.datetime() });
export const uploadConversationAttachmentSchema = z.object({
  contextType: z.enum(["OFFER", "ORDER"]), contextId: z.uuid(),
  fileName: z.string().trim().min(1).max(240), contentBase64: z.string().min(4).max(DOCUMENT_UPLOAD_MAX_BASE64_CHARACTERS),
}).strict();
export type ConversationAttachment = z.infer<typeof conversationAttachmentSchema>;
export type UploadedConversationAttachment = z.infer<typeof uploadedConversationAttachmentSchema>;
export type UploadConversationAttachmentInput = z.infer<typeof uploadConversationAttachmentSchema>;

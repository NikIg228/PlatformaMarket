import { z } from "zod";
import { DOCUMENT_UPLOAD_MAX_BYTES, DOCUMENT_UPLOAD_MAX_BASE64_CHARACTERS } from "./document-upload-limits.js";

export const SUPPORT_FILE_MAX_BYTES = DOCUMENT_UPLOAD_MAX_BYTES;
export const SUPPORT_FILE_MAX_COUNT = 10;
export const SUPPORT_FILE_ACCEPT = ".png,.jpg,.jpeg,.pdf,.docx,.xlsx";
export const supportAttachmentReferenceSchema = z.object({ assetId: z.uuid(), name: z.string().trim().min(1).max(240) });
export const supportAttachmentReferencesSchema = z.array(supportAttachmentReferenceSchema).max(SUPPORT_FILE_MAX_COUNT)
  .refine(files => new Set(files.map(file => file.assetId)).size === files.length, "Duplicate attachments are not allowed");
export const supportAttachmentSchema = supportAttachmentReferenceSchema.extend({
  contentType: z.enum(["image/png", "image/jpeg", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]),
  sizeBytes: z.number().int().positive().max(SUPPORT_FILE_MAX_BYTES),
});
export const uploadedSupportAttachmentSchema = supportAttachmentSchema.extend({ expiresAt: z.iso.datetime() });
export const uploadSupportAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  contentBase64: z.string().min(4).max(DOCUMENT_UPLOAD_MAX_BASE64_CHARACTERS),
});
export type SupportAttachment = z.infer<typeof supportAttachmentSchema>;
export type UploadedSupportAttachment = z.infer<typeof uploadedSupportAttachmentSchema>;
export type UploadSupportAttachmentInput = z.infer<typeof uploadSupportAttachmentSchema>;

import { describe, expect, it } from "vitest";
import { addSupportMessageSchema, createSupportTicketSchema } from "./commercial";
import { SUPPORT_FILE_MAX_COUNT, uploadSupportAttachmentSchema, uploadedSupportAttachmentSchema } from "./support-files";

const idempotencyKey = "60000000-0000-4000-8000-000000000001";
const file = { assetId: idempotencyKey, name: "Файл.pdf" };
describe("support file contracts", () => {
  it("accepts file-only replies and initial attachments; rejects empty or duplicate submissions", () => {
    expect(addSupportMessageSchema.parse({ idempotencyKey, body: "", attachments: [file] }).attachments).toEqual([file]);
    expect(addSupportMessageSchema.safeParse({ idempotencyKey, body: " " }).success).toBe(false);
    expect(addSupportMessageSchema.safeParse({ idempotencyKey, body: "text", attachments: [file, file] }).success).toBe(false);
    expect(addSupportMessageSchema.safeParse({ idempotencyKey, body: "text", attachments: Array(SUPPORT_FILE_MAX_COUNT + 1).fill(file) }).success).toBe(false);
    expect(createSupportTicketSchema.parse({ idempotencyKey, subject: "Тема", description: "Описание проблемы", category: "GENERAL", attachments: [file] }).attachments).toEqual([file]);
  });
  it("bounds upload metadata and returns known file types only", () => {
    expect(uploadSupportAttachmentSchema.safeParse({ fileName: "a".repeat(241), contentBase64: "AAAA" }).success).toBe(false);
    expect(uploadedSupportAttachmentSchema.safeParse({ ...file, sizeBytes: 10_000_001, contentType: "application/pdf", expiresAt: new Date().toISOString() }).success).toBe(false);
    expect(uploadedSupportAttachmentSchema.safeParse({ ...file, sizeBytes: 1, contentType: "text/html", expiresAt: new Date().toISOString() }).success).toBe(false);
  });
});

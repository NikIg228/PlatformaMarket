import { expect, it } from "vitest";
import { conversationMessageInputSchema, startConversationSchema } from "./conversations";
import { CONVERSATION_FILE_MAX_COUNT, uploadConversationAttachmentSchema, conversationAttachmentSchema } from "./conversation-files";

const id = "00000000-0000-4000-8000-000000000001";
it("accepts a private file reference with text or alone and bounds/uniquely identifies references", () => {
  const input = { body: "", idempotencyKey: id, attachments: [{ assetId: id }] };
  expect(conversationMessageInputSchema.safeParse(input).success).toBe(true);
  expect(startConversationSchema.safeParse({ ...input, contextType: "OFFER", contextId: id }).success).toBe(true);
  for (const attachments of [[], [{ assetId: id }, { assetId: id }], [{ assetId: "bad" }], Array(CONVERSATION_FILE_MAX_COUNT + 1).fill({ assetId: id })]) {
    expect(conversationMessageInputSchema.safeParse({ ...input, attachments }).success).toBe(false);
  }
});
it("binds an upload to a supported context and restricts response MIME to images/PDF", () => {
  const upload = { fileName: "image.png", contentBase64: "iVBORw==", contextType: "OFFER", contextId: id };
  expect(uploadConversationAttachmentSchema.safeParse(upload).success).toBe(true);
  expect(uploadConversationAttachmentSchema.safeParse({ ...upload, contextId: undefined }).success).toBe(false);
  expect(uploadConversationAttachmentSchema.safeParse({ ...upload, organizationId: id }).success).toBe(false);
  expect(conversationAttachmentSchema.safeParse({ assetId: id, name: "file.svg", contentType: "image/svg+xml", sizeBytes: 100 }).success).toBe(false);
});

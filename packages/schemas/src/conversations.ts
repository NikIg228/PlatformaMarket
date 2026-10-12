import { z } from "zod";
import { conversationAttachmentReferencesSchema, conversationAttachmentSchema } from "./conversation-files.js";
export * from "./conversation-files.js";

export const conversationContextSchema = z.object({
  contextType: z.enum(["OFFER", "ORDER"]),
  contextId: z.uuid(),
}).strict();
const messageFields = { body: z.string().trim().max(10_000), idempotencyKey: z.uuid(), attachments: conversationAttachmentReferencesSchema.optional() };
const hasContent = (input: { body: string; attachments?: unknown[] }) => Boolean(input.body || input.attachments?.length);
export const conversationMessageInputSchema = z.object(messageFields).strict().refine(hasContent, "A message or attachment is required");
export const startConversationSchema = conversationContextSchema.extend(messageFields).refine(hasContent, "A message or attachment is required");
export const conversationQuerySchema = z.object({ filter: z.enum(["ALL", "UNREAD", "ORDERS"]).default("ALL"), offset: z.coerce.number().int().min(0).max(100_000).default(0), limit: z.coerce.number().int().min(1).max(50).default(30) });
export const conversationReadSchema = z.object({ throughSequence: z.number().int().min(0) }).strict();
export const conversationEscalationSchema = z.object({ reason: z.string().trim().min(10).max(2_000), idempotencyKey: z.uuid() }).strict();
export const conversationResolveSchema = z.object({ expectedVersion: z.number().int().positive() }).strict();
export const conversationContextInfoSchema = z.object({
  title: z.string(), counterpartyName: z.string(), productId: z.uuid().nullable(),
  productName: z.string().nullable(), variantLabel: z.string().nullable(), packagingLabel: z.string().nullable(), imageUrl: z.string().nullable(),
});
export const conversationMessageSchema = z.object({ id: z.uuid(), sequence: z.number().int(), authorId: z.uuid(), authorOrganizationId: z.uuid(), authorName: z.string(), authorRole: z.enum(["BUYER", "SUPPLIER", "OPERATOR"]), body: z.string(), createdAt: z.string(), readByCounterparty: z.boolean(), attachments: z.array(conversationAttachmentSchema).optional() });
export const conversationSummarySchema = conversationContextSchema.extend({ id: z.uuid(), productId: z.uuid().nullable(), title: z.string(), buyerOrganizationId: z.uuid(), supplierOrganizationId: z.uuid(), counterpartyName: z.string(), resolved: z.boolean(), version: z.number().int(), latestSequence: z.number().int(), lastMessage: z.string(), updatedAt: z.string(), unread: z.boolean(), supportTicketId: z.uuid().nullable(), context: conversationContextInfoSchema.optional() });
export const conversationPageSchema = z.object({ items: z.array(conversationSummarySchema), hasMore: z.boolean(), unreadCount: z.number().int().nonnegative() });
export const conversationDetailSchema = z.object({ conversation: conversationSummarySchema, messages: z.array(conversationMessageSchema), hasOlder: z.boolean() });
export const conversationMessageQuerySchema = z.object({ beforeSequence: z.coerce.number().int().positive().optional() });
export const conversationResultSchema = z.object({ conversationId: z.uuid() });
export const conversationLookupSchema = z.object({ conversationId: z.uuid().nullable(), context: conversationContextInfoSchema.optional() });
export const conversationReadResultSchema = z.object({ throughSequence: z.number().int() });
export const conversationEscalationResultSchema = z.object({ ticketId: z.uuid() });
export type StartConversation = z.infer<typeof startConversationSchema>;
export type ConversationMessageInput = z.infer<typeof conversationMessageInputSchema>;
export type ConversationQuery = z.infer<typeof conversationQuerySchema>;
export type ConversationEscalation = z.infer<typeof conversationEscalationSchema>;
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
export type ConversationPage = z.infer<typeof conversationPageSchema>;
export type ConversationDetail = z.infer<typeof conversationDetailSchema>;
export type ConversationContextInfo = z.infer<typeof conversationContextInfoSchema>;
export type ConversationLookup = z.infer<typeof conversationLookupSchema>;

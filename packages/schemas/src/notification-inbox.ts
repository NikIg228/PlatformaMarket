import { z } from "zod";

export const notificationCategorySchema = z.enum(["orders", "payments", "delivery", "documents", "messages", "support", "organization", "products"]);
export const notificationInboxQuerySchema = z.object({
  cursor: z.string().min(1).max(1500).optional(), limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z.enum(["true", "false"]).transform(value => value === "true").optional(),
  category: notificationCategorySchema.optional(),
});
export const notificationInboxItemSchema = z.object({
  id: z.uuid(), category: notificationCategorySchema, title: z.string(), description: z.string(),
  context: z.string().nullable(), createdAt: z.iso.datetime(), readAt: z.iso.datetime().nullable(),
  readScope: z.enum(["organization", "personal"]),
  target: z.object({ type: z.enum(["order", "conversation", "support", "document", "organization", "products"]), id: z.uuid(), label: z.string(), section: z.enum(["proposals", "corrections", "import"]).optional() }).nullable(),
});
export const notificationInboxSchema = z.object({ items: z.array(notificationInboxItemSchema), nextCursor: z.string().nullable(), unreadCount: z.number().int().nonnegative(), asOf: z.iso.datetime() });
export const notificationReadAllSchema = z.object({ before: z.iso.datetime() }).strict();
export const notificationReadAllResultSchema = z.object({ count: z.number().int().nonnegative() });
export type NotificationInboxQuery = z.input<typeof notificationInboxQuerySchema>;
export type NotificationInboxItem = z.infer<typeof notificationInboxItemSchema>;
export type NotificationInbox = z.infer<typeof notificationInboxSchema>;

/** Only business-visible events enter the inbox. Internal reservation/check events stay in audit. */
export const notificationEvents: Record<z.infer<typeof notificationCategorySchema>, readonly string[]> = {
  orders: ["SupplierOrderCreated", "SupplierOrderConfirmed", "OrderReservationExpired", "OrderReceived"],
  payments: ["OrderWorkflowChanged", "RefundCompleted", "ManualPaymentReviewRequired"],
  delivery: ["ShipmentCreated", "ShipmentStatusChanged"],
  documents: ["DocumentSigned", "DocumentGenerated", "DocumentUploaded", "OrganizationCredentialExpired"],
  messages: ["ConversationMessageSaved"],
  support: ["SupportTicketCreated", "SupportTicketUpdated"],
  organization: ["ComplianceBlocked", "ComplianceReviewRequired"],
  products: ["ProductCandidateApproved", "ProductCandidateRejected", "ProductCorrectionApproved", "ProductCorrectionRejected", "ImportBatchProcessed"],
};

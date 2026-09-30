import { z } from "zod";
import { supplierOrderResponseSchema } from "./core-api.js";

const command = { expectedVersion: z.number().int().positive(), idempotencyKey: z.string().uuid() };
export const orderWorkflowCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...command, action: z.literal("RECEIVE_SHIPMENT"), shipmentId: z.string().uuid(), items: z.array(z.object({ shipmentItemId: z.string().uuid(), deliveredQuantity: z.string().regex(/^\d{1,12}(\.\d{1,6})?$/) })).min(1).max(500) }),
  z.object({ ...command, action: z.literal("ACCEPT_COMPOSITION") }),
  z.object({ ...command, action: z.literal("ISSUE_INVOICE"), documentId: z.string().uuid() }),
  z.object({ ...command, action: z.literal("REPORT_TRANSFER"), documentId: z.string().uuid(), invoiceDocumentId: z.string().uuid(), amountMinor: z.string().regex(/^[1-9]\d{0,19}$/), paidAt: z.string().datetime(), comment: z.string().trim().max(2000).default("") }),
  z.object({ ...command, action: z.literal("REQUEST_PAYMENT_DETAILS"), comment: z.string().trim().min(3).max(2000) }),
  z.object({ ...command, action: z.literal("CONFIRM_TRANSFER"), claimId: z.string().uuid() }),
  z.object({ ...command, action: z.literal("CANCEL"), reason: z.string().trim().min(3).max(2000), transferNotMade: z.literal(true) }),
]);
export const orderWorkflowEventSchema = z.object({ id: z.string().uuid(), action: z.string(), actorId: z.string().uuid(), organizationId: z.string().uuid(), createdAt: z.string(), details: z.record(z.string(), z.unknown()) });
export const orderTransferClaimSchema = z.object({ id: z.string().uuid(), invoiceDocumentId: z.string().uuid(), documentId: z.string().uuid(), amountMinor: z.string(), currency: z.string(), paidAt: z.string(), comment: z.string(), status: z.enum(["PENDING", "NEEDS_INFORMATION", "CONFIRMED"]), createdAt: z.string(), confirmedAt: z.string().nullable(), confirmedById: z.string().uuid().nullable() });
export const orderReservationStateSchema = z.object({ status: z.enum(["NONE", "ACTIVE", "DUE", "HELD_TRANSFER", "HELD_EXTERNAL", "SETTLED", "EXPIRED"]), expiresAt: z.string().datetime().nullable() });
export const orderWorkflowResponseSchema = z.object({ orderId: z.string().uuid(), order: supplierOrderResponseSchema, version: z.number().int(), status: z.string(), paymentStatus: z.string(), invoiceDocumentId: z.string().uuid().nullable(), claims: z.array(orderTransferClaimSchema), events: z.array(orderWorkflowEventSchema), reservationState: orderReservationStateSchema.optional() });
export const orderWorkflowResultSchema = z.object({ orderId: z.string().uuid(), version: z.number().int(), status: z.string(), paymentStatus: z.string(), eventId: z.string().uuid() });
export type OrderWorkflowCommand = z.infer<typeof orderWorkflowCommandSchema>;
export type OrderWorkflowResponse = z.infer<typeof orderWorkflowResponseSchema>;
export type OrderWorkflowResult = z.infer<typeof orderWorkflowResultSchema>;

import { z } from "zod";
import { supplierOrderResponseSchema } from "./core-api.js";
import { paymentReviewStatusSchema, paymentSummarySchema, paymentReductionLineSchema, paymentReductionSchema, positiveMinorAmountSchema } from "./manual-payments.js";
import { orderReturnSchema, returnKindSchema, returnLineSchema } from "./order-returns.js";

const command = { expectedVersion: z.number().int().positive(), idempotencyKey: z.string().uuid() };
export const orderWorkflowCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...command, action: z.literal("REQUEST_RETURN"), kind: returnKindSchema, reason: z.string().trim().min(3).max(2000), items: z.array(returnLineSchema).max(500).default([]) }),
  z.object({ ...command, action: z.literal("DECIDE_RETURN"), returnId: z.uuid(), accepted: z.boolean(), reason: z.string().trim().min(3).max(2000) }),
  z.object({ ...command, action: z.literal("SEND_RETURN_GOODS"), returnId: z.uuid() }),
  z.object({ ...command, action: z.literal("RECEIVE_RETURN_GOODS"), returnId: z.uuid() }),
  z.object({ ...command, action: z.literal("SEND_MANUAL_REFUND"), returnId: z.uuid(), documentId: z.uuid() }),
  z.object({ ...command, action: z.literal("RECEIVE_MANUAL_REFUND"), returnId: z.uuid() }),
  z.object({ ...command, action: z.literal("REORDER") }),
  z.object({ ...command, action: z.literal("RECEIVE_SHIPMENT"), shipmentId: z.string().uuid(), items: z.array(z.object({ shipmentItemId: z.string().uuid(), deliveredQuantity: z.string().regex(/^\d{1,12}(\.\d{1,6})?$/) })).min(1).max(500) }),
  z.object({ ...command, action: z.literal("ACCEPT_COMPOSITION") }),
  z.object({ ...command, action: z.literal("ISSUE_INVOICE"), documentId: z.string().uuid() }),
  z.object({ ...command, action: z.literal("REPORT_TRANSFER"), documentId: z.string().uuid(), invoiceDocumentId: z.string().uuid(), amountMinor: z.string().regex(/^[1-9]\d{0,19}$/), paidAt: z.string().datetime(), comment: z.string().trim().max(2000).default("") }),
  z.object({ ...command, action: z.literal("REQUEST_PAYMENT_DETAILS"), comment: z.string().trim().min(3).max(2000) }),
  z.object({ ...command, action: z.literal("CONFIRM_TRANSFER"), claimId: z.string().uuid(), receivedAmountMinor: positiveMinorAmountSchema.optional() }),
  z.object({ ...command, action: z.literal("RECORD_TRANSFER_CHECK"), claimId: z.uuid(), nextCheckAt: z.iso.datetime(), comment: z.string().trim().min(3).max(2000) }),
  z.object({ ...command, action: z.literal("OPEN_PAYMENT_DISPUTE"), claimId: z.uuid(), reason: z.string().trim().min(3).max(2000) }),
  z.object({ ...command, action: z.literal("PROPOSE_PAYMENT_REDUCTION"), items: z.array(paymentReductionLineSchema).min(1).max(500), reason: z.string().trim().min(3).max(2000) }),
  z.object({ ...command, action: z.literal("DECIDE_PAYMENT_REDUCTION"), reductionId: z.uuid(), accepted: z.boolean() }),
  z.object({ ...command, action: z.literal("CANCEL"), reason: z.string().trim().min(3).max(2000), transferNotMade: z.literal(true) }),
]);
export const orderWorkflowEventSchema = z.object({ id: z.string().uuid(), action: z.string(), actorId: z.string().uuid(), organizationId: z.string().uuid(), createdAt: z.string(), details: z.record(z.string(), z.unknown()) });
export const orderTransferClaimSchema = z.object({ id: z.string().uuid(), invoiceDocumentId: z.string().uuid(), documentId: z.string().uuid(), amountMinor: z.string(), currency: z.string(), paidAt: z.string(), comment: z.string(), status: paymentReviewStatusSchema, createdAt: z.string(), confirmedAt: z.string().nullable(), confirmedById: z.string().uuid().nullable(), receivedAmountMinor: z.string().nullable().optional(), checkedAt: z.string().nullable().optional(), nextCheckAt: z.string().nullable().optional(), supportTicketId: z.uuid().nullable().optional() });
export const orderReservationStateSchema = z.object({ status: z.enum(["NONE", "ACTIVE", "DUE", "HELD_TRANSFER", "HELD_EXTERNAL", "SETTLED", "EXPIRED"]), expiresAt: z.string().datetime().nullable() });
export const orderWorkflowResponseSchema = z.object({ orderId: z.string().uuid(), order: supplierOrderResponseSchema, version: z.number().int(), status: z.string(), paymentStatus: z.string(), invoiceDocumentId: z.string().uuid().nullable(), claims: z.array(orderTransferClaimSchema), events: z.array(orderWorkflowEventSchema), reservationState: orderReservationStateSchema.optional(), paymentSummary: paymentSummarySchema.optional(), reductions: z.array(paymentReductionSchema).optional(), paymentReviewConfigured: z.boolean().optional(), returns: z.array(orderReturnSchema).optional() });
export const orderWorkflowResultSchema = z.object({ orderId: z.string().uuid(), version: z.number().int(), status: z.string(), paymentStatus: z.string(), eventId: z.string().uuid(), cartId: z.uuid().optional() });
export type OrderWorkflowCommand = z.infer<typeof orderWorkflowCommandSchema>;
export type OrderWorkflowResponse = z.infer<typeof orderWorkflowResponseSchema>;
export type OrderWorkflowResult = z.infer<typeof orderWorkflowResultSchema>;

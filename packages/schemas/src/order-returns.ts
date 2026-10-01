import { z } from "zod";
export const returnKindSchema = z.enum(["CANCELLATION", "GOODS", "OVERPAYMENT"]);
export const returnStatusSchema = z.enum(["REQUESTED", "REJECTED", "AGREED", "GOODS_SENT", "GOODS_RECEIVED", "REFUND_SENT", "REFUND_RECEIVED"]);
export const returnLineSchema = z.object({ orderItemId: z.uuid(), quantity: z.string().regex(/^(?:[1-9]\d{0,11}(?:\.\d{1,6})?|0\.\d{1,6})$/).refine(value => /[1-9]/.test(value), "Quantity must be positive"), condition: z.string().trim().min(3).max(1000) });
export const orderReturnSchema = z.object({ id: z.uuid(), supplierOrderId: z.uuid(), kind: returnKindSchema, status: returnStatusSchema,
  reason: z.string(), decisionReason: z.string().nullable(), amountMinor: z.string(), currency: z.string(), items: z.array(returnLineSchema),
  requestedById: z.uuid(), createdAt: z.string(), decidedAt: z.string().nullable(), goodsSentAt: z.string().nullable(), goodsReceivedAt: z.string().nullable(),
  refundDocumentId: z.uuid().nullable(), refundSentAt: z.string().nullable(), refundReceivedAt: z.string().nullable(),
});
export type OrderReturn = z.infer<typeof orderReturnSchema>;

import { z } from "zod";

export const createPaymentIntentSchema = z.object({
  providerCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,31}$/).default("MOCK"),
  idempotencyKey: z.string().trim().min(8).max(160),
});

export const captureMockPaymentSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
});

export const createPaymentSessionSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  returnUrl: z.url().max(2_000).nullable().optional(),
});

export const authorizePaymentSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
});

export const capturePaymentSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  allocationIds: z.array(z.uuid()).min(1).max(500).optional(),
});

export const cancelPaymentIntentSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  reason: z.string().trim().min(3).max(500),
});

export const onboardPaymentMerchantSchema = z.object({
  providerCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,31}$/),
  idempotencyKey: z.string().trim().min(8).max(160),
  returnUrl: z.url().max(2_000).nullable().optional(),
});

export const requestPaymentMerchantChangeSchema = z.object({
  requestedExternalMerchantId: z.string().trim().min(3).max(240),
  reason: z.string().trim().min(5).max(1_000),
});

export const reviewPaymentMerchantChangeSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().trim().min(3).max(1_000),
});

export const createRefundSchema = z.object({
  amountMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  supplierOrderItemId: z.uuid().nullable().optional(),
  quantity: z.number().positive().nullable().optional(),
  reason: z.string().trim().min(3).max(1_000),
  idempotencyKey: z.string().trim().min(8).max(160),
});

export const processPayoutSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
});

export const paymentOperationsQuerySchema = z.object({
  status: z.string().trim().min(1).max(80).optional(),
  providerCode: z.string().trim().max(32).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const paymentReconciliationImportSchema = z.object({
  providerCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,31}$/),
  records: z.array(z.object({
    externalTransactionId: z.string().trim().min(1).max(240),
    type: z.enum(["AUTHORIZATION", "CAPTURE", "VOID", "REFUND", "PAYOUT", "CHARGEBACK", "REVERSAL"]),
    status: z.enum(["PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED"]),
    amountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    currency: z.string().trim().regex(/^[A-Z]{3}$/),
  })).min(1).max(10_000),
});

export const ledgerQuerySchema = z.object({
  referenceType: z.string().trim().min(1).max(80).optional(),
  referenceId: z.string().trim().min(1).max(160).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
}).refine((value) => !value.referenceId || value.referenceType, {
  message: "referenceType is required when referenceId is provided",
  path: ["referenceType"],
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;

export type CaptureMockPaymentInput = z.infer<typeof captureMockPaymentSchema>;

export type CreatePaymentSessionInput = z.infer<typeof createPaymentSessionSchema>;

export type AuthorizePaymentInput = z.infer<typeof authorizePaymentSchema>;

export type CapturePaymentInput = z.infer<typeof capturePaymentSchema>;

export type CancelPaymentIntentInput = z.infer<typeof cancelPaymentIntentSchema>;

export type OnboardPaymentMerchantInput = z.infer<typeof onboardPaymentMerchantSchema>;

export type RequestPaymentMerchantChangeInput = z.infer<typeof requestPaymentMerchantChangeSchema>;

export type ReviewPaymentMerchantChangeInput = z.infer<typeof reviewPaymentMerchantChangeSchema>;

export type CreateRefundInput = z.infer<typeof createRefundSchema>;

export type ProcessPayoutInput = z.infer<typeof processPayoutSchema>;

export type PaymentOperationsQueryInput = z.infer<typeof paymentOperationsQuerySchema>;

export type PaymentReconciliationImportInput = z.infer<typeof paymentReconciliationImportSchema>;

export type LedgerQueryInput = z.infer<typeof ledgerQuerySchema>;

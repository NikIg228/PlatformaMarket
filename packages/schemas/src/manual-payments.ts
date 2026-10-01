import { z } from "zod";

export const positiveMinorAmountSchema = z.string().regex(/^[1-9]\d{0,19}$/);
export const nonnegativeMinorAmountSchema = z.string().regex(/^(0|[1-9]\d{0,19})$/);
export const paymentSummarySchema = z.object({
  confirmedAmountMinor: nonnegativeMinorAmountSchema,
  remainingAmountMinor: nonnegativeMinorAmountSchema,
  overpaidAmountMinor: nonnegativeMinorAmountSchema,
  status: z.enum(["UNREPORTED", "PENDING", "PARTIALLY_RECEIVED", "PAID", "OVERPAID", "DISPUTED"]),
});
export const paymentReviewStatusSchema = z.enum(["PENDING", "NEEDS_INFORMATION", "NOT_RECEIVED", "DISPUTED", "CONFIRMED"]);
export const paymentReductionLineSchema = z.object({
  itemId: z.uuid(), acceptedQuantity: z.string().regex(/^\d{1,12}(\.\d{1,6})?$/),
});
export const paymentReductionSchema = z.object({
  id: z.uuid(), proposedByOrganizationId: z.uuid(), proposedById: z.uuid(),
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "SUPERSEDED"]), reason: z.string(),
  previousAmountMinor: nonnegativeMinorAmountSchema, proposedAmountMinor: positiveMinorAmountSchema,
  items: z.array(paymentReductionLineSchema.extend({ previousQuantity: z.string(), unitPriceMinor: z.string(), totalPriceMinor: z.string() })),
  createdAt: z.string(), decidedAt: z.string().nullable(), decidedById: z.uuid().nullable(),
});
const workingWindowSchema = z.object({
  day: z.number().int().min(1).max(7), // ISO weekday, Monday = 1.
  fromMinute: z.number().int().min(0).max(1439),
  toMinute: z.number().int().min(1).max(1440),
}).strict().refine(value => value.fromMinute < value.toMinute, "Конец рабочего периода должен быть позже начала");
export const supplierPaymentPolicyFieldsSchema = z.object({
  primaryUserId: z.uuid(), backupUserId: z.uuid(),
  timezone: z.string().max(100).refine(value => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; } catch { return false; }
  }, "Укажите часовой пояс IANA"),
  workingWindows: z.array(workingWindowSchema).min(1).max(28),
}).strict().superRefine((value, context) => {
  if (value.primaryUserId === value.backupUserId) context.addIssue({ code: "custom", path: ["backupUserId"], message: "Выберите другого резервного сотрудника" });
  const ordered = [...value.workingWindows].sort((a, b) => a.day - b.day || a.fromMinute - b.fromMinute);
  for (let i = 1; i < ordered.length; i++) {
    const previous = ordered[i - 1]!; const current = ordered[i]!;
    if (previous.day === current.day && previous.toMinute > current.fromMinute)
      context.addIssue({ code: "custom", path: ["workingWindows"], message: "Рабочие периоды не должны пересекаться" });
  }
});
export const saveSupplierPaymentPolicySchema = supplierPaymentPolicyFieldsSchema.safeExtend({
  expectedVersion: z.number().int().min(0), idempotencyKey: z.uuid(),
});
export const supplierPaymentPolicyResponseSchema = z.object({
  organizationId: z.uuid(), version: z.number().int().min(0),
  policy: supplierPaymentPolicyFieldsSchema.nullable(),
  eligibleMembers: z.array(z.object({ userId: z.uuid(), displayName: z.string() })),
});
export type PaymentSummary = z.infer<typeof paymentSummarySchema>;
export type SupplierPaymentPolicyFields = z.infer<typeof supplierPaymentPolicyFieldsSchema>;
export type SaveSupplierPaymentPolicy = z.infer<typeof saveSupplierPaymentPolicySchema>;
export type SupplierPaymentPolicyResponse = z.infer<typeof supplierPaymentPolicyResponseSchema>;

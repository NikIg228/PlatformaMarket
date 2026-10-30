import { z } from "zod";
import { offerVatInputSchema } from "../vat";

export const setInventoryBalanceSchema = z.object({
  initialForOffer: z.boolean().optional(),
  warehouseId: z.uuid(),
  productVariantId: z.uuid(),
  offerId: z.uuid().nullable().optional(),
  quantityOnHand: z.number().nonnegative(),
  quantityReserved: z.number().nonnegative().default(0),
  safetyStock: z.number().nonnegative().default(0),
  source: z.enum(["MANUAL", "IMPORT", "API", "ERP"]).default("MANUAL"),
}).refine((value) => value.quantityReserved + value.safetyStock <= value.quantityOnHand, {
  message: "Reserved quantity and safety stock cannot exceed on-hand quantity",
});

export const createInventoryLotSchema = z.object({
  inventoryBalanceId: z.uuid(),
  offerId: z.uuid().nullable().optional(),
  lotNumber: z.string().trim().min(1).max(120),
  series: z.string().trim().max(120).nullable().optional(),
  serialNumber: z.string().trim().max(160).nullable().optional(),
  manufactureDate: z.iso.date().nullable().optional(),
  expirationDate: z.iso.date().nullable().optional(),
  registrationCertificate: z.string().trim().max(240).nullable().optional(),
  importerOrganizationId: z.uuid().nullable().optional(),
  originSource: z.string().trim().max(160).nullable().optional(),
  quantityOnHand: z.number().nonnegative(),
  quantityReserved: z.number().nonnegative().default(0),
  status: z.enum(["ACTIVE", "QUARANTINED", "BLOCKED", "RECALLED", "EXPIRED", "DEPLETED", "UNDER_REVIEW"]).default("UNDER_REVIEW"),
}).refine((value) => value.quantityReserved <= value.quantityOnHand, "Reserved lot quantity cannot exceed on-hand quantity")
  .refine((value) => !value.manufactureDate || !value.expirationDate || value.manufactureDate <= value.expirationDate, "Manufacture date must not be after expiration date");

export const createInventoryReservationSchema = z.object({
  quantity: z.number().positive(),
  idempotencyKey: z.string().trim().min(8).max(160),
  ttlMinutes: z.number().int().min(1).max(24 * 60).default(30),
  inventoryLotId: z.uuid().nullable().optional(),
  referenceType: z.string().trim().max(80).nullable().optional(),
  referenceId: z.string().trim().max(160).nullable().optional(),
});

export type SetInventoryBalanceInput = z.infer<typeof setInventoryBalanceSchema>;

export type CreateInventoryLotInput = z.infer<typeof createInventoryLotSchema>;

export type CreateInventoryReservationInput = z.infer<typeof createInventoryReservationSchema>;

export const recomputeFreshnessSchema = z.object({
  staleAfterMinutes: z.number().int().min(1).max(30 * 24 * 60).optional(),
});

export const upsertFreshnessPolicySchema = z.object({
  source: z.enum(["MANUAL", "IMPORT", "API", "ERP"]),
  dataType: z.enum(["PRICE", "INVENTORY"]),
  staleAfterMinutes: z.number().int().min(1).max(365 * 24 * 60),
  expirationBehavior: z.enum(["ALLOW_AUTO", "REQUIRE_CONFIRMATION", "MARK_UNKNOWN", "PAUSE"]),
  confirmationRequired: z.boolean().default(false),
  priority: z.number().int().min(0).max(10_000).default(100),
});

const manualOverrideAmountMinorSchema = z.union([
  z.string().regex(/^(0|[1-9]\d{0,19})$/, "amountMinor must be a canonical 1-20 digit integer string"),
  z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).transform(String),
]);

export const createDataOverrideSchema = z.object({
  tax: offerVatInputSchema.optional(),
  target: z.enum(["PRICE", "INVENTORY"]),
  offerId: z.uuid().nullable().optional(),
  inventoryBalanceId: z.uuid().nullable().optional(),
  mode: z.enum(["UNTIL_DATE", "UNTIL_NEXT_SYNC", "ONE_TIME", "PERMANENT"]),
  value: z.record(z.string(), z.unknown()),
  reason: z.string().trim().min(3).max(1_000),
  validUntil: z.iso.datetime().nullable().optional(),
}).superRefine((value, context) => {
  if (value.tax && value.target !== "PRICE") context.addIssue({ code: "custom", message: "Налоговые условия применимы только к цене", path: ["tax"] });
  if (value.target === "PRICE" && (!value.offerId || value.inventoryBalanceId)) context.addIssue({ code: "custom", message: "Price override requires only offerId", path: ["offerId"] });
  if (value.target === "INVENTORY" && !value.inventoryBalanceId) context.addIssue({ code: "custom", message: "Inventory override requires inventoryBalanceId", path: ["inventoryBalanceId"] });
  if (value.mode === "UNTIL_DATE" && !value.validUntil) context.addIssue({ code: "custom", message: "Until-date override requires validUntil", path: ["validUntil"] });
  if (value.target === "PRICE" && !manualOverrideAmountMinorSchema.safeParse(value.value.amountMinor).success) context.addIssue({ code: "custom", message: "Price override requires amountMinor as a canonical integer string or a safe non-negative integer", path: ["value", "amountMinor"] });
  if (value.target === "INVENTORY" && (typeof value.value.quantityOnHand !== "number" || value.value.quantityOnHand < 0)) context.addIssue({ code: "custom", message: "Inventory override requires non-negative quantityOnHand", path: ["value", "quantityOnHand"] });
}).transform((value) => value.target === "PRICE"
  ? { ...value, value: { ...value.value, amountMinor: manualOverrideAmountMinorSchema.parse(value.value.amountMinor) } }
  : value
);

export const createLotRecallSchema = z.object({
  inventoryLotId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
  source: z.string().trim().min(2).max(160),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  comment: z.string().trim().max(1_000).nullable().optional(),
});

export const resolveLotRecallSchema = z.object({
  comment: z.string().trim().min(3).max(1_000),
});

export type RecomputeFreshnessInput = z.infer<typeof recomputeFreshnessSchema>;

export type CreateLotRecallInput = z.infer<typeof createLotRecallSchema>;

export type ResolveLotRecallInput = z.infer<typeof resolveLotRecallSchema>;

export type UpsertFreshnessPolicyInput = z.infer<typeof upsertFreshnessPolicySchema>;

export type CreateDataOverrideInput = z.infer<typeof createDataOverrideSchema>;

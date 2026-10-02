import { z } from "zod";

export const commerceDatasetSchema = z.enum(["BUSINESS", "DEMO", "TEST", "UNCLASSIFIED"]);
export const commerceMetricKindSchema = z.enum(["CREATED", "CONFIRMED", "RECEIVED", "RETURNED", "FULFILLED", "CANCELLED", "REFUSED_PRICE", "REFUSED_STOCK", "REFUSED_OTHER"]);
const minor = z.string().regex(/^-?\d+$/);
export const commerceAnalyticsQuerySchema = z.object({
  from: z.iso.datetime({ offset: true }), to: z.iso.datetime({ offset: true }),
  timezone: z.enum(["Asia/Qyzylorda", "UTC"]).default("Asia/Qyzylorda"),
  dataset: commerceDatasetSchema.default("BUSINESS"), currency: z.literal("KZT").default("KZT"),
  organizationId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).superRefine((value, ctx) => {
  const duration = Date.parse(value.to) - Date.parse(value.from);
  if (duration <= 0 || duration > 93 * 86400000) ctx.addIssue({ code: "custom", path: ["to"], message: "Период должен быть больше нуля и не превышать 93 дня" });
});
export const commerceMetricTotalsSchema = z.object({
  createdOrders: z.number().int().nonnegative(), confirmedOrders: z.number().int().nonnegative(),
  receivedOrders: z.number().int().nonnegative(), fulfilledOrders: z.number().int().nonnegative(),
  cancelledOrders: z.number().int().nonnegative(), refusedPriceOrders: z.number().int().nonnegative(),
  refusedStockOrders: z.number().int().nonnegative(), refusedOtherOrders: z.number().int().nonnegative(),
  createdGoodsMinor: minor, confirmedGoodsMinor: minor, receivedGoodsMinor: minor, returnedGoodsMinor: minor,
  netReceivedGoodsMinor: minor, preliminaryCommissionMinor: minor, accruedCommissionMinor: minor,
  collectedCommissionMinor: z.null(), commissionDebtMinor: z.null(),
});
export const commerceMetricEventSchema = z.object({
  id: z.uuid(), orderId: z.uuid(), orderNumber: z.string(), kind: commerceMetricKindSchema,
  occurredAt: z.string(), buyerOrganizationId: z.uuid(), supplierOrganizationId: z.uuid(),
  goodsAmountMinor: minor, commissionAmountMinor: minor, currency: z.literal("KZT"), dataset: commerceDatasetSchema,
});
export const commerceAnalyticsResponseSchema = z.object({
  period: z.object({ from: z.string(), to: z.string(), timezone: z.string(), boundary: z.literal("FROM_INCLUSIVE_TO_EXCLUSIVE") }),
  dataset: commerceDatasetSchema, currency: z.literal("KZT"), generatedAt: z.string(),
  commissionRateBps: z.literal(1000), commissionRuleVersion: z.literal("GOODS_RECEIPT_V1"),
  totals: commerceMetricTotalsSchema,
  repeatBuyers30Days: z.number().int().nonnegative(), repeatBuyers60Days: z.number().int().nonnegative(),
  overdueShipmentsAsOfNow: z.number().int().nonnegative(),
  coverage: z.object({ untrackedOrdersInPeriod: z.number().int().nonnegative(), historyComplete: z.boolean(), note: z.string() }),
  organizations: z.array(z.object({ organizationId: z.uuid(), name: z.string(), side: z.enum(["BUYER", "SUPPLIER"]), totals: commerceMetricTotalsSchema })),
  organizationsTruncated: z.boolean(),
  events: z.array(commerceMetricEventSchema), totalEvents: z.number().int().nonnegative(), page: z.number().int(), pageSize: z.number().int(),
});
export type CommerceAnalyticsQuery = z.infer<typeof commerceAnalyticsQuerySchema>;
export type CommerceAnalyticsResponse = z.infer<typeof commerceAnalyticsResponseSchema>;
export type CommerceMetricTotals = z.infer<typeof commerceMetricTotalsSchema>;
export type CommerceDataset = z.infer<typeof commerceDatasetSchema>;

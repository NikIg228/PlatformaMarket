import { z } from "zod";

const quantity = z.string().regex(/^(?:[1-9]\d{0,11}(?:\.\d{1,6})?|0\.\d{1,6})$/).refine(value => /[1-9]/.test(value), "Quantity must be positive");
const minor = z.string().regex(/^\d{1,20}$/);
export const promotionMechanicSchema = z.enum(["PERCENTAGE", "FIXED_AMOUNT", "BUY_X_GET_Y"]);
export const promotionTermsSchema = z.object({
  offerId: z.uuid(), name: z.string().trim().min(3).max(160), description: z.string().trim().max(1000).default(""),
  kind: promotionMechanicSchema, percentageBasisPoints: z.number().int().min(1).max(9000).nullable().default(null),
  fixedAmountMinor: minor.nullable().default(null), buyQuantity: quantity.nullable().default(null),
  giftOfferId: z.uuid().nullable().default(null), giftQuantity: quantity.nullable().default(null),
  minimumQuantity: quantity.default("1"), quantityLimit: quantity,
  startsAt: z.iso.datetime(), endsAt: z.iso.datetime(),
}).superRefine((value, ctx) => {
  if (Date.parse(value.startsAt) >= Date.parse(value.endsAt)) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Дата окончания должна быть позже начала" });
  if (value.kind === "PERCENTAGE" && value.percentageBasisPoints === null) ctx.addIssue({ code: "custom", path: ["percentageBasisPoints"], message: "Укажите скидку" });
  if (value.kind === "FIXED_AMOUNT" && (!value.fixedAmountMinor || BigInt(value.fixedAmountMinor) === BigInt(0))) ctx.addIssue({ code: "custom", path: ["fixedAmountMinor"], message: "Укажите положительную скидку" });
  if (value.kind === "BUY_X_GET_Y" && (!value.buyQuantity || !value.giftOfferId || !value.giftQuantity)) ctx.addIssue({ code: "custom", path: ["giftOfferId"], message: "Укажите количество покупки, подарок и его количество" });
});
export const createOfferPromotionSchema = z.object({ terms: promotionTermsSchema, sourceTemplateId: z.uuid().optional(), idempotencyKey: z.string().min(8).max(160) });
export const reviseOfferPromotionSchema = z.object({ terms: promotionTermsSchema, expectedVersion: z.number().int().positive(), idempotencyKey: z.string().min(8).max(160) });
const commandBase = { expectedVersion: z.number().int().positive(), idempotencyKey: z.string().min(8).max(160) };
export const offerPromotionCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...commandBase, action: z.enum(["SUBMIT", "PAUSE", "RESUME", "ARCHIVE", "SAVE_TEMPLATE"]) }),
  z.object({ ...commandBase, action: z.enum(["APPROVE", "REQUEST_CHANGES", "REJECT"]), reason: z.string().trim().min(3).max(1000) }),
  z.object({ ...commandBase, action: z.literal("PLACE"), startsAt: z.iso.datetime().nullable(), endsAt: z.iso.datetime().nullable() }).refine(value => (!value.startsAt && !value.endsAt) || Boolean(value.startsAt && value.endsAt && Date.parse(value.startsAt) < Date.parse(value.endsAt)), "Укажите оба срока размещения"),
]);
export const promotionPriceEvidenceSchema = z.object({ capturedAt: z.string(), baseAmountMinor: minor, currency: z.string(), minimum30DaysMinor: minor,
  historyDays: z.number().nonnegative().max(30), raisedRecently: z.boolean(), observations: z.array(z.object({ amountMinor: minor, observedAt: z.string() })) });
export const acceptedPromotionSchema = z.object({ promotionId: z.uuid(), revision: z.number().int().positive(), name: z.string(),
  kind: promotionMechanicSchema, baseUnitPriceMinor: minor, unitPriceMinor: minor, discountMinor: minor,
  endsAt: z.string(), buyQuantity: z.string().nullable(), giftPerGroup: z.string().nullable(),
  gift: z.object({ offerId: z.uuid(), name: z.string(), quantity: quantity }).nullable(),
});
export const offerPromotionSchema = z.object({ id: z.uuid(), supplierOrganizationId: z.uuid(), supplierName: z.string(), offerName: z.string(), productId: z.uuid(), giftName: z.string().nullable(),
  terms: promotionTermsSchema, version: z.number().int().positive(), revision: z.number().int().positive(),
  moderationStatus: z.enum(["DRAFT", "PENDING", "CHANGES_REQUESTED", "REJECTED", "APPROVED", "LEGACY_UNREVIEWED"]),
  temporalStatus: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "ENDED"]), status: z.string(),
  evidence: promotionPriceEvidenceSchema, unitPriceMinor: minor, currency: z.string(), claimedQuantity: z.string(),
  isTemplate: z.boolean(), placementStartsAt: z.string().nullable(), placementEndsAt: z.string().nullable(),
  revisions: z.array(z.object({ revision: z.number().int().positive(), terms: promotionTermsSchema, evidence: promotionPriceEvidenceSchema, createdAt: z.string() })),
  decisions: z.array(z.object({ action: z.string(), reason: z.string().nullable(), actorId: z.uuid(), revision: z.number().int().positive(), createdAt: z.string() })),
});
export const promotionListQuerySchema = z.object({ q: z.string().trim().max(160).optional(), supplierOrganizationId: z.uuid().optional(),
  categoryId: z.uuid().optional(), productId: z.uuid().optional(), kind: promotionMechanicSchema.optional(), featured: z.preprocess(value => value === "true" ? true : value === "false" ? false : value, z.boolean().optional()),
  moderationStatus: z.enum(["DRAFT", "PENDING", "CHANGES_REQUESTED", "REJECTED", "APPROVED"]).optional(),
  phase: z.enum(["ACTIVE", "SCHEDULED", "ENDED"]).optional(),
  sort: z.enum(["ENDING", "NEWEST"]).default("ENDING"), limit: z.coerce.number().int().min(1).max(50).default(24), offset: z.coerce.number().int().min(0).max(10000).default(0),
});
export const promotionPageSchema = z.object({ items: z.array(offerPromotionSchema), total: z.number().int().nonnegative(), limit: z.number().int(), offset: z.number().int() });
export const publicPromotionSchema = offerPromotionSchema.pick({ id: true, supplierOrganizationId: true, supplierName: true, offerName: true, productId: true, giftName: true,
  terms: true, temporalStatus: true, unitPriceMinor: true, currency: true }).extend({ baseAmountMinor: minor });
export const publicPromotionPageSchema = promotionPageSchema.extend({ items: z.array(publicPromotionSchema) });
export type PromotionTerms = z.infer<typeof promotionTermsSchema>;
export type CreateOfferPromotion = z.infer<typeof createOfferPromotionSchema>;
export type ReviseOfferPromotion = z.infer<typeof reviseOfferPromotionSchema>;
export type OfferPromotionCommand = z.infer<typeof offerPromotionCommandSchema>;
export type OfferPromotion = z.infer<typeof offerPromotionSchema>;
export type PromotionPage = z.infer<typeof promotionPageSchema>;
export type PromotionListQuery = z.infer<typeof promotionListQuerySchema>;
export type AcceptedPromotion = z.infer<typeof acceptedPromotionSchema>;
export type PromotionPriceEvidence = z.infer<typeof promotionPriceEvidenceSchema>;
export type PublicPromotion = z.infer<typeof publicPromotionSchema>;
export type PublicPromotionPage = z.infer<typeof publicPromotionPageSchema>;

export { sameAcceptedPromotion, giftForPromotionQuantity, orderItemPromotion } from "./promotion-snapshot";

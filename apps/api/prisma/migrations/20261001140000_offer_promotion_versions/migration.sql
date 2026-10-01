ALTER TYPE "PromotionKind" ADD VALUE IF NOT EXISTS 'BUY_X_GET_Y';
ALTER TABLE "Promotion"
  ADD COLUMN "offerId" UUID,
  ADD COLUMN "baseAmountMinor" DECIMAL(20,0),
  ADD COLUMN "buyQuantity" DECIMAL(18,6),
  ADD COLUMN "giftOfferId" UUID,
  ADD COLUMN "giftQuantity" DECIMAL(18,6),
  ADD COLUMN "quantityLimit" DECIMAL(18,6),
  ADD COLUMN "claimedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN "moderationStatus" TEXT NOT NULL DEFAULT 'LEGACY_UNREVIEWED',
  ADD COLUMN "termsRevision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "approvedRevision" INTEGER,
  ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "placementStartsAt" TIMESTAMP(3),
  ADD COLUMN "placementEndsAt" TIMESTAMP(3),
  ADD CONSTRAINT "Promotion_quantity_check" CHECK ("claimedQuantity" >= 0 AND ("quantityLimit" IS NULL OR "quantityLimit" > 0));
CREATE INDEX "Promotion_offerId_moderationStatus_startsAt_endsAt_idx" ON "Promotion"("offerId","moderationStatus","startsAt","endsAt");
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SupplierOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "PromotionRevision" (
  "id" UUID PRIMARY KEY, "promotionId" UUID NOT NULL, "revision" INTEGER NOT NULL,
  "terms" JSONB NOT NULL, "evidence" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PromotionRevision_promotionId_revision_key" ON "PromotionRevision"("promotionId","revision");
CREATE TABLE "PromotionDecision" (
  "id" UUID PRIMARY KEY, "promotionId" UUID NOT NULL, "revision" INTEGER NOT NULL,
  "actorId" UUID NOT NULL, "action" TEXT NOT NULL, "reason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PromotionDecision_promotionId_createdAt_idx" ON "PromotionDecision"("promotionId","createdAt");
ALTER TABLE "SupplierOrderItem" ALTER COLUMN "cartItemId" DROP NOT NULL;
ALTER TABLE "SupplierOrderItem" ADD COLUMN "giftForItemId" UUID;
ALTER TABLE "SupplierOrderItem" ADD CONSTRAINT "SupplierOrderItem_gift_check" CHECK (
  ("giftForItemId" IS NULL AND "cartItemId" IS NOT NULL) OR
  ("giftForItemId" IS NOT NULL AND "cartItemId" IS NULL AND "unitPriceMinor" = 0 AND "totalPriceMinor" = 0)
);

-- Every price writer (manual, import, integration) participates in the same
-- offer lock as moderation. A concurrent approval cannot race a price change.
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_giftOfferId_fkey" FOREIGN KEY ("giftOfferId") REFERENCES "SupplierOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION guard_active_promotion_price() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM id FROM "SupplierOffer" WHERE id = NEW."offerId" FOR UPDATE;
  IF EXISTS (SELECT 1 FROM "Promotion" p WHERE p."offerId" = NEW."offerId"
    AND p."moderationStatus" = 'APPROVED' AND p."approvedRevision" = p."termsRevision"
    AND p.status IN ('ACTIVE','PAUSED') AND p."startsAt" <= CURRENT_TIMESTAMP AND p."endsAt" > CURRENT_TIMESTAMP
    AND (p."quantityLimit" IS NULL OR p."claimedQuantity" < p."quantityLimit")
    AND (p."baseAmountMinor" <> NEW."amountMinor" OR p.currency <> NEW.currency)) THEN
    RAISE EXCEPTION 'PROMOTION_PRICE_LOCKED' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "OfferPrice_active_promotion_guard" BEFORE INSERT OR UPDATE OF "amountMinor",currency
  ON "OfferPrice" FOR EACH ROW EXECUTE FUNCTION guard_active_promotion_price();

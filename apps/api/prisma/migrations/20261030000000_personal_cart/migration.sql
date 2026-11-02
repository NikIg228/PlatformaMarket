-- Expand-only: organizational carts and checkout/payment relations are untouched.
CREATE TABLE "PersonalCart" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PersonalCart_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PersonalCartItem" (
    "id" UUID NOT NULL,
    "cartId" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL CHECK ("quantity" > 0 AND "quantity" <= 1000000),
    "pricingSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PersonalCartItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PersonalCart_ownerUserId_key" ON "PersonalCart"("ownerUserId");
CREATE UNIQUE INDEX "PersonalCartItem_cartId_offerId_key" ON "PersonalCartItem"("cartId", "offerId");
CREATE INDEX "PersonalCartItem_offerId_idx" ON "PersonalCartItem"("offerId");
ALTER TABLE "PersonalCart" ADD CONSTRAINT "PersonalCart_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PersonalCartItem" ADD CONSTRAINT "PersonalCartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "PersonalCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonalCartItem" ADD CONSTRAINT "PersonalCartItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SupplierOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

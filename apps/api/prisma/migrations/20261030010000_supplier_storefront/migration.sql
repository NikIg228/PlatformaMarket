-- Additive public company copy. Existing suppliers retain their offers and admission.
ALTER TABLE "SupplierProfile"
  ADD COLUMN "storefrontContent" JSONB,
  ADD COLUMN "storefrontVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "storefrontLogoAssetId" UUID;

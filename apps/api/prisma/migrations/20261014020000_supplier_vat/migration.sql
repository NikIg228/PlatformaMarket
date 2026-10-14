-- Additive only: legacy prices keep their original amounts and unclassified tax metadata.
CREATE TABLE "SupplierVatSettings" (
    "supplierOrganizationId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "defaultTax" JSONB,
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierVatSettings_pkey" PRIMARY KEY ("supplierOrganizationId"),
    CONSTRAINT "SupplierVatSettings_version_check" CHECK ("version" > 0),
    CONSTRAINT "SupplierVatSettings_supplierOrganizationId_fkey" FOREIGN KEY ("supplierOrganizationId") REFERENCES "SupplierProfile"("organizationId") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "OfferPrice" ADD COLUMN "taxSnapshot" JSONB;
ALTER TABLE "OfferPriceHistory" ADD COLUMN "taxSnapshot" JSONB;

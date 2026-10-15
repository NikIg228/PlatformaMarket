CREATE TABLE "InvoiceNumberCounter" (
    "year" INTEGER NOT NULL,
    "value" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "InvoiceNumberCounter_pkey" PRIMARY KEY ("year"),
    CONSTRAINT "InvoiceNumberCounter_value_check" CHECK ("value" >= 0)
);

CREATE TABLE "OrderInvoicePreparation" (
    "documentId" UUID NOT NULL,
    "supplierOrderId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" UUID,
    "confirmedByName" TEXT,
    CONSTRAINT "OrderInvoicePreparation_pkey" PRIMARY KEY ("documentId"),
    CONSTRAINT "OrderInvoicePreparation_version_check" CHECK ("version" > 0),
    CONSTRAINT "OrderInvoicePreparation_confirmation_check" CHECK (
      ("confirmedAt" IS NULL AND "confirmedById" IS NULL AND "confirmedByName" IS NULL)
      OR ("confirmedAt" IS NOT NULL AND "confirmedById" IS NOT NULL AND "confirmedByName" IS NOT NULL)
    )
);
CREATE UNIQUE INDEX "OrderInvoicePreparation_supplierOrderId_idempotencyKey_key" ON "OrderInvoicePreparation"("supplierOrderId", "idempotencyKey");
CREATE UNIQUE INDEX "OrderInvoicePreparation_number_version_key" ON "OrderInvoicePreparation"("number", "version");
CREATE INDEX "OrderInvoicePreparation_supplierOrderId_confirmedAt_idx" ON "OrderInvoicePreparation"("supplierOrderId", "confirmedAt");
ALTER TABLE "OrderInvoicePreparation" ADD CONSTRAINT "OrderInvoicePreparation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderInvoicePreparation" ADD CONSTRAINT "OrderInvoicePreparation_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION protect_order_invoice_preparation() RETURNS trigger AS $$
BEGIN
  IF NEW."documentId" IS DISTINCT FROM OLD."documentId"
    OR NEW."supplierOrderId" IS DISTINCT FROM OLD."supplierOrderId"
    OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
    OR NEW."requestHash" IS DISTINCT FROM OLD."requestHash"
    OR NEW."actorId" IS DISTINCT FROM OLD."actorId"
    OR NEW."number" IS DISTINCT FROM OLD."number"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR (OLD."confirmedAt" IS NOT NULL AND (
      NEW."confirmedAt" IS DISTINCT FROM OLD."confirmedAt"
      OR NEW."confirmedById" IS DISTINCT FROM OLD."confirmedById"
      OR NEW."confirmedByName" IS DISTINCT FROM OLD."confirmedByName")) THEN
    RAISE EXCEPTION 'Invoice reservation and confirmation cannot be rewritten';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "OrderInvoicePreparation_immutable" BEFORE UPDATE ON "OrderInvoicePreparation"
FOR EACH ROW EXECUTE FUNCTION protect_order_invoice_preparation();

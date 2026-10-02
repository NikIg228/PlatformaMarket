ALTER TABLE "Organization" ADD COLUMN "commerceDataset" TEXT NOT NULL DEFAULT 'UNCLASSIFIED';
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_commerceDataset_check" CHECK ("commerceDataset" IN ('BUSINESS', 'DEMO', 'TEST', 'UNCLASSIFIED'));
ALTER TABLE "SupplierOrder" ADD COLUMN "commerceDataset" TEXT NOT NULL DEFAULT 'UNCLASSIFIED';
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_commerceDataset_check" CHECK ("commerceDataset" IN ('BUSINESS', 'DEMO', 'TEST', 'UNCLASSIFIED'));
ALTER TABLE "SupplierOrderItem" ADD COLUMN "decisionReasonCode" TEXT;
ALTER TABLE "SupplierOrderItem" ADD CONSTRAINT "SupplierOrderItem_decisionReasonCode_check" CHECK ("decisionReasonCode" IN ('PRICE', 'STOCK', 'OTHER'));
CREATE TABLE "CommerceMetricEvent" (
  "id" UUID NOT NULL, "sourceKey" TEXT NOT NULL, "supplierOrderId" UUID NOT NULL,
  "kind" TEXT NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "goodsAmountMinor" DECIMAL(20,0) NOT NULL, "commissionAmountMinor" DECIMAL(20,0) NOT NULL,
  "commissionRuleVersion" TEXT NOT NULL DEFAULT 'GOODS_RECEIPT_V1',
  CONSTRAINT "CommerceMetricEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommerceMetricEvent_order_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommerceMetricEvent_kind_check" CHECK ("kind" IN ('CREATED','CONFIRMED','RECEIVED','RETURNED','FULFILLED','CANCELLED','REFUSED_PRICE','REFUSED_STOCK','REFUSED_OTHER'))
);
CREATE UNIQUE INDEX "CommerceMetricEvent_sourceKey_key" ON "CommerceMetricEvent"("sourceKey");
CREATE INDEX "CommerceMetricEvent_supplierOrderId_occurredAt_idx" ON "CommerceMetricEvent"("supplierOrderId", "occurredAt");
CREATE INDEX "CommerceMetricEvent_kind_occurredAt_idx" ON "CommerceMetricEvent"("kind", "occurredAt");

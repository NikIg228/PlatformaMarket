CREATE TABLE "OrderManualReturn" (
  "id" UUID NOT NULL,
  "supplierOrderId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "reason" TEXT NOT NULL,
  "decisionReason" TEXT,
  "amountMinor" DECIMAL(20,0) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "itemsSnapshot" JSONB NOT NULL,
  "requestedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "goodsSentAt" TIMESTAMP(3),
  "goodsReceivedAt" TIMESTAMP(3),
  "refundDocumentId" UUID,
  "refundSentAt" TIMESTAMP(3),
  "refundReceivedAt" TIMESTAMP(3),
  CONSTRAINT "OrderManualReturn_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderManualReturn_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OrderManualReturn_kind_check" CHECK ("kind" IN ('CANCELLATION','GOODS','OVERPAYMENT')),
  CONSTRAINT "OrderManualReturn_status_check" CHECK ("status" IN ('REQUESTED','REJECTED','AGREED','GOODS_SENT','GOODS_RECEIVED','REFUND_SENT','REFUND_RECEIVED')),
  CONSTRAINT "OrderManualReturn_amount_check" CHECK ("amountMinor" > 0)
);
CREATE INDEX "OrderManualReturn_supplierOrderId_createdAt_idx" ON "OrderManualReturn"("supplierOrderId", "createdAt");
CREATE UNIQUE INDEX "OrderManualReturn_refundDocumentId_key" ON "OrderManualReturn"("refundDocumentId");
CREATE UNIQUE INDEX "OrderManualReturn_one_open" ON "OrderManualReturn"("supplierOrderId") WHERE "status" NOT IN ('REJECTED','REFUND_RECEIVED');

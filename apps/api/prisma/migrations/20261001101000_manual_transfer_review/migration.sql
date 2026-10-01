ALTER TABLE "SupplierProfile"
  ADD COLUMN "paymentReviewPolicy" JSONB,
  ADD COLUMN "paymentReviewVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "OrderTransferClaim"
  ADD COLUMN "receivedAmountMinor" DECIMAL(20,0),
  ADD COLUMN "reportedById" UUID,
  ADD COLUMN "checkedAt" TIMESTAMP(3),
  ADD COLUMN "nextCheckAt" TIMESTAMP(3),
  ADD COLUMN "reviewStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "reviewPolicySnapshot" JSONB,
  ADD COLUMN "remindedAt" TIMESTAMP(3),
  ADD COLUMN "backupNotifiedAt" TIMESTAMP(3),
  ADD COLUMN "supportTicketId" UUID;

UPDATE "OrderTransferClaim" SET "receivedAmountMinor" = "amountMinor"
WHERE "status" = 'CONFIRMED';

ALTER TABLE "OrderTransferClaim" ADD CONSTRAINT "OrderTransferClaim_received_positive"
  CHECK ("receivedAmountMinor" IS NULL OR "receivedAmountMinor" > 0);
CREATE INDEX "OrderTransferClaim_status_reviewStartedAt_idx" ON "OrderTransferClaim"("status", "reviewStartedAt");

CREATE TABLE "OrderPaymentReduction" (
  "id" UUID NOT NULL,
  "supplierOrderId" UUID NOT NULL,
  "proposedByOrganizationId" UUID NOT NULL,
  "proposedById" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL,
  "previousAmountMinor" DECIMAL(20,0) NOT NULL,
  "proposedAmountMinor" DECIMAL(20,0) NOT NULL,
  "itemsSnapshot" JSONB NOT NULL,
  "decidedAt" TIMESTAMP(3),
  "decidedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderPaymentReduction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderPaymentReduction_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OrderPaymentReduction_amounts" CHECK ("proposedAmountMinor" > 0 AND "proposedAmountMinor" < "previousAmountMinor")
);
CREATE INDEX "OrderPaymentReduction_supplierOrderId_status_createdAt_idx" ON "OrderPaymentReduction"("supplierOrderId", "status", "createdAt");
CREATE UNIQUE INDEX "OrderPaymentReduction_one_pending" ON "OrderPaymentReduction"("supplierOrderId") WHERE "status" = 'PENDING';

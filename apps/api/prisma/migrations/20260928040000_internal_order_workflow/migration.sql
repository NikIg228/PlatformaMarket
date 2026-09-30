-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE 'PAYMENT_PROOF';

-- AlterTable
ALTER TABLE "SupplierOrder" ADD COLUMN     "manualInvoiceDocumentId" UUID;

-- CreateTable
CREATE TABLE "OrderTransferClaim" (
    "id" UUID NOT NULL,
    "supplierOrderId" UUID NOT NULL,
    "invoiceDocumentId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "amountMinor" DECIMAL(20,0) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "comment" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderTransferClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderWorkflowEvent" (
    "id" UUID NOT NULL,
    "supplierOrderId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderWorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderTransferClaim_supplierOrderId_createdAt_idx" ON "OrderTransferClaim"("supplierOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderWorkflowEvent_supplierOrderId_createdAt_idx" ON "OrderWorkflowEvent"("supplierOrderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderWorkflowEvent_supplierOrderId_organizationId_idempoten_key" ON "OrderWorkflowEvent"("supplierOrderId", "organizationId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "OrderTransferClaim" ADD CONSTRAINT "OrderTransferClaim_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderWorkflowEvent" ADD CONSTRAINT "OrderWorkflowEvent_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing owner roles retain financial control; custom staff roles opt in explicitly.
INSERT INTO "Permission" ("id", "code", "description") VALUES ('80c77de0-3a83-4e30-82f8-a186aa449ec3', 'payment.transfer.confirm', 'Confirm actual receipt of a bank transfer') ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId") SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."code" = 'supplier_owner' AND p."code" = 'payment.transfer.confirm' ON CONFLICT DO NOTHING;
ALTER TABLE "OrderTransferClaim" ADD CONSTRAINT "OrderTransferClaim_status_check" CHECK ("status" IN ('PENDING','NEEDS_INFORMATION','CONFIRMED'));
ALTER TABLE "OrderTransferClaim" ADD CONSTRAINT "OrderTransferClaim_positive_amount" CHECK ("amountMinor" > 0);

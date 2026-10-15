-- CreateTable
CREATE TABLE "OrderDiscrepancy" (
    "id" UUID NOT NULL,
    "supplierOrderId" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "previousDiscrepancyId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "statement" JSONB NOT NULL,
    "source" JSONB NOT NULL,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderDiscrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDiscrepancyEvent" (
    "id" UUID NOT NULL,
    "discrepancyId" UUID NOT NULL,
    "supplierOrderId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderDiscrepancyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderDiscrepancy_supplierOrderId_createdAt_idx" ON "OrderDiscrepancy"("supplierOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderDiscrepancy_shipmentId_status_idx" ON "OrderDiscrepancy"("shipmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDiscrepancyEvent_supplierOrderId_organizationId_idempo_key" ON "OrderDiscrepancyEvent"("supplierOrderId", "organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDiscrepancyEvent_discrepancyId_version_key" ON "OrderDiscrepancyEvent"("discrepancyId", "version");

-- AddForeignKey
ALTER TABLE "OrderDiscrepancy" ADD CONSTRAINT "OrderDiscrepancy_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDiscrepancy" ADD CONSTRAINT "OrderDiscrepancy_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDiscrepancy" ADD CONSTRAINT "OrderDiscrepancy_previousDiscrepancyId_fkey" FOREIGN KEY ("previousDiscrepancyId") REFERENCES "OrderDiscrepancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDiscrepancyEvent" ADD CONSTRAINT "OrderDiscrepancyEvent_discrepancyId_fkey" FOREIGN KEY ("discrepancyId") REFERENCES "OrderDiscrepancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

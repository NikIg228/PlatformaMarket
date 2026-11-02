ALTER TABLE "SupplierOrder"
  ADD COLUMN "responseReceivedAt" TIMESTAMP(3),
  ADD COLUMN "responseRemindedAt" TIMESTAMP(3),
  ADD COLUMN "responseOverdueAt" TIMESTAMP(3),
  ADD COLUMN "responseEscalatedAt" TIMESTAMP(3),
  ADD COLUMN "responseSupportTicketId" UUID;

CREATE UNIQUE INDEX "SupplierOrder_responseSupportTicketId_key" ON "SupplierOrder"("responseSupportTicketId");
CREATE INDEX "SupplierOrder_pending_response_idx" ON "SupplierOrder"("id")
  WHERE "status" = 'AWAITING_CONFIRMATION' AND "responseStartedAt" IS NOT NULL
    AND "responseReceivedAt" IS NULL AND "responseEscalatedAt" IS NULL;
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_responseSupportTicketId_fkey"
  FOREIGN KEY ("responseSupportTicketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_response_escalation_complete"
  CHECK (("responseEscalatedAt" IS NULL) = ("responseSupportTicketId" IS NULL));

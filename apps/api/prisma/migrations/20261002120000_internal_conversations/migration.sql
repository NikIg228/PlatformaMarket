-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "requestHash" TEXT;

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "BusinessConversation" (
    "id" UUID NOT NULL,
    "contextType" TEXT NOT NULL,
    "contextId" UUID NOT NULL,
    "offerId" UUID,
    "orderId" UUID,
    "buyerOrganizationId" UUID NOT NULL,
    "supplierOrganizationId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "latestSequence" INTEGER NOT NULL DEFAULT 0,
    "supportTicketId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "authorId" UUID NOT NULL,
    "authorOrganizationId" UUID NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationRead" (
    "conversationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "throughSequence" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationRead_pkey" PRIMARY KEY ("conversationId","userId","organizationId")
);

-- CreateTable
CREATE TABLE "OperationAssignment" (
    "id" UUID NOT NULL,
    "operatorOrganizationId" UUID NOT NULL,
    "queueType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "assigneeId" UUID,
    "priority" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessConversation_orderId_key" ON "BusinessConversation"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessConversation_supportTicketId_key" ON "BusinessConversation"("supportTicketId");

-- CreateIndex
CREATE INDEX "BusinessConversation_buyerOrganizationId_updatedAt_idx" ON "BusinessConversation"("buyerOrganizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "BusinessConversation_supplierOrganizationId_updatedAt_idx" ON "BusinessConversation"("supplierOrganizationId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessConversation_contextType_contextId_buyerOrganizatio_key" ON "BusinessConversation"("contextType", "contextId", "buyerOrganizationId", "supplierOrganizationId");

-- CreateIndex
CREATE INDEX "ConversationMessage_conversationId_authorOrganizationId_seq_idx" ON "ConversationMessage"("conversationId", "authorOrganizationId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMessage_conversationId_sequence_key" ON "ConversationMessage"("conversationId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMessage_conversationId_authorId_idempotencyKey_key" ON "ConversationMessage"("conversationId", "authorId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ConversationRead_conversationId_organizationId_throughSeque_idx" ON "ConversationRead"("conversationId", "organizationId", "throughSequence");

-- CreateIndex
CREATE INDEX "OperationAssignment_operatorOrganizationId_assigneeId_dueAt_idx" ON "OperationAssignment"("operatorOrganizationId", "assigneeId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "OperationAssignment_operatorOrganizationId_queueType_entity_key" ON "OperationAssignment"("operatorOrganizationId", "queueType", "entityId");

-- AddForeignKey
ALTER TABLE "BusinessConversation" ADD CONSTRAINT "BusinessConversation_supportTicketId_fkey" FOREIGN KEY ("supportTicketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessConversation" ADD CONSTRAINT "BusinessConversation_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SupplierOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessConversation" ADD CONSTRAINT "BusinessConversation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SupplierOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessConversation" ADD CONSTRAINT "BusinessConversation_buyerOrganizationId_fkey" FOREIGN KEY ("buyerOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessConversation" ADD CONSTRAINT "BusinessConversation_supplierOrganizationId_fkey" FOREIGN KEY ("supplierOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "BusinessConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_authorOrganizationId_fkey" FOREIGN KEY ("authorOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "BusinessConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationAssignment" ADD CONSTRAINT "OperationAssignment_operatorOrganizationId_fkey" FOREIGN KEY ("operatorOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationAssignment" ADD CONSTRAINT "OperationAssignment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve context, sequence and workflow invariants for all writers.
ALTER TABLE "BusinessConversation" ADD CONSTRAINT "BusinessConversation_context_check" CHECK (
  ("contextType" = 'OFFER' AND "offerId" IS NOT NULL AND "contextId" = "offerId" AND "orderId" IS NULL)
  OR ("contextType" = 'ORDER' AND "orderId" IS NOT NULL AND "contextId" = "orderId" AND "offerId" IS NULL)
);
ALTER TABLE "BusinessConversation" ADD CONSTRAINT "BusinessConversation_parties_check" CHECK ("buyerOrganizationId" <> "supplierOrganizationId");
ALTER TABLE "BusinessConversation" ADD CONSTRAINT "BusinessConversation_version_check" CHECK ("version" > 0 AND "latestSequence" >= 0);
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_sequence_check" CHECK ("sequence" > 0 AND "authorRole" IN ('BUYER', 'SUPPLIER', 'OPERATOR'));
ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_sequence_check" CHECK ("throughSequence" >= 0);
ALTER TABLE "OperationAssignment" ADD CONSTRAINT "OperationAssignment_workflow_check" CHECK ("version" > 0 AND "priority" IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL') AND "queueType" IN ('CATALOG_REVIEW', 'COMPLIANCE_REVIEW', 'INTEGRATION_RECONCILIATION', 'IMPORT_ATTENTION', 'AGREEMENT_SIGNATURE', 'SUPPLIER_CONFIRMATION', 'STALE_INVENTORY'));
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_version_check" CHECK ("version" > 0);

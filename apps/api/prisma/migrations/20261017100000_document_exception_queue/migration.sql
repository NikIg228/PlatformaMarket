-- Extend the assignment domain without changing existing assignments or party workflows.
ALTER TABLE "OperationAssignment" DROP CONSTRAINT "OperationAssignment_workflow_check";
ALTER TABLE "OperationAssignment" ADD CONSTRAINT "OperationAssignment_workflow_check" CHECK (
  "version" > 0 AND "priority" IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')
  AND "queueType" IN ('ORGANIZATION_REVIEW', 'PROMOTION_REVIEW', 'CATALOG_REVIEW', 'COMPLIANCE_REVIEW', 'INTEGRATION_RECONCILIATION', 'IMPORT_ATTENTION', 'AGREEMENT_SIGNATURE', 'SUPPLIER_CONFIRMATION', 'STALE_INVENTORY', 'DOCUMENT_EXCEPTION')
);

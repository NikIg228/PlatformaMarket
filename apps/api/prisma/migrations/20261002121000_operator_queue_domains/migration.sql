-- Add the supplier-admission and promotion-moderation queue domains.
-- The prior migration has already been validated on the disposable database.
ALTER TABLE "OperationAssignment" DROP CONSTRAINT "OperationAssignment_workflow_check";
ALTER TABLE "OperationAssignment" ADD CONSTRAINT "OperationAssignment_workflow_check" CHECK (
  "version" > 0 AND "priority" IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')
  AND "queueType" IN ('ORGANIZATION_REVIEW', 'PROMOTION_REVIEW', 'CATALOG_REVIEW', 'COMPLIANCE_REVIEW', 'INTEGRATION_RECONCILIATION', 'IMPORT_ATTENTION', 'AGREEMENT_SIGNATURE', 'SUPPLIER_CONFIRMATION', 'STALE_INVENTORY')
);

-- Existing system supplier owners can read their organization's internal events.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id FROM "Role" r
JOIN "OrganizationCapability" c ON c."organizationId" = r."organizationId" AND c.capability = 'SUPPLIER'
CROSS JOIN "Permission" p
WHERE r.code = 'supplier_owner' AND r."isSystem" = true AND p.code = 'notification.view'
ON CONFLICT DO NOTHING;

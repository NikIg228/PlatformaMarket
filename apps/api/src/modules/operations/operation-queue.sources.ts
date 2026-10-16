import { Prisma } from "@prisma/client";

/** Each arm emits one row per source PK. Joining a shared order does not merge reasons. */
export function operationQueueSources(promotionsEnabled: boolean): Prisma.Sql {
  const sources = [
    Prisma.sql`SELECT 'ORGANIZATION_REVIEW'::text, a.id, o."displayName", a."organizationId", NULL::uuid,
      a."acceptedAt", COALESCE(a."reviewedAt", a."acceptedAt"), 'HIGH'::text,
      'Поставщик ожидает проверки допуска'::text, 'organizations'::text, ''::text
      FROM "SupplierTermsAcceptance" a JOIN "Organization" o ON o.id = a."organizationId"
      WHERE a."admissionStatus" = 'PENDING'`,
    Prisma.sql`SELECT 'CATALOG_REVIEW', id, "proposedName", "supplierOrganizationId", NULL::uuid,
      "createdAt", "updatedAt", 'HIGH', 'Карточка ожидает модерации', 'catalog', concat_ws(' ', "proposedSku", "proposedGtin")
      FROM "ProductCandidate" WHERE status = 'PENDING'`,
    Prisma.sql`SELECT 'COMPLIANCE_REVIEW', id, 'Проверка допуска', "sellerOrganizationId", "buyerOrganizationId",
      "evaluatedAt", "updatedAt", 'CRITICAL', 'Нужна ручная проверка документов и допуска', 'organizations', ''
      FROM "ComplianceCheck" WHERE status = 'REVIEW_REQUIRED'`,
    Prisma.sql`SELECT 'INTEGRATION_RECONCILIATION', e.id, COALESCE(NULLIF(e."externalRef", ''), c."displayName"), c."supplierOrganizationId", NULL::uuid,
      e."detectedAt", e."updatedAt", 'HIGH', 'Обнаружено расхождение учётных данных', 'imports', concat_ws(' ', e."externalRef", c."displayName")
      FROM "IntegrationReconciliationEntry" e JOIN "IntegrationConnection" c ON c.id = e."connectionId"
      WHERE e.status IN ('MISMATCH', 'MISSING_EXTERNAL', 'MISSING_INTERNAL')`,
    Prisma.sql`SELECT 'IMPORT_ATTENTION', id, "fileName", "supplierOrganizationId", NULL::uuid,
      "createdAt", "updatedAt", 'NORMAL', 'Загрузка требует обработки или проверки ошибок', 'imports', ''
      FROM "ImportBatch" WHERE status IN ('UPLOADED', 'MAPPED', 'REVIEW_REQUIRED', 'PROCESSING', 'COMPLETED_WITH_ERRORS', 'FAILED')`,
    Prisma.sql`SELECT 'AGREEMENT_SIGNATURE', id, "agreementNumber", "supplierOrganizationId", NULL::uuid,
      "createdAt", "updatedAt", 'HIGH', 'Договор ожидает подписи', 'organizations', ''
      FROM "MarketplaceAgreement" WHERE status = 'AWAITING_SIGNATURE'`,
    Prisma.sql`SELECT 'SUPPLIER_CONFIRMATION', id, "orderNumber", "supplierOrganizationId", "buyerOrganizationId",
      "createdAt", "updatedAt", 'HIGH', 'Заказ ожидает подтверждения поставщика', 'orders', ''
      FROM "SupplierOrder" WHERE status = 'AWAITING_CONFIRMATION'`,
    Prisma.sql`SELECT 'STALE_INVENTORY', b.id, concat_ws(' · ', COALESCE(o."supplierSku", 'Остаток'), w.name), b."supplierOrganizationId", NULL::uuid,
      b."createdAt", b."updatedAt", 'HIGH', 'Остаток требует подтверждения актуальности', 'catalog', COALESCE(o."supplierSku", '')
      FROM "InventoryBalance" b JOIN "Warehouse" w ON w.id = b."warehouseId" LEFT JOIN "SupplierOffer" o ON o.id = b."offerId"
      WHERE b."freshnessStatus" IN ('STALE', 'UNKNOWN') AND b."quantityAvailable" > 0`,
  ];
  if (promotionsEnabled) sources.push(Prisma.sql`SELECT 'PROMOTION_REVIEW', id, name, "supplierOrganizationId", NULL::uuid,
    "createdAt", "updatedAt", 'NORMAL', 'Условия акции ожидают модерации', 'catalog', ''
    FROM "Promotion" WHERE "moderationStatus" = 'PENDING' AND "offerId" IS NOT NULL`);
  return Prisma.join(sources, " UNION ALL ");
}

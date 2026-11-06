"use client";

import { LoadingState } from "@marketplace/ui/primitives";
import dynamic from "next/dynamic";

const loading = (subject: string) => function SectionLoading() { return <LoadingState label={`Загружаем ${subject}…`} />; };
export const OperatorOrders = dynamic(() => import("./operator-orders").then(module => module.OperatorOrders), { loading: loading("заказы") });
export const OperatorOrganizationAdmission = dynamic(() => import("./operator-organization-admission").then(module => module.OperatorOrganizationAdmission), { loading: loading("допуск организаций") });
export const SigningAdmissions = dynamic(() => import("./signing-admissions").then(module => module.SigningAdmissions), { loading: loading("заявки на допуск") });
export const OperatorOrganizations = dynamic(() => import("./operator-organizations").then(module => module.OperatorOrganizations), { loading: loading("организации") });
export const IdentitySettings = dynamic(() => import("./identity-settings").then(module => module.IdentitySettings), { loading: loading("настройки доступа") });
export const OperatorCommerceAnalytics = dynamic(() => import("./commerce-analytics").then(module => module.OperatorCommerceAnalytics), { loading: loading("аналитику") });
export const SupportOperations = dynamic(() => import("./support-operations").then(module => module.SupportOperations), { loading: loading("обращения") });
export const OperationObjectFocus = dynamic(() => import("./operation-object-focus").then(module => module.OperationObjectFocus), { loading: loading("данные объекта") });

export const ManualProductReview = dynamic(() => import("./manual-product-review").then(module => module.ManualProductReview), { loading: loading("заявки на товары") });

export const AgreementOperations = dynamic(
  () =>
    import("./agreement-operations").then(
      (module) => module.AgreementOperations,
    ),
  { loading: loading("договоры") },
);
export const AuditOperations = dynamic(
  () => import("./operator-control").then((module) => module.OperatorControl),
  { loading: loading("контроль операций") },
);
export const CatalogFoundation = dynamic(
  () =>
    import("./catalog-foundation").then((module) => module.CatalogFoundation),
  { loading: loading("каталог") },
);
export const CatalogImportReviewQueue = dynamic(
  () =>
    import("./catalog-import-review").then(
      (module) => module.CatalogImportReviewQueue,
    ),
  { loading: loading("очередь импорта") },
);
export const CatalogQuality = dynamic(
  () => import("./catalog-quality").then((module) => module.CatalogQuality),
  { loading: loading("качество каталога") },
);
export const ConnectorReadinessRegistry = dynamic(
  () =>
    import("./connector-readiness-registry").then(
      (module) => module.ConnectorReadinessRegistry,
    ),
  { loading: loading("реестр подключений") },
);
export const FoundationManagement = dynamic(
  () =>
    import("./foundation-management").then(
      (module) => module.FoundationManagement,
    ),
  { loading: loading("настройки управления") },
);
export const IntegrationOperations = dynamic(
  () =>
    import("./integration-operations").then(
      (module) => module.IntegrationOperations,
    ),
  { loading: loading("подключения") },
);
export const OrganizationQuickCreate = dynamic(
  () =>
    import("./organization-quick-create").then(
      (module) => module.OrganizationQuickCreate,
    ),
  { loading: loading("форму организации") },
);
export const PlatformAssurance = dynamic(
  () =>
    import("./platform-assurance").then((module) => module.PlatformAssurance),
  { loading: loading("показатели платформы") },
);
export const PlatformSettings = dynamic(
  () =>
    import("./platform-settings").then((module) => module.PlatformSettings),
  { loading: loading("настройки платформы") },
);
export const ProductCorrectionQueue = dynamic(
  () =>
    import("./product-correction-queue").then(
      (module) => module.ProductCorrectionQueue,
    ),
  { loading: loading("правки товаров") },
);
export const ResourceLists = dynamic(
  () => import("./resource-lists").then((module) => module.ResourceLists),
  { loading: loading("справочники") },
);
export const SupplierControls = dynamic(
  () => import("./supplier-controls").then((module) => module.SupplierControls),
  { loading: loading("контроль поставщика") },
);
export const SupplierOperations = dynamic(
  () =>
    import("./supplier-operations").then((module) => module.SupplierOperations),
  { loading: loading("данные поставщика") },
);
export const TrustOperations = dynamic(
  () => import("./trust-operations").then((module) => module.TrustOperations),
  { loading: loading("инциденты и репутацию") },
);
export const PromotionModeration = dynamic(() => import("./promotion-moderation").then(module => module.PromotionModeration), { loading: loading("акции") });

export const LiveMetrics = dynamic(
  () => import("./live-metrics").then(module => module.LiveMetrics), { loading: loading("показатели") },
);
export const OperationQueue = dynamic(
  () => import("./operation-queue").then(module => module.OperationQueue), { loading: loading("очередь операций") },
);

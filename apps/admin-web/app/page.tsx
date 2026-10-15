"use client";
import { DmAction } from "@marketplace/ui/actions";




import { BuildingShop24Regular } from "@fluentui/react-icons/svg/building-shop";
import { Cart24Regular } from "@fluentui/react-icons/svg/cart";
import { Cube24Regular } from "@fluentui/react-icons/svg/cube";
import { Database24Regular } from "@fluentui/react-icons/svg/database";
import { DocumentTable24Regular } from "@fluentui/react-icons/svg/document-table";
import { PeopleTeam24Regular } from "@fluentui/react-icons/svg/people-team";
import { Settings24Regular } from "@fluentui/react-icons/svg/settings";
import { ShieldLock24Regular } from "@fluentui/react-icons/svg/shield-lock";
import { DmButton } from "@marketplace/ui/actions";
import { ActionFeedback } from "@marketplace/ui/action-feedback";
import { AdminShell } from "./admin-shell";
import { frontendFeatures } from "@marketplace/api-client";
import { type ReactNode } from "react";
import { adminSectionQuery, type AdminSection } from "@marketplace/schemas/product-navigation";
import { useAdminQuery } from "./use-admin-query";
import styles from "./page.module.css";
import {
  IdentitySettings,
  AgreementOperations,
  AuditOperations,
  CatalogFoundation,
  ManualProductReview,
  PromotionModeration,
  CatalogImportReviewQueue,
  CatalogQuality,
  ConnectorReadinessRegistry,
  FoundationManagement,
  IntegrationOperations,
  OrganizationQuickCreate,
  PlatformAssurance,
  PlatformSettings,
  ProductCorrectionQueue,
  OperatorOrganizations,
  SupplierControls,
  SupplierOperations,
  SupportOperations,
  OperatorCommerceAnalytics,
  OperationObjectFocus,
  TrustOperations,
} from "./admin-section-components";
import { LiveMetrics } from "./live-metrics";
import { OperationQueue } from "./operation-queue";

import { useAdminAccess } from "./use-admin-access";
import { OperatorNotifications } from "./operator-notifications";

type SectionId = AdminSection;

const navigation: Array<{ id: SectionId; label: string; icon: ReactNode }> = [
  { id: "analytics", label: "Аналитика", icon: <DocumentTable24Regular /> },
  { id: "overview", label: "Обзор", icon: <DocumentTable24Regular /> },
  { id: "organizations", label: "Организации", icon: <BuildingShop24Regular /> },
  { id: "access", label: "Пользователи и права", icon: <PeopleTeam24Regular /> },
  { id: "catalog", label: "Каталог", icon: <Cube24Regular /> },
  { id: "imports", label: "Загрузка товаров", icon: <Database24Regular /> },
  { id: "orders", label: "Заказы и договоры", icon: <Cart24Regular /> },
  { id: "support", label: "Обращения и споры", icon: <PeopleTeam24Regular /> },
  { id: "security", label: frontendFeatures.trust ? "Контроль и доверие" : "Контроль и аудит", icon: <ShieldLock24Regular /> },
  { id: "settings", label: "Настройки", icon: <Settings24Regular /> },
];

const sectionMeta: Record<SectionId, { title: string; description: string }> = {
  analytics: { title: "Аналитика заказов и комиссии", description: "Оборот, исполнение и расчёт комиссии по организациям." },
  support: { title: "Обращения и споры", description: "Ответы участникам, сроки и история операторских решений." },
  overview: {
    title: "Обзор",
    description: "Главные показатели и задачи команды PlatformaMarket.",
  },
  organizations: {
    title: "Организации",
    description: "Клиники, поставщики и их реквизиты.",
  },
  access: {
    title: "Пользователи и права",
    description: "Кто и что может делать в кабинетах.",
  },
  catalog: {
    title: "Каталог",
    description: "Карточки, категории, цены и предложения продавцов.",
  },
  imports: {
    title: "Загрузка товаров",
    description: "Как поставщики передают товары, цены и остатки.",
  },
  orders: {
    title: "Заказы и договоры",
    description: "Исполнение заказов поставщиками, договоры и подписи ЭЦП.",
  },
  security: {
    title: frontendFeatures.trust ? "Контроль и доверие" : "Контроль и аудит",
    description: frontendFeatures.trust
      ? "Проверки поставщиков, рейтинг и ограничения."
      : "История действий оператора и изменений в системе.",
  },
  settings: {
    title: "Настройки PlatformaMarket",
    description: "Основные настройки и доступность разделов.",
  },
};

const modules: Array<{ id: SectionId; title: string; description: string; icon: ReactNode }> = [
  { id: "support", title: "Обращения", description: "Вопросы участников и переписка", icon: <PeopleTeam24Regular /> },
  { id: "orders", title: "Заказы", description: "Исполнение, договоры и исключения", icon: <Cart24Regular /> },
  { id: "organizations", title: "Организации", description: "Юридические профили и участники", icon: <BuildingShop24Regular /> },
  { id: "access", title: "Доступ", description: "Пользователи и права", icon: <ShieldLock24Regular /> },
  { id: "catalog", title: "Каталог", description: "Карточки и предложения", icon: <Cube24Regular /> },
  { id: "imports", title: "Загрузка товаров", description: "Файлы и учётные системы", icon: <Database24Regular /> },
];

export default function OperationsWorkspace() {
  const access = useAdminAccess();
  const { state, valid, write } = useAdminQuery();
  const active = state.section;
  const navigate = (id: SectionId) => write(adminSectionQuery(state, id));
  if (!access.ready) return <main className={styles.authLoading}>{access.error ? <ActionFeedback tone="error" description={access.error} action={<DmButton onClick={access.retry}>Повторить проверку</DmButton>} /> : "Проверяем вход…"}</main>;

  const meta = sectionMeta[active];

  const overview = (
    <>
      <section className={styles.statusPanel} aria-label="Состояние PlatformaMarket">
        <div>
          <div className={styles.statusTitle}>Рабочая очередь</div>
          <div className={styles.statusText}>Обращения участников, заказы и задачи площадки.</div>
        </div>
        <DmButton className={styles.buttonOutline} appearance="outline" onClick={() => navigate("orders")}>Открыть очередь</DmButton>
      </section>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Основные области</h2>
            <span className={styles.muted}>Быстрый переход</span>
          </div>
          <div className={styles.moduleGrid}>
            {modules.map((module) => (
              <DmAction variant="choice"  className={styles.module} key={module.id} type="button" onClick={() => navigate(module.id)}>
                <span className={styles.moduleTop}><strong>{module.title}</strong>{module.icon}</span>
                <span className={styles.moduleDescription}>{module.description}</span>
              </DmAction>
            ))}
          </div>
        </section>


      </div>

      <LiveMetrics />
      <OperationQueue />
    </>
  );

  const content: Record<SectionId, ReactNode> = {
    analytics: <OperatorCommerceAnalytics />,
    support: <SupportOperations />,
    overview,
    organizations: <OperatorOrganizations />,
    access: <><SupplierControls /><PlatformAssurance /></>,
    catalog: <><ManualProductReview />{frontendFeatures.promotions ? <PromotionModeration /> : null}<ProductCorrectionQueue /><CatalogQuality /><CatalogFoundation /><FoundationManagement catalogOnly /></>,
    imports: <><CatalogImportReviewQueue /><SupplierOperations /><IntegrationOperations /><ConnectorReadinessRegistry /></>,
    orders: <><OperationQueue /><AgreementOperations /></>,
    security: <>{frontendFeatures.trust && <TrustOperations />}<AuditOperations /></>,
    settings: <><PlatformSettings onNavigate={navigate} /><IdentitySettings /></>,
  };

  return (
    <AdminShell
      navigation={navigation}
      active={active}
      title={meta.title}
      onNavigate={(id) => navigate(id as SectionId)}
      actions={
        <>

          <OperatorNotifications onSupport={ticketId => write({ ...adminSectionQuery(state, "support"), ticketId, supportMode: "tickets" })} />
        </>
      }
    >
      <div className={styles.content}>
        <div className={styles.heading}>
          <p className={styles.description}>{meta.description}</p>
          {active === "organizations" ? <OrganizationQuickCreate /> : null}
        </div>
        <div className={styles.sectionStack}>{valid ? <><OperationObjectFocus />{content[active]}</> : <ActionFeedback tone="error" description="В ссылке указаны недопустимые параметры. Откройте раздел заново." action={<DmButton onClick={() => navigate("overview")}>Открыть обзор</DmButton>} />}</div>
      </div>
    </AdminShell>
  );
}

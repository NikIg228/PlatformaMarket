"use client";

import { type MarketplaceApiClient, workspacePath } from "@marketplace/api-client";
import { adminSectionQuery, serializeAdminQuery } from "@marketplace/schemas/product-navigation";
import { DmButton, DmSurface } from "@marketplace/ui/actions";
import { DmFeedback, ErrorState, LoadingState } from "@marketplace/ui/primitives";
import { useOperatorProjection } from "./use-operator-projection";
import { formatOperatorCount } from "./operator-projection-view-model";
import styles from "./live-metrics.module.css";
import { useAdminQuery } from "./use-admin-query";

const read = (api: MarketplaceApiClient, signal: AbortSignal) => api.operatorDashboard(signal);
const metrics = [
  ["organizations", "Зарегистрировано организаций", "Все статусы", "organizations", "Организации"],
  ["masterProducts", "Карточек товаров", "Все статусы мастер-каталога", "catalog", "Каталог"],
  ["effectivePermissions", "Мои разрешения", "Уникальные действующие разрешения", "settings", "Настройки доступа"],
] as const;

export function LiveMetrics() {
  const { data, loading, error, refresh } = useOperatorProjection(read);
  const { state: query } = useAdminQuery();
  const partial = data && metrics.some(([key]) => data[key].status === "UNAVAILABLE");
  return <section className={styles.section} aria-label="Показатели данных" aria-busy={loading}>
    <div className={styles.header}>
      <div><h2>Показатели платформы</h2></div>

    </div>
    {loading && !data ? <LoadingState label="Загружаем показатели" /> : null}
    {error ? data ? <DmFeedback presentation="inline" tone="danger" title="Показатели не обновлены" description={`${error} Показаны ранее загруженные значения.`} alert />
      : <ErrorState presentation="inline" title="Показатели недоступны" description={error} action={<DmButton onClick={() => void refresh()}>Повторить загрузку показателей</DmButton>} /> : null}
    {partial ? <DmFeedback tone="warning" title="Не все показатели удалось обновить" description="Недоступный источник отмечен отдельно. Повторите загрузку." /> : null}
    {data ? <div className={styles.metrics}>{metrics.map(([key, label, detail, section, link]) => <DmSurface key={key}>
      <dl className={styles.metric}><dt>{label}</dt><dd>{formatOperatorCount(data[key])}</dd></dl>
      <p className={styles.caption}>{detail}</p>
      {data[key].status === "UNAVAILABLE" ? <p className={styles.caption}>Источник временно недоступен.</p> : null}
      <DmButton as="a" href={workspacePath("ADMIN", "/") + serializeAdminQuery(adminSectionQuery(query, section))}>{link}</DmButton>
    </DmSurface>)}</div> : null}
  </section>;
}

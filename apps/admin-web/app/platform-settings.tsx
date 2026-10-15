"use client";
import { type MarketplaceApiClient, frontendDeploymentProfile, workspacePath } from "@marketplace/api-client";
import { DmButton, DmSurface } from "@marketplace/ui/actions";
import { DmFeedback, ErrorState, LoadingState, StatusTag } from "@marketplace/ui/primitives";
import type { OperatorCapability } from "@marketplace/schemas";
import { adminSectionQuery, serializeAdminQuery } from "@marketplace/schemas/product-navigation";
import { useOperatorProjection } from "./use-operator-projection";
import { capabilityLinks, capabilityNames, capabilityProjectionPartial, capabilityReasons, capabilityStates, formatOperatorCount } from "./operator-projection-view-model";
import styles from "./platform-settings.module.css";
import { useAdminQuery } from "./use-admin-query";

const read = (api: MarketplaceApiClient, signal: AbortSignal) => api.operatorCapabilities(signal);
type Target = NonNullable<OperatorCapability["section"]>;
export function PlatformSettings({ onNavigate }: { onNavigate?: (target: Target) => void }) {
  const { data, loading, error, refresh } = useOperatorProjection(read);
  const { state: query } = useAdminQuery();
  const counts = data?.connectors.status === "AVAILABLE" ? data.connectors.counts : null;
  const mismatch = data && data.profile !== frontendDeploymentProfile;
  const link = (section: Target) => <DmButton as="a" href={workspacePath("ADMIN", "/") + serializeAdminQuery(adminSectionQuery(query, section))} onClick={event => {
    if (onNavigate && !event.button && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate(section); }
  }}>{capabilityLinks[section]}</DmButton>;
  return <section aria-labelledby="platform-settings-title" aria-busy={loading}><DmSurface variant="section" className={styles.section}>
    <div className={styles.header}>
      <div><h2 id="platform-settings-title">Возможности платформы</h2>
        <p>Статусы текущей конфигурации. Доступ организации зависит от её прав и условий.</p>
        {data ? <p>{data.profile === "pilot" ? "Пилотный профиль" : "Профиль запуска"}</p> : null}
      </div>

    </div>
    {loading && !data ? <LoadingState label="Проверяем возможности платформы" /> : null}
    {error ? data ? <DmFeedback presentation="inline" tone="danger" title="Возможности не обновлены" description={`${error} Показаны ранее загруженные сведения.`} alert />
      : <ErrorState presentation="inline" title="Возможности недоступны" description={error} action={<DmButton onClick={() => void refresh()}>Повторить загрузку возможностей</DmButton>} /> : null}
    {mismatch ? <DmFeedback tone="warning" title="Профили интерфейса и API различаются" description="Ниже показана конфигурация API. Часть функций может быть недоступна в интерфейсе. Обратитесь к администратору платформы для согласования профилей." alert /> : null}
    {data && capabilityProjectionPartial(data) ? <DmFeedback tone="warning" title="Часть источников недоступна" description="Неизвестные значения отмечены отдельно. Повторите загрузку." /> : null}
    {data ? <>
      <dl className={styles.metrics} aria-label="Сводка конфигурации">
        <div><dt>Каналы со статусом «Готов»</dt><dd>{counts ? `${counts.readinessReady} / ${counts.total}` : "Нет данных"}</dd><p>{counts?.total === 0 ? "Реестр каналов пока пуст." : "Готовность по реестру каналов."}</p>{counts ? <p>Блокирующих условий: {counts.blocked}</p> : null}</div>
        <div><dt>Отмечены как проверенные</dt><dd>{counts ? counts.registeredLiveVerified : "Нет данных"}</dd><p>Отметки реестра, не текущая проверка подключения.</p>{counts ? <p>Внешних зависимостей: {counts.externalDependencies}</p> : null}</div>
        <div><dt>Активных платёжных провайдеров</dt><dd>{formatOperatorCount(data.activePaymentProviders)}</dd><p>Записи реестра, включая тестовые. Это не подтверждение работы платежей.</p></div>
        <div><dt>Активных правил комплаенса</dt><dd>{formatOperatorCount(data.activeComplianceRules)}</dd><p>Правила со статусом «Активно».</p></div>
      </dl>
      <div className={styles.grid}>
        <article><h3>Где управлять рабочими данными</h3><p>Настройки не дублируют формы профильных разделов.</p>
          <div className={styles.routes}>{link("imports")}{link("orders")}{link("security")}</div>
        </article>
        <article><h3>Состояние функций</h3><p>Включение профилем не подтверждает готовность внешнего сервиса.</p>
          <div className={styles.capabilities}>{data.capabilities.map(item => <div className={styles.capability} key={item.id}>
            <div className={styles.capabilityHeading}><strong>{capabilityNames[item.id]}</strong><StatusTag tone={capabilityStates[item.status].tone}>{capabilityStates[item.status].label}</StatusTag></div>
            <p>{capabilityReasons[item.reason]}</p>
            {item.id === "AI_MODEL" && data.profile === "go_live" ? <p>Базовый помощник с разрешёнными инструментами работает без внешней модели.</p> : null}
            {item.section ? link(item.section) : null}
          </div>)}</div>
        </article>
      </div>
    </> : null}
  </DmSurface></section>;
}

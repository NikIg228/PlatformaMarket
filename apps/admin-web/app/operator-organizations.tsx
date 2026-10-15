"use client";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { type MarketplaceApiClient, workspacePath } from "@marketplace/api-client";
import type { OperatorOrganization, OperatorOrganizationsQuery, OrganizationOnboarding } from "@marketplace/schemas";
import { adminSectionQuery, serializeAdminQuery, type AdminQuery } from "@marketplace/schemas/product-navigation";
import { DmButton, DmSurface } from "@marketplace/ui/actions";
import { DmField, DmInput } from "@marketplace/ui/controls";
import { DmDropdown, EmptyState, ErrorState, LoadingState, StatusTag } from "@marketplace/ui";
import { useAdminQuery } from "./use-admin-query";
import { useOperatorProjection } from "./use-operator-projection";
import styles from "./operator-organizations.module.css";

const statuses = { ACTIVE: "Активна", INACTIVE: "Неактивна", ARCHIVED: "В архиве" };
const capabilities = { BUYER: "Покупатель", SUPPLIER: "Поставщик", IMPORTER: "Импортёр", LOGISTICS_PROVIDER: "Логистика", SERVICE_PROVIDER: "Сервис", MARKETPLACE_OPERATOR: "Оператор площадки", PAYMENT_PARTNER: "Платёжный партнёр" };
const href = (state: AdminQuery) => workspacePath("ADMIN", "/") + serializeAdminQuery(state);
function navigate(event: MouseEvent, state: AdminQuery, write: (state: AdminQuery) => void) {
  if (!event.button && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); write(state); }
}
function Classification({ organization }: { organization: OperatorOrganization }) {
  return <div className={styles.tags}><StatusTag tone={organization.status === "ACTIVE" ? "success" : "neutral"}>{statuses[organization.status]}</StatusTag>
    <span>{organization.capabilities.map(value => capabilities[value]).join(" · ") || "Возможности не назначены"}</span></div>;
}

export function OperatorOrganizations() {
  const { state, write } = useAdminQuery();
  const [search, setSearch] = useState(state.orgQ);
  const heading = useRef<HTMLHeadingElement>(null);
  const previous = useRef(state.orgId);
  useEffect(() => { setSearch(state.orgQ); }, [state.orgQ]);
  useEffect(() => { if (previous.current !== state.orgId) { heading.current?.focus(); previous.current = state.orgId; } }, [state.orgId]);
  const invalid = /[\u0000-\u001f\u007f]/.test(search);
  const list = adminSectionQuery(state, "organizations");
  return <section className={styles.section} aria-labelledby="organization-registry-title">
    <div className={styles.header}><h2 id="organization-registry-title" ref={heading} tabIndex={-1}>{state.orgId ? "Карточка организации" : "Реестр организаций"}</h2>
      {state.orgId ? <DmButton as="a" href={href(list)} onClick={event => navigate(event, list, write)}>К списку организаций</DmButton> : null}</div>
    {state.orgId ? <OrganizationDetail key={state.orgId} id={state.orgId} /> : <>
      <DmSurface variant="filters"><form className={styles.filters} onSubmit={event => { event.preventDefault(); if (!invalid) write({ ...state, orgQ: search.trim(), orgOffset: 0 }); }}>
        <DmField label="Название или БИН" validationState={invalid ? "error" : "none"} validationMessage={invalid ? "Удалите управляющие символы." : undefined}><DmInput value={search} maxLength={200} onChange={(_, data) => setSearch(data.value)} /></DmField>
        <DmField label="Статус организации"><DmDropdown value={state.orgStatus} onChange={(_, data) => write({ ...state, orgStatus: data.value as AdminQuery["orgStatus"], orgOffset: 0 })}><option value="">Все статусы</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</DmDropdown></DmField>
        <DmField label="Возможность организации"><DmDropdown value={state.orgCapability} onChange={(_, data) => write({ ...state, orgCapability: data.value as AdminQuery["orgCapability"], orgOffset: 0 })}><option value="">Все возможности</option>{Object.entries(capabilities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</DmDropdown></DmField>
        <div className={styles.actions}><DmButton type="submit" disabled={invalid}>Найти</DmButton>{state.orgQ || state.orgStatus || state.orgCapability ? <DmButton onClick={() => { setSearch(""); write({ ...state, orgQ: "", orgStatus: "", orgCapability: "", orgOffset: 0 }); }}>Сбросить</DmButton> : null}</div>
      </form></DmSurface>
      <OrganizationResults key={`${state.orgQ}|${state.orgStatus}|${state.orgCapability}|${state.orgOffset}`} state={state} write={write} />
    </>}
  </section>;
}

function OrganizationResults({ state, write }: { state: AdminQuery; write: (state: AdminQuery) => void }) {
  const { orgQ, orgStatus, orgCapability, orgOffset } = state;
  const read = useCallback((api: MarketplaceApiClient, signal: AbortSignal) => api.operatorOrganizations({ q: orgQ || undefined, status: orgStatus || undefined, capability: orgCapability || undefined, offset: orgOffset, limit: 25 } satisfies OperatorOrganizationsQuery, signal), [orgQ, orgStatus, orgCapability, orgOffset]);
  const { data, loading, error, refresh } = useOperatorProjection(read);
  return <div className={styles.section} aria-busy={loading}>
    <div className={styles.header}><p role="status">{data ? `Найдено организаций: ${data.total}${loading || error ? " · Последняя загрузка" : ""}` : ""}</p></div>
    {loading && !data ? <LoadingState label="Загружаем организации" /> : null}
    {error ? <ErrorState presentation="inline" title="Реестр не обновлён" description={error} action={<DmButton onClick={() => void refresh()}>Повторить загрузку</DmButton>} /> : null}
    {data?.items.length === 0 ? <EmptyState title="Организации не найдены" description={orgOffset ? "На этой странице нет записей. Вернитесь к началу списка." : "Измените поиск или фильтры."} /> : null}
    <div className={styles.section}>{data?.items.map(organization => {
      const target = { ...adminSectionQuery(state, "organizations"), orgId: organization.id };
      return <DmSurface key={organization.id} variant="card" className={styles.row}>
        <div><h3>{organization.displayName}</h3><p>{organization.legalName}</p><p>БИН {organization.bin}</p></div>
        <Classification organization={organization} />
        <DmButton as="a" href={href(target)} onClick={event => navigate(event, target, write)} aria-label={`Открыть ${organization.displayName}`}>Открыть</DmButton>
      </DmSurface>;
    })}</div>
    {data ? <nav className={styles.actions} aria-label="Страницы организаций">
      <DmButton disabled={loading || orgOffset === 0} onClick={() => write({ ...state, orgOffset: Math.max(0, orgOffset - 25) })}>Назад</DmButton>
      <span>Страница {Math.floor(orgOffset / 25) + 1}</span>
      <DmButton disabled={loading || orgOffset + 25 >= data.total || orgOffset >= 1000000} onClick={() => write({ ...state, orgOffset: orgOffset + 25 })}>Далее</DmButton>
      {orgOffset > 0 ? <DmButton onClick={() => write({ ...state, orgOffset: 0 })}>В начало списка</DmButton> : null}
    </nav> : null}
  </div>;
}

function OrganizationDetail({ id }: { id: string }) {
  const read = useCallback((api: MarketplaceApiClient, signal: AbortSignal) => api.operatorOrganization(id, signal), [id]);
  const { data, loading, error, errorStatus, refresh } = useOperatorProjection(read, true);

  return <div className={styles.section} aria-busy={loading}>

    {loading && !data ? <LoadingState label="Загружаем карточку организации" /> : null}
    {error ? <ErrorState presentation="inline" title={errorStatus === 404 ? "Организация не найдена" : "Карточка недоступна"} description={errorStatus === 404 ? "Вернитесь к списку и выберите организацию заново." : error} action={<DmButton onClick={() => void refresh()}>Повторить загрузку карточки</DmButton>} /> : null}
    {data ? <><DmSurface variant="section" className={styles.section}><h3>{data.displayName}</h3><Classification organization={data} />
      <dl className={styles.details}><div><dt>Юридическое название</dt><dd>{data.legalName}</dd></div><div><dt>БИН</dt><dd>{data.bin}</dd></div>
        <div><dt>Дата регистрации</dt><dd>{new Date(data.createdAt).toLocaleDateString("ru-KZ")}</dd></div></dl>
      <h3>Анкета организации</h3>{data.profile ? <dl className={styles.details}>
        <div><dt>Официальный контакт</dt><dd>{data.profile.contactName}<br />{data.profile.phone}<br />{data.profile.email}</dd></div>
        {data.profile.additionalContacts?.map((contact, index) => <div key={index}><dt>Резервный контакт {index + 1}</dt><dd>{contact.contactName}<br />{contact.phone}<br />{contact.email}</dd></div>)}
        <div><dt>Юридический адрес</dt><dd>{data.profileCities?.legal ?? "Город не указан"}, {data.profile.legalAddress.line1}{data.profile.legalAddress.postalCode ? `, ${data.profile.legalAddress.postalCode}` : ""}</dd></div>
        <div><dt>Адрес доставки</dt><dd>{data.profileCities?.delivery ?? "Город не указан"}, {data.profile.deliveryAddress.line1}{data.profile.deliveryAddress.postalCode ? `, ${data.profile.deliveryAddress.postalCode}` : ""}</dd></div>
      </dl> : <p>Анкета не заполнена или требует уточнения.</p>}</DmSurface>
      {data.capabilities.includes("SUPPLIER") ? <SupplierReadiness key={`${id}-${data.version}`} id={id} /> : null}
    </> : null}
  </div>;
}

function SupplierReadiness({ id }: { id: string }) {
  const read = useCallback((api: MarketplaceApiClient, signal: AbortSignal) => api.get<OrganizationOnboarding>(`/organizations/${encodeURIComponent(id)}/onboarding`, { signal }), [id]);
  const { data, loading, error, refresh } = useOperatorProjection(read);
  return <DmSurface variant="section" className={styles.section} aria-label="Готовность поставщика"><h3>Готовность поставщика</h3>

    {loading && !data ? <LoadingState label="Проверяем готовность поставщика" /> : null}
    {error ? <ErrorState presentation="inline" title="Готовность недоступна" description={error} action={<DmButton onClick={() => void refresh()}>Повторить проверку готовности</DmButton>} /> : null}
    {data ? <><StatusTag tone={data.ready ? "success" : "warning"}>{data.ready ? "Готов к работе" : "Есть незавершённые этапы"}</StatusTag>
      {data.steps.map(step => <div key={step.id}><strong>{step.label}</strong><p>{step.complete ? "Выполнено" : step.reason ?? "Не завершено"}</p></div>)}</> : null}
  </DmSurface>;
}

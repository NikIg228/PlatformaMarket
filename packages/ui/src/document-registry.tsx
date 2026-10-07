"use client";
import { ActionFeedback } from "./action-feedback";
import { ArrowDownload24Regular } from "@fluentui/react-icons/svg/arrow-download";
import { Filter24Regular } from "@fluentui/react-icons/svg/filter";
import { Spinner } from "@fluentui/react-components";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DmAction, DmButton, DmField, DmInput, DmSelect, DmSurface } from "./controls";
import { DmSearch } from "./dm-search";
import { categoryLabels, kindLabels, DocumentStatus, type DocumentArchiveItemView as Item, type DocumentArchiveFilters as Filters, type DocumentArchiveSummaryView } from "./document-archive";
import { DocumentDetailPanel, type DocumentDetailActions } from "./document-detail-panel";
import { DocumentCounterpartyFilter, type DocumentCounterpartyPage } from "./document-counterparty-filter";
import { formatDocumentAmount } from "./document-upload-model";

const views = [["", "Все"], ["AWAITING_SIGNATURE", "Ожидают подписи"], ["ATTENTION", "Требуют внимания"], ["ARCHIVED", "Архив"]] as const;
export function DocumentRegistry({ role, organizationId, items, summary, filters, loading, error, filterError, nextCursor, initialDocumentId, busyDocumentId, uploadAction, calendarTimeZone, onFiltersChange, onApplyFilters, onResetFilters, onRefresh, onLoadMore, loadCounterparties, ...actions }: DocumentDetailActions & {
  role: "clinic" | "supplier"; organizationId: string; items: Item[]; summary: DocumentArchiveSummaryView | null; filters: Filters;
  loading: boolean; error: string | null; filterError?: string | null; nextCursor: string | null; initialDocumentId?: string | null;
  busyDocumentId: string | null; uploadAction: ReactNode; calendarTimeZone: string;
  onFiltersChange: (value: Filters) => void; onApplyFilters: (value: Filters) => void; onResetFilters: () => void;
  onRefresh: () => void; onLoadMore: () => void; loadCounterparties: (q: string) => Promise<DocumentCounterpartyPage>;
}) {
  const [query, setQuery] = useState(filters.q);
  const [expanded, setExpanded] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(initialDocumentId ?? null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => setQuery(filters.q), [filters.q]);
  useEffect(() => { if (initialDocumentId) setSelected(initialDocumentId); }, [initialDocumentId]);
  useEffect(() => { setSelected(initialDocumentId ?? null); }, [organizationId]);
  const apply = (next: Filters) => { onFiltersChange(next); onApplyFilters(next); };
  const open = (id: string, target?: HTMLButtonElement) => { if (target) opener.current = target; setSelected(id); };
  const close = () => { setSelected(null); requestAnimationFrame(() => (opener.current?.isConnected ? opener.current : heading.current)?.focus()); };
  const active = Boolean(filters.q || filters.category || filters.status || filters.accountingStatus || filters.dateFrom || filters.dateTo || filters.counterpartyOrganizationId || filters.view);
  const extraCount = [filters.category, filters.status, filters.accountingStatus].filter(Boolean).length;
  const date = (value: string) => new Intl.DateTimeFormat("ru-KZ", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: calendarTimeZone }).format(new Date(value));
  return <div className={`dm-registry-layout${selected ? " dm-registry-layout-open" : ""}`}>
    <DmSurface className="dm-registry">
      <header className="dm-registry-heading"><h2 ref={heading} tabIndex={-1}>Документы по {role === "clinic" ? "закупкам" : "продажам"}</h2>{uploadAction}</header>
      <div className="dm-registry-tools">
        <DmSearch aria-label="Поиск документов" placeholder="Найти документ" value={query} onChange={setQuery} onSearch={q => apply({ ...filters, q })} pending={loading} />
        <DocumentCounterpartyFilter label={role === "clinic" ? "Все поставщики" : "Все клиники"} value={filters.counterpartyOrganizationId ?? ""} load={loadCounterparties} onChange={counterpartyOrganizationId => apply({ ...filters, counterpartyOrganizationId })} />
        <DmButton aria-expanded={periodOpen} aria-controls="document-period" onClick={() => setPeriodOpen(!periodOpen)}>{filters.dateFrom || filters.dateTo ? "Период выбран" : "Период"}</DmButton>
        <DmButton icon={<Filter24Regular />} aria-expanded={expanded} aria-controls="document-filters" onClick={() => setExpanded(!expanded)}>Фильтры{extraCount ? ` · ${extraCount}` : ""}</DmButton>
      </div>
      {periodOpen || expanded ? <form className="dm-registry-extra" onSubmit={event => { event.preventDefault(); apply({ ...filters, q: query }); }}>
        {periodOpen ? <div id="document-period" className="dm-registry-extra-row"><DmField label="С даты"><DmInput type="date" value={filters.dateFrom} onChange={(_, data) => onFiltersChange({ ...filters, dateFrom: data.value })} /></DmField><DmField label="По дату"><DmInput type="date" value={filters.dateTo} onChange={(_, data) => onFiltersChange({ ...filters, dateTo: data.value })} /></DmField><span className="dm-registry-muted">Часовой пояс: {calendarTimeZone}</span></div> : null}
        {expanded ? <div id="document-filters" className="dm-registry-extra-row">
          <DmField label="Категория документа"><DmSelect value={filters.category} onChange={(_, data) => onFiltersChange({ ...filters, category: data.value })}><option value="">Все категории</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</DmSelect></DmField>
          <DmField label="Статус документа"><DmSelect value={filters.status} onChange={(_, data) => onFiltersChange({ ...filters, status: data.value })}><option value="">Все статусы</option><option value="SIGNED">Подписан</option><option value="GENERATED">Готов</option><option value="DRAFT">Черновик</option><option value="FAILED">Ошибка</option><option value="REJECTED">Отклонён</option><option value="EXPIRED">Истёк</option><option value="SUPERSEDED">Есть новая версия</option></DmSelect></DmField>
          <DmField label="Бухгалтерский статус"><DmSelect value={filters.accountingStatus} onChange={(_, data) => onFiltersChange({ ...filters, accountingStatus: data.value })}><option value="">Любая проверка</option><option value="PENDING_REVIEW">На проверке</option><option value="REVIEWED">Проверен</option><option value="RECONCILED">Сверен</option><option value="DISPUTED">Есть расхождение</option></DmSelect></DmField>
        </div> : null}<div><DmButton type="submit" appearance="primary">Применить</DmButton></div>
      </form> : null}
      {filterError ? <p className="dm-registry-message" role="alert">{filterError}</p> : null}
      <div className="dm-registry-views" role="group" aria-label="Состояние документов">{views.map(([value, label]) => <DmAction key={value} variant="tab" aria-pressed={(filters.view ?? "") === value} onClick={() => apply({ ...filters, view: value })}>{label}{summary && value === "AWAITING_SIGNATURE" ? ` · ${summary.awaitingSignature}` : summary && value === "ATTENTION" ? ` · ${summary.attention}` : ""}</DmAction>)}{active ? <DmButton appearance="subtle" onClick={onResetFilters}>Сбросить фильтры</DmButton> : null}</div>
      {error ? <ActionFeedback tone="error" description={error} action={<DmButton onClick={onRefresh}>Повторить</DmButton>} /> : null}
      {loading && !items.length ? <div className="dm-registry-message"><Spinner label="Загружаем документы" /></div> : null}
      {!loading && !error && !items.length ? <div className="dm-registry-empty"><h3>{active ? "Ничего не найдено" : "Документов пока нет"}</h3><p>{active ? "Измените поиск или сбросьте фильтры." : "Здесь появятся документы по заказам. Вы также можете загрузить свой файл."}</p>{active ? <DmButton onClick={onResetFilters}>Сбросить фильтры</DmButton> : null}</div> : null}
      {items.length ? <div className="dm-registry-table-wrap" aria-busy={loading}><table className="dm-registry-table"><caption className="dm-sr-only">Документы организации</caption><thead><tr><th>Документ</th><th>{role === "clinic" ? "Поставщик" : "Клиника"}</th><th>Заказ</th><th>Дата ↓</th><th>Сумма</th><th>Состояние</th><th><span className="dm-sr-only">Скачать</span></th></tr></thead><tbody>{items.map(item => <tr key={item.id} data-selected={selected === item.id}>
        <td data-label="Документ"><DmAction variant="text" className="dm-registry-document" onClick={event => open(item.id, event.currentTarget)}><strong>{item.title}</strong><span className="dm-registry-muted">{kindLabels[item.kind] ?? item.kind} · № {item.documentNumber}</span></DmAction></td>
        <td data-label={role === "clinic" ? "Поставщик" : "Клиника"}>{item.participants.find(p => p.organizationId !== organizationId)?.organization.displayName ?? "—"}</td>
        <td data-label="Заказ">{item.supplierOrder ? <a href={`/${role}/orders/${item.supplierOrder.id}`}>{item.supplierOrder.orderNumber}</a> : "—"}</td>
        <td data-label="Дата">{date(item.documentDate)}</td><td data-label="Сумма">{formatDocumentAmount(item.amountMinor, item.currency)}</td>
        <td data-label="Состояние"><div className="dm-document-statuses"><DocumentStatus value={item.status} />{item.accountingStatus !== "NOT_APPLICABLE" ? <DocumentStatus value={item.accountingStatus} /> : null}</div></td>
        <td><DmButton appearance="subtle" icon={<ArrowDownload24Regular />} aria-label={`Скачать ${item.title}`} disabled={busyDocumentId === item.id} onClick={() => void actions.onDownload(item).catch(() => undefined)} /></td>
      </tr>)}</tbody></table></div> : null}
      <footer className="dm-registry-footer"><span className="dm-registry-muted" role="status">{loading ? "Загружаем…" : `Показано документов: ${items.length}`}</span>{nextCursor ? <DmButton disabled={loading} onClick={onLoadMore}>Показать ещё</DmButton> : null}</footer>
    </DmSurface>
    {selected ? <DocumentDetailPanel key={organizationId} id={selected} role={role} organizationId={organizationId} timeZone={calendarTimeZone} onSelect={id => open(id)} onClose={close} {...actions} /> : null}
  </div>;
}

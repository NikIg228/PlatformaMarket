"use client";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import { DmButton, DmField, DmInput, DmDropdown, DmTextarea, ErrorState, LoadingState, StatusTag, WorkflowSteps, ProductThumbnail, useUnsavedChanges, productWorkflowStyles as styles, formatDate, errorMessage } from "@marketplace/ui";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { canSubmitProductCorrection } from "./product-corrections-validation";
type Product = { id: string; canonicalName: string; description: string | null; manufacturerSku: string | null; gtin: string | null; productType: string; regulatoryClass: string | null; media?: { sourceUrl: string | null }[] };
type Offer = { id: string; productVariant: { product: Product } };
type Correction = { id: string; field: string; currentValue: string | null; proposedValue: string; reason: string; status: "PENDING" | "APPROVED" | "PARTIALLY_APPROVED" | "REJECTED"; moderatorComment: string | null; appliedValue: string | null; createdAt: string; supplierOrganizationId: string; product: { canonicalName: string } };
const fields = [["CANONICAL_NAME", "Название"], ["DESCRIPTION", "Описание"], ["MANUFACTURER_SKU", "Артикул производителя"], ["GTIN", "GTIN"], ["PRODUCT_TYPE", "Тип товара"], ["REGULATORY_CLASS", "Регуляторный класс"]] as const;
const fieldLabel = (field: string) => fields.find(([value]) => value === field)?.[1] ?? field;
const statusLabel: Record<Correction["status"], string> = { PENDING: "Проверяем", APPROVED: "Принято", PARTIALLY_APPROVED: "Принято с редактурой", REJECTED: "Отклонено" };
export function ProductCorrectionsPanel({ api, offers, supplierId, hideHeading = false, createMode = false, initialOffer, selectionControls, onModeChange }: {
  api: MarketplaceApiClient; offers: Offer[]; supplierId: string; hideHeading?: boolean; createMode?: boolean; initialOffer?: Offer; selectionControls?: ReactNode; onModeChange?: (create: boolean) => void;
}) {
  const [editing, setEditing] = useState(createMode), [step, setStep] = useState(initialOffer ? 1 : 0), [sent, setSent] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(initialOffer?.productVariant.product ?? null);
  const products = useMemo(() => [...new Map([...(selectedProduct ? [selectedProduct] : []), ...offers.map(offer => offer.productVariant.product)].map(product => [product.id, product])).values()], [offers, selectedProduct]);
  const [field, setField] = useState<(typeof fields)[number][0]>("DESCRIPTION"), [proposedValue, setProposedValue] = useState(""), [reason, setReason] = useState(""), [evidenceUrl, setEvidenceUrl] = useState("");
  const [items, setItems] = useState<Correction[]>([]), [busy, setBusy] = useState(false), [historyLoading, setHistoryLoading] = useState(true), [historyError, setHistoryError] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const [historyLimit, setHistoryLimit] = useState(12), [search, setSearch] = useState(""), [status, setStatus] = useState(""), [selectedId, setSelectedId] = useState<string | null>(null);
  const lock = useRef(false), sequence = useRef(0), form = useRef<HTMLFormElement>(null);
  useUnsavedChanges(editing && !sent && Boolean(proposedValue || reason || evidenceUrl));
  const currentValue = selectedProduct ? ({ CANONICAL_NAME: selectedProduct.canonicalName, DESCRIPTION: selectedProduct.description, MANUFACTURER_SKU: selectedProduct.manufacturerSku, GTIN: selectedProduct.gtin, PRODUCT_TYPE: selectedProduct.productType, REGULATORY_CLASS: selectedProduct.regulatoryClass })[field] : null;
  const load = useCallback(async () => { const request = ++sequence.current; setHistoryLoading(true); setHistoryError(null);
    try { const data = await api.get<Correction[]>("/moderation/product-corrections"); if (request === sequence.current) setItems(data.filter(item => item.supplierOrganizationId === supplierId)); }
    catch { if (request === sequence.current) setHistoryError("Не удалось загрузить историю исправлений. Повторите попытку."); }
    finally { if (request === sequence.current) setHistoryLoading(false); }
  }, [api, supplierId]);
  useEffect(() => { void load(); return () => { sequence.current++; }; }, [load]);
  useEffect(() => setEditing(createMode), [createMode]);
  const changeMode = (value: boolean) => { setEditing(value); onModeChange?.(value); };
  const submit = async () => {
    if (lock.current || !canSubmitProductCorrection({ busy, productId: selectedProduct?.id ?? "", proposedValue, reason })) return;
    lock.current = true; setBusy(true); setError(null);
    try { await api.post("/moderation/product-corrections", { productId: selectedProduct!.id, field, proposedValue: proposedValue.trim(), reason: reason.trim(), evidenceUrl: evidenceUrl.trim() || undefined }); setSent(true); await load(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  const filtered = items.filter(item => (!status || item.status === status) && item.product.canonicalName.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = items.find(item => item.id === selectedId);
  if (!editing) return <div className={styles.form}>
    {!hideHeading ? <h2>Исправления карточек</h2> : null}
    <div className={styles.toolbar}><DmInput aria-label="Поиск исправления" placeholder="Название товара" value={search} onChange={(_, data) => { setSearch(data.value); setHistoryLimit(12); }} /><DmDropdown aria-label="Статус исправления" value={status} onChange={(_, data) => { setStatus(data.value); setHistoryLimit(12); }}><option value="">Все статусы</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</DmDropdown><DmButton appearance="primary" onClick={() => { setSent(false); setStep(0); setSelectedProduct(null); setProposedValue(""); setReason(""); setEvidenceUrl(""); changeMode(true); }}>Предложить исправление</DmButton></div>
    {historyError ? <ErrorState description={historyError} action={<DmButton onClick={() => void load()}>Повторить</DmButton>} /> : null}
    {historyLoading && !items.length ? <LoadingState label="Загружаем историю исправлений" /> : !filtered.length ? <div className={`${styles.panel} ${styles.empty}`}><h2>{items.length ? "Исправления не найдены" : "Исправлений пока нет"}</h2><p>{items.length ? "Попробуйте изменить поиск или статус." : "Предложите правку карточки. Решение площадки появится здесь."}</p></div> : <div className={styles.panel}><table className={styles.table}><caption className="dm-sr-only">Мои исправления</caption><thead><tr><th>Товар и поле</th><th>Дата</th><th>Статус</th><th>Действие</th></tr></thead><tbody>{filtered.slice(0, historyLimit).map(item => <tr key={item.id} data-selected={selectedId === item.id}><td data-label="Товар"><div><strong>{item.product.canonicalName}</strong><small>{fieldLabel(item.field)}</small></div></td><td data-label="Дата"><div>{formatDate(item.createdAt, true)}</div></td><td data-label="Статус"><div><StatusTag tone={item.status === "REJECTED" ? "danger" : item.status === "PENDING" ? "warning" : "success"}>{statusLabel[item.status]}</StatusTag></div></td><td data-label="Действие"><DmButton onClick={() => setSelectedId(item.id)}>Подробнее</DmButton></td></tr>)}</tbody></table>{filtered.length > historyLimit ? <DmButton onClick={() => setHistoryLimit(value => value + 12)}>Показать более ранние исправления</DmButton> : null}</div>}
    {selected ? <section className={`${styles.panel} ${styles.form}`} aria-label="Результат исправления"><div className={styles.toolbar}><h2>{selected.product.canonicalName}</h2><DmButton onClick={() => setSelectedId(null)}>Закрыть подробности</DmButton></div><div className={styles.fields}><div><h3>Было</h3><p>{selected.currentValue || "Не заполнено"}</p></div><div><h3>Предложено</h3><p>{selected.proposedValue}</p></div></div><p>Причина: {selected.reason}</p>{selected.appliedValue !== null ? <p className={styles.notice}>Принято: {selected.appliedValue}</p> : null}{selected.moderatorComment ? <p>Комментарий PlatformaMarket: {selected.moderatorComment}</p> : null}</section> : null}
  </div>;
  if (sent) return <section className={`${styles.panel} ${styles.empty}`}><h2>Исправление отправлено</h2><p role="status">Площадка проверит предложение. До принятия правки карточка останется прежней.</p><DmButton appearance="primary" onClick={() => changeMode(false)}>Мои исправления</DmButton></section>;
  return <div className={styles.correctionForm}>
    <form ref={form} className={`${styles.panel} ${styles.form}`} onSubmit={event => { event.preventDefault(); if (step === 1) { if (form.current?.reportValidity()) setStep(2); } else if (step === 2) void submit(); }}>
      <WorkflowSteps steps={["Выбор товара", "Исправление", "Подтверждение"]} current={step} onSelect={!busy ? setStep : undefined} />
      {error ? <ErrorState description={error} /> : null}
      {step === 0 ? <><h2>Выберите карточку товара</h2>{selectionControls}{!products.length ? <p className={styles.hint}>Нет доступных карточек. Измените поиск или сначала добавьте предложение.</p> : <div className={styles.results}>{products.map(product => <div key={product.id} className={styles.result}><div className={styles.identity}><ProductThumbnail src={product.media?.[0]?.sourceUrl} name={product.canonicalName} /><div><strong>{product.canonicalName}</strong><small>{product.manufacturerSku || "Артикул не указан"}</small></div></div><DmButton onClick={() => { setSelectedProduct(product); setStep(1); }}>Выбрать</DmButton></div>)}</div>}</> : <>
        <div className={`${styles.identity} ${styles.selectionSummary}`}><ProductThumbnail src={selectedProduct?.media?.[0]?.sourceUrl} name={selectedProduct?.canonicalName ?? "Товар"} /><div><strong>{selectedProduct?.canonicalName}</strong><small>{selectedProduct?.manufacturerSku || "Артикул не указан"}</small></div><DmButton appearance="subtle" disabled={busy} onClick={() => setStep(0)}>Изменить товар</DmButton></div>
        {step === 1 ? <><h2>Что нужно исправить?</h2><div className={styles.halfField}><DmField label="Что исправить" required><DmDropdown value={field} disabled={busy} onChange={(_, data) => { setField(data.value as typeof field); setProposedValue(""); }}>{fields.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</DmDropdown></DmField></div>
          <div className={styles.fields}><DmField label="Сейчас в карточке"><div className={styles.currentValue}>{currentValue || "Не заполнено"}</div></DmField><DmField label="Предлагаемая редакция" required><DmTextarea required minLength={2} maxLength={5000} rows={5} value={proposedValue} onChange={(_, data) => setProposedValue(data.value)} /></DmField></div>
          <div className={styles.fields}><DmField label="Почему нужна правка" required hint="Не менее 10 символов. Объясните расхождение с документом или каталогом производителя."><DmTextarea required minLength={10} maxLength={1000} rows={2} value={reason} onChange={(_, data) => setReason(data.value)} /></DmField><DmField label="Ссылка на подтверждение" hint="Необязательно: сайт производителя или регистрационный документ."><DmInput type="url" maxLength={2000} value={evidenceUrl} onChange={(_, data) => setEvidenceUrl(data.value)} /></DmField></div><p className={styles.hint}>Изменение появится в карточке после проверки площадкой.</p>
        </> : <><h2>Проверьте исправление</h2><dl className={styles.metadata}><dt>Поле</dt><dd>{fieldLabel(field)}</dd><dt>Сейчас</dt><dd>{currentValue || "Не заполнено"}</dd><dt>Предложено</dt><dd>{proposedValue}</dd><dt>Причина</dt><dd>{reason}</dd>{evidenceUrl ? <><dt>Подтверждение</dt><dd>{evidenceUrl}</dd></> : null}</dl><p className={styles.notice}>Изменение появится в общей карточке только после проверки площадкой.</p></>}
      </>}
      <div className={styles.footer}><DmButton disabled={busy} onClick={() => { if (step > 0) setStep(step - 1); else if (!(proposedValue || reason || evidenceUrl) || window.confirm("Закрыть форму без отправки?")) changeMode(false); }}>{step > 0 ? "Назад" : "Отмена"}</DmButton>{step > 0 ? <DmButton type="submit" appearance="primary" disabled={busy || (step === 2 && !canSubmitProductCorrection({ busy, productId: selectedProduct?.id ?? "", proposedValue, reason }))}>{busy ? "Отправляем…" : step === 1 ? "Далее: подтверждение" : "Отправить исправление"}</DmButton> : null}</div>
    </form>
  </div>;
}

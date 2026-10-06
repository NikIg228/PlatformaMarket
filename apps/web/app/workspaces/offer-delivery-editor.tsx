"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createOfferDeliveryOptionSchema, type OfferDeliveryOptionResponse, type SupplierWarehouseList } from "@marketplace/schemas";
import { DmButton, DmCheckbox, DmField, DmInput, DmDropdown, ErrorState, errorMessage, formatMoney, usePermissions } from "@marketplace/ui";
import { offerPriceMinor, offerPriceText } from "../../../supplier-web/app/features/supplier-workspace/offer-editor-model";
import { useWorkspace } from "./workspace";
import { EditorActions, confirmDiscard, responseStatus, useEditorGuard, type OfferEditorProps } from "./offer-editor-shared";
import styles from "./offer-editors.module.css";
const methods = { PICKUP: "Самовывоз", SUPPLIER_CITY: "Доставка поставщиком по городу", NATIONWIDE: "По Казахстану", CARRIER: "Транспортная компания", SPECIAL: "Специальная доставка" };
type Draft = { warehouseId: string; method: string; priceType: string; fixed: string; threshold: string; minimum: string; maximum: string; instructions: string; cold: boolean; installation: boolean };
const draftOf = (option?: OfferDeliveryOptionResponse, warehouseId = ""): Draft => ({ warehouseId: option?.warehouseId ?? warehouseId, method: option?.method ?? "PICKUP", priceType: option?.priceType ?? "PRICE_ON_REQUEST", fixed: option?.fixedAmountMinor == null ? "" : offerPriceText(option.fixedAmountMinor), threshold: option?.freeFromAmountMinor == null ? "" : offerPriceText(option.freeFromAmountMinor), minimum: String(option?.minLeadTimeHours ?? 0), maximum: option?.maxLeadTimeHours == null ? "" : String(option.maxLeadTimeHours), instructions: option?.pickupInstructions ?? "", cold: option?.temperatureControlled ?? false, installation: option?.installationRequired ?? false });
const label = (method: string) => methods[method as keyof typeof methods] ?? method;
const cost = (option: OfferDeliveryOptionResponse) => option.priceType === "FREE" ? "Бесплатно" : option.priceType === "PRICE_ON_REQUEST" ? "По согласованию" : `${formatMoney(String(option.fixedAmountMinor ?? 0), option.currency)}${option.priceType === "FREE_FROM_AMOUNT" ? ` · бесплатно от ${formatMoney(String(option.freeFromAmountMinor ?? 0), option.currency)}` : ""}`;
export function OfferDeliveryEditor(props: OfferEditorProps) {
  const { api, organizationId } = useWorkspace(), has = usePermissions(), formId = useId();
  const [options, setOptions] = useState<OfferDeliveryOptionResponse[] | null>(null), [warehouses, setWarehouses] = useState<SupplierWarehouseList>([]);
  const [draft, setDraft] = useState<Draft | null>(null), [baseline, setBaseline] = useState<Draft | null>(null), [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [attempt, setAttempt] = useState(0), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [unknown, setUnknown] = useState(false), [validation, setValidation] = useState<Record<string, string>>({});
  const [review, setReview] = useState<{ saved: OfferDeliveryOptionResponse | null } | null>(null);
  const flight = useRef(false), heading = useRef<HTMLHeadingElement>(null);
  const allowed = has("delivery.view", "delivery.manage"), dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  useEditorGuard(props, dirty || unknown, busy || unknown);
  useEffect(() => { let alive = true; setLoading(true); setError("");
    void Promise.all([api.listSupplierWarehouses(organizationId), api.listOfferDeliveryOptions(organizationId, props.offer.id)]).then(([stores, items]) => { if (alive) { setWarehouses(stores); setOptions(items); } }).catch(cause => { if (alive) setError(errorMessage(cause)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [api, organizationId, props.offer.id, attempt]);
  const select = (option?: OfferDeliveryOptionResponse) => {
    if (busy || unknown || (dirty && !confirmDiscard())) return;
    if (option && option.currency !== "KZT") { setError("Изменение доступно только для условий в тенге. Обратитесь к оператору."); return; }
    const next = draftOf(option, warehouses.find(item => item.status === "ACTIVE")?.id);
    setDraft(next); setBaseline(next); setEditing(option?.id ?? null); setValidation({}); setError(""); setNotice("");
    requestAnimationFrame(() => heading.current?.focus());
  };
  const back = () => { if (!busy && !unknown && (!dirty || confirmDiscard())) { setDraft(null); setBaseline(null); setError(""); setValidation({}); } };
  const change = (key: keyof Draft, value: string | boolean) => { setDraft(current => current ? { ...current, [key]: value } : null); setValidation({}); };
  const duplicate = draft && !editing ? options?.find(item => item.warehouseId === draft.warehouseId && item.method === draft.method) : undefined;
  const refreshOutcome = async () => {
    if (flight.current) return; flight.current = true; setBusy(true);
    try { const items = await api.listOfferDeliveryOptions(organizationId, props.offer.id); setOptions(items); setReview({ saved: items.find(item => item.warehouseId === draft?.warehouseId && item.method === draft?.method) ?? null }); setError(""); }
    catch (cause) { setError(errorMessage(cause)); } finally { flight.current = false; setBusy(false); }
  };
  const save = async () => {
    if (!draft || !allowed || duplicate || flight.current || unknown) return;
    const errors: Record<string, string> = {};
    if (!/^\d+$/.test(draft.minimum) || Number(draft.minimum) > 8760) errors.minimum = "Укажите целое число от 0 до 8760 часов.";
    if (draft.maximum && (!/^\d+$/.test(draft.maximum) || Number(draft.maximum) > 8760 || Number(draft.maximum) < Number(draft.minimum))) errors.maximum = "Максимальный срок должен быть не меньше минимального и не больше 8760 часов.";
    const money = (value: string, key: string) => { try { return /^0(?:[.,]0{1,2})?$/.test(value.trim()) ? 0 : offerPriceMinor(value); } catch { errors[key] = "Укажите сумму в тенге, не меньше нуля."; return null; } };
    const fixedAmountMinor = ["FIXED", "FREE_FROM_AMOUNT"].includes(draft.priceType) ? money(draft.fixed, "fixed") : null;
    const freeFromAmountMinor = draft.priceType === "FREE_FROM_AMOUNT" ? money(draft.threshold, "threshold") : null;
    if (!warehouses.some(item => item.id === draft.warehouseId && item.status === "ACTIVE")) errors.warehouseId = "Выберите действующий склад.";
    setValidation(errors); if (Object.keys(errors).length) return;
    const parsed = createOfferDeliveryOptionSchema.safeParse({ warehouseId: draft.warehouseId, method: draft.method, priceType: draft.priceType, currency: "KZT", fixedAmountMinor, freeFromAmountMinor, minLeadTimeHours: Number(draft.minimum), maxLeadTimeHours: draft.maximum ? Number(draft.maximum) : null, pickupInstructions: draft.instructions.trim() || null, temperatureControlled: draft.cold, installationRequired: draft.installation });
    if (!parsed.success) { setError("Проверьте стоимость, сроки и инструкции по получению."); return; }
    flight.current = true; setBusy(true); setError("");
    try { const saved = await api.saveOfferDeliveryOption(organizationId, props.offer.id, parsed.data); setOptions(current => [...(current ?? []).filter(item => item.id !== saved.id), saved]); setDraft(null); setBaseline(null); setNotice("Условия доставки сохранены."); }
    catch (cause) { setError(errorMessage(cause)); const status = responseStatus(cause); if (!status || status >= 500 || status === 408) setUnknown(true); }
    finally { flight.current = false; setBusy(false); }
  };
  const field = (key: keyof Draft, title: string, numeric = false) => <DmField label={title} validationState={validation[key] ? "error" : "none"} validationMessage={validation[key]}><DmInput value={String(draft?.[key] ?? "")} disabled={busy || unknown} inputMode={numeric ? "decimal" : "text"} maxLength={key === "instructions" ? 1000 : undefined} onChange={(_, data) => change(key, data.value)} /></DmField>;
  return <div className={styles.form}>
    {loading ? <p role="status">Загружаем варианты доставки…</p> : null}{error ? <ErrorState description={error} /> : null}{notice ? <p role="status">{notice}</p> : null}
    {!loading && options === null ? <DmButton onClick={() => setAttempt(value => value + 1)}>Повторить загрузку редактора</DmButton> : null}
    {!allowed ? <p>Настройка доставки недоступна вашей роли.</p> : !loading && options ? <>
      {!draft ? <><div className={styles.options}>{!options.length ? <p>Способы доставки ещё не добавлены.</p> : options.map(option => <article className={styles.option} key={option.id}><div><strong>{label(option.method)}</strong><p>{warehouses.find(item => item.id === option.warehouseId)?.name ?? "Склад недоступен"}</p><p>{cost(option)} · от {option.minLeadTimeHours}{option.maxLeadTimeHours === null ? "" : ` до ${option.maxLeadTimeHours}`} ч.</p></div><DmButton onClick={() => select(option)} aria-label={`Изменить: ${label(option.method)}`}>Изменить</DmButton></article>)}</div>
      {warehouses.some(item => item.status === "ACTIVE") ? <DmButton onClick={() => select()}>Добавить способ доставки</DmButton> : <p>Добавьте действующий склад в настройках организации, чтобы настроить доставку.</p>}
      <EditorActions host={props.footer}><DmButton onClick={props.onCancel}>К предложению</DmButton></EditorActions></> : <form id={formId} className={styles.form} onSubmit={event => { event.preventDefault(); void save(); }}>
        <h3 ref={heading} tabIndex={-1}>{editing ? `Редактирование: ${label(draft.method)}` : "Новый способ доставки"}</h3>
        {editing ? <dl className={styles.readOnly}><div><dt>Склад отправления</dt><dd>{warehouses.find(item => item.id === draft.warehouseId)?.name ?? "Склад недоступен"}</dd></div><div><dt>Способ доставки</dt><dd>{label(draft.method)}</dd></div></dl> : <>
          <DmField label="Склад отправления" validationState={validation.warehouseId ? "error" : "none"} validationMessage={validation.warehouseId}><DmDropdown value={draft.warehouseId} disabled={busy || unknown} onChange={(_, data) => change("warehouseId", data.value)}><option value="">Выберите склад</option>{warehouses.filter(item => item.status === "ACTIVE").map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</DmDropdown></DmField>
          <DmField label="Способ доставки"><DmDropdown value={draft.method} disabled={busy || unknown} onChange={(_, data) => change("method", data.value)}>{Object.entries(methods).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</DmDropdown></DmField>
        </>}
        {duplicate ? <div role="status"><p>Этот способ уже настроен для выбранного склада. Откройте его для изменения.</p><DmButton onClick={() => select(duplicate)}>Открыть существующий вариант</DmButton></div> : null}
        <DmField label="Стоимость доставки"><DmDropdown value={draft.priceType} disabled={busy || unknown} onChange={(_, data) => change("priceType", data.value)}><option value="PRICE_ON_REQUEST">По согласованию</option><option value="FREE">Бесплатно</option><option value="FIXED">Фиксированная</option><option value="FREE_FROM_AMOUNT">Бесплатно от суммы</option></DmDropdown></DmField>
        {["FIXED", "FREE_FROM_AMOUNT"].includes(draft.priceType) ? field("fixed", "Цена доставки, ₸", true) : null}{draft.priceType === "FREE_FROM_AMOUNT" ? field("threshold", "Бесплатно от суммы, ₸", true) : null}
        <div className={styles.fields}>{field("minimum", "Минимальный срок, часов", true)}{field("maximum", "Максимальный срок, часов", true)}</div>{field("instructions", "Инструкции по получению")}
        <DmCheckbox label="Температурный режим" checked={draft.cold} disabled={busy || unknown} onChange={(_, data) => change("cold", data.checked === true)} /><DmCheckbox label="Требуется установка" checked={draft.installation} disabled={busy || unknown} onChange={(_, data) => change("installation", data.checked === true)} />
        {unknown ? <><p role="status">Ответ на сохранение не получен. Загрузите варианты и проверьте результат перед повторным изменением. Ваш ввод сохранён.</p><DmButton disabled={busy} onClick={() => void refreshOutcome()}>Проверить результат сохранения</DmButton>
          {review ? <section aria-label="Сверка доставки" className={styles.form}><p>{review.saved ? `Сохранено: ${cost(review.saved)} · от ${review.saved.minLeadTimeHours} до ${review.saved.maxLeadTimeHours ?? "не указан"} ч. Температурный режим: ${review.saved.temperatureControlled ? "да" : "нет"}; установка: ${review.saved.installationRequired ? "да" : "нет"}. Инструкции: ${review.saved.pickupInstructions ?? "не указаны"}.` : "Этот способ доставки пока не найден среди сохранённых."}</p>
            <DmButton disabled={busy} onClick={() => { setUnknown(false); if (review.saved) setEditing(review.saved.id); setReview(null); }}>Оставить мои значения</DmButton>
            {review.saved ? <DmButton disabled={busy} onClick={() => { const next = draftOf(review.saved!); setDraft(next); setBaseline(next); setEditing(review.saved!.id); setUnknown(false); setReview(null); }}>Загрузить сохранённые условия</DmButton> : null}
          </section> : null}
        </> : null}
        <EditorActions host={props.footer}><DmButton disabled={busy || unknown} onClick={back}>Отмена</DmButton><DmButton type="submit" form={formId} appearance="primary" disabled={busy || unknown || Boolean(duplicate)}>{busy ? "Сохраняем…" : "Сохранить доставку"}</DmButton></EditorActions>
      </form>}
    </> : null}
  </div>;
}

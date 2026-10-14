"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { OfferCommercialState, SaveOfferPriceInput } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, ErrorState, errorMessage, formatMoney, usePermissions } from "@marketplace/ui";
import { vatLabel, vatLegacyFields, type OfferVatInput, type VatSelection } from "@marketplace/schemas";
import { OfferVatEditor } from "../../../supplier-web/app/features/supplier-workspace/offer-vat-editor";
import { offerPriceMinor, offerPriceText } from "../../../supplier-web/app/features/supplier-workspace/offer-editor-model";
import { useWorkspace } from "./workspace";
import { EditorActions, responseStatus, useEditorGuard, type OfferEditorProps } from "./offer-editor-shared";
import styles from "./offer-editors.module.css";

type Draft = { price: string };
const draftOf = (state: OfferCommercialState): Draft => ({ price: state.price ? offerPriceText(state.price.amountMinor) : "" });
export function OfferPriceEditor(props: OfferEditorProps) {
  const { offer, footer, onCancel, onSaved } = props;
  const { api, organizationId } = useWorkspace(), has = usePermissions(), formId = useId();
  const [state, setState] = useState<OfferCommercialState | null>(null);
  const [draft, setDraft] = useState<Draft>({ price: "" });
  const [tax, setTax] = useState<OfferVatInput | undefined>(), [initialTax, setInitialTax] = useState<VatSelection | null>(null), [taxDirty, setTaxDirty] = useState(false);
  const markTaxDirty = useCallback(() => setTaxDirty(true), []);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(""), [validation, setValidation] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<OfferCommercialState | null>(null), [needsComparison, setNeedsComparison] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const pending = useRef<SaveOfferPriceInput | null>(null), flight = useRef(false);
  const priceInput = useRef<HTMLInputElement>(null);
  const dirty = taxDirty || Boolean(state && JSON.stringify(draft) !== JSON.stringify(draftOf(state)));
  const allowed = has("pricing.manage", "catalog.offer.edit") && ["MANUAL", "IMPORT"].includes(offer.sourceType);
  const locked = busy || unknown;
  useEditorGuard(props, dirty || unknown, locked);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    void (async () => {
      const warehouses = await api.listSupplierWarehouses(organizationId);
      const active = warehouses.filter(item => item.status === "ACTIVE");
      const warehouse = active.find(item => offer.inventoryBalances.some(balance => balance.warehouseId === item.id)) ?? active[0];
      if (!warehouse) throw new Error("Для изменения цены вам нужен действующий склад. Добавьте его в настройках организации и повторите загрузку.");
      const result = await api.getSupplierOfferCommercial(organizationId, offer.id, warehouse.id);
      if (!cancelled) { setState(result); setDraft(draftOf(result)); setInitialTax(result.price?.taxSnapshot?.selection ?? null); setTaxDirty(false); }
    })().catch(cause => { if (!cancelled) setError(errorMessage(cause)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // The inspector keys each editor by offer ID. Refreshes must not replace a draft.
  }, [api, organizationId, offer.id, attempt]);
  useEffect(() => { if (!loading && state) priceInput.current?.focus(); }, [loading, Boolean(state)]);
  const compare = async () => {
    if (!state) return;
    try { setConflict(await api.getSupplierOfferCommercial(organizationId, offer.id, state.warehouseId)); }
    catch { setError("Не удалось загрузить текущую цену для сравнения. Ваш ввод сохранён; повторите загрузку."); }
  };
  const save = async () => {
    if (!state || !allowed || flight.current || needsComparison) return;
    let input = pending.current;
    if (!input) {
      const errors: Record<string, string> = {};
      let amount = "";
      try { amount = String(offerPriceMinor(draft.price)); } catch (cause) { errors.price = errorMessage(cause); }
      if (!tax) errors.tax = "Выберите и подтвердите налоговые условия предложения.";
      setValidation(errors);
      if (Object.keys(errors).length) { if (errors.price) priceInput.current?.focus(); return; }
      input = { warehouseId: state.warehouseId, expectedOfferVersion: state.offerVersion, expectedBalanceVersion: state.balance?.version ?? null,
        idempotencyKey: crypto.randomUUID(), amountMinor: amount, currency: "KZT", ...vatLegacyFields(tax!.selection), tax };
      pending.current = input;
    }
    flight.current = true; setBusy(true); setError("");
    try {
      const result = await api.saveSupplierOfferPrice(organizationId, offer.id, input);
      pending.current = null; setUnknown(false); setState(result); setDraft(draftOf(result)); setInitialTax(result.price?.taxSnapshot?.selection ?? null); setTaxDirty(false);
      await onSaved("Цена сохранена. Остаток не изменён.");
    } catch (cause) {
      setError(errorMessage(cause));
      const status = responseStatus(cause);
      if (status && status >= 400 && status < 500 && status !== 408) {
        pending.current = null; setUnknown(false);
        if (status === 409) { setNeedsComparison(true); await compare(); }
      } else setUnknown(true);
    } finally { flight.current = false; setBusy(false); }
  };
  return <form id={formId} className={styles.form} onSubmit={event => { event.preventDefault(); void save(); }}>
    {loading ? <p role="status">Загружаем текущую цену…</p> : null}
    {error ? <ErrorState description={error} /> : null}
    {!loading && !state ? <DmButton onClick={() => setAttempt(value => value + 1)}>Повторить загрузку цены</DmButton> : null}
    {state ? <>
      <div className={styles.summary}><span>Текущая цена за {offer.saleUnit?.symbol ?? "единицу продажи"}</span><strong>{state.price ? formatMoney(state.price.amountMinor, state.price.currency) : "Не задана"}</strong></div>
      <DmField label={`Новая цена за ${offer.saleUnit?.symbol ?? "единицу продажи"}, ₸`} required validationMessage={validation.price} validationState={validation.price ? "error" : "none"}><DmInput input={{ ref: priceInput }} inputMode="decimal" value={draft.price} disabled={locked || !allowed} onChange={(_, data) => { setDraft(current => ({ ...current, price: data.value })); setValidation({}); }} /></DmField>
      <OfferVatEditor api={api} supplierId={organizationId} initial={initialTax} applyDefault={!state.price} disabled={locked || !allowed} onChange={setTax} onDirty={markTaxDirty} />
      {validation.tax ? <p role="alert">{validation.tax}</p> : null}
      <p className={styles.hint}>Цена за 1 {offer.saleUnit?.symbol ?? "единицу продажи"}. Единица продажи и статус публикации сохраняются.</p>
      {unknown ? <p role="status">Ответ не получен. Повторите сохранение: будет проверен тот же запрос. До получения результата форма защищена от закрытия.</p> : null}
      {needsComparison ? <section aria-label="Конфликт цены" className={styles.form}>{conflict ? <><p>Сейчас: {conflict.price ? formatMoney(conflict.price.amountMinor, conflict.price.currency) : "цена не задана"}. {vatLabel(conflict.price?.taxSnapshot?.selection)}. Ваш ввод сохранён выше.</p>
        <DmButton disabled={busy} onClick={() => { setState(conflict); setConflict(null); setNeedsComparison(false); setError(""); }}>Оставить мои значения</DmButton>
        <DmButton disabled={busy} onClick={() => { setState(conflict); setDraft(draftOf(conflict)); setInitialTax(conflict.price?.taxSnapshot?.selection ?? null); setTaxDirty(false); setConflict(null); setNeedsComparison(false); setError(""); }}>Загрузить текущие значения</DmButton></> : <DmButton onClick={() => void compare()}>Загрузить текущую цену для сравнения</DmButton>}</section> : null}
    </> : null}
    {!allowed ? <p role="status">Изменение цены недоступно вашей роли или источнику предложения.</p> : null}
    <EditorActions host={footer}><DmButton disabled={locked} onClick={onCancel}>Отмена</DmButton><DmButton type="submit" form={formId} appearance="primary" disabled={loading || busy || !state || !allowed || needsComparison}>{busy ? "Сохраняем…" : unknown ? "Повторить сохранение" : "Сохранить цену"}</DmButton></EditorActions>
  </form>;
}

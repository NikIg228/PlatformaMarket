"use client";
import { useEffect, useRef, useState } from "react";
import type { OfferCommercialState, SaveOfferStockInput, WorkspaceOffer } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, ErrorState, LoadingState, errorMessage, usePermissions, useUnsavedChanges, productWorkflowStyles as styles } from "@marketplace/ui";
import { offerQuantity } from "../../../supplier-web/app/features/supplier-workspace/offer-editor-model";
import { useWorkspace } from "./workspace";
import local from "./inventory-editor.module.css";

export type InventorySelection = { offerId: string; warehouseId: string; balanceId?: string };
export function InventoryEditor({ selection, warehouseName, onClose, onSaved, onDirtyChange }: {
  selection: InventorySelection; warehouseName?: string; onClose: () => void; onSaved: () => Promise<void>; onDirtyChange: (dirty: boolean) => void;
}) {
  const { api, organizationId } = useWorkspace(), has = usePermissions();
  const [offer, setOffer] = useState<WorkspaceOffer | null>(null), [state, setState] = useState<OfferCommercialState | null>(null);
  const [stock, setStock] = useState(""), [error, setError] = useState(""), [fieldError, setFieldError] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState<OfferCommercialState | null>(null), [notice, setNotice] = useState("");
  const [unknown, setUnknown] = useState(false), [retry, setRetry] = useState(0), [needsRefresh, setNeedsRefresh] = useState(false);
  const pending = useRef<SaveOfferStockInput | null>(null), flight = useRef(false), alive = useRef(true), input = useRef<HTMLInputElement>(null);
  const manual = Boolean(offer && ["MANUAL", "IMPORT"].includes(offer.sourceType) && !["BLOCKED", "ARCHIVED"].includes(offer.status));
  const canSave = has("inventory.adjust"), locked = busy || unknown;
  useUnsavedChanges(dirty || unknown);
  useEffect(() => { onDirtyChange(dirty || unknown); }, [dirty, unknown, onDirtyChange]);
  useEffect(() => {
    alive.current = true; let cancelled = false;
    setLoading(true); setError("");
    void Promise.all([api.workspaceOffer(selection.offerId), api.getSupplierOfferCommercial(organizationId, selection.offerId, selection.warehouseId)])
      .then(([nextOffer, next]) => {
        if (cancelled) return;
        if (selection.balanceId && next.balance?.id !== selection.balanceId) throw new Error("Выбранный остаток больше не относится к этому предложению. Откройте его заново из списка.");
        setOffer(nextOffer); setState(next); setStock(next.balance?.quantityOnHand ?? "0");
        requestAnimationFrame(() => input.current?.focus());
      }).catch(cause => { if (!cancelled) setError(errorMessage(cause)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; alive.current = false; };
  }, [api, organizationId, selection.offerId, selection.warehouseId, selection.balanceId, retry]);
  const save = async () => {
    if (!state || !manual || !canSave || flight.current || conflict || needsRefresh) return;
    setFieldError("");
    if (!pending.current) {
      try { pending.current = { warehouseId: selection.warehouseId, expectedOfferVersion: state.offerVersion, expectedBalanceVersion: state.balance?.version ?? null,
        idempotencyKey: crypto.randomUUID(), quantityOnHand: offerQuantity(stock, true) }; }
      catch (cause) { setFieldError(errorMessage(cause)); input.current?.focus(); return; }
    }
    flight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const result = await api.saveSupplierOfferStock(organizationId, selection.offerId, pending.current);
      if (!alive.current) return;
      setState(result); setStock(result.balance?.quantityOnHand ?? "0"); setDirty(false); setUnknown(false); pending.current = null;
      setNotice("Остаток сохранён. Цена и публикация товара не изменены.");
      try { await onSaved(); } catch { if (alive.current) setError("Остаток сохранён, но список не удалось обновить. Повторите загрузку списка."); }
    } catch (cause) {
      if (!alive.current) return;
      setError(errorMessage(cause));
      const status = cause && typeof cause === "object" && "status" in cause ? cause.status : undefined;
      if (typeof status === "number" && status >= 400 && status < 500 && status !== 408) {
        pending.current = null; setUnknown(false);
        if (status === 409) {
          setNeedsRefresh(true);
          try { const next = await api.getSupplierOfferCommercial(organizationId, selection.offerId, selection.warehouseId); if (alive.current) { setConflict(next); setNeedsRefresh(false); } }
          catch { /* The entered amount stays intact; a failed conflict read must not enable another write. */ }
        }
      } else setUnknown(true);
    } finally { flight.current = false; if (alive.current) setBusy(false); }
  };
  const refreshConflict = async () => {
    if (flight.current) return;
    flight.current = true; setBusy(true);
    try { const next = await api.getSupplierOfferCommercial(organizationId, selection.offerId, selection.warehouseId); if (alive.current) { setConflict(next); setNeedsRefresh(false); } }
    catch (cause) { if (alive.current) setError(errorMessage(cause)); }
    finally { flight.current = false; if (alive.current) setBusy(false); }
  };
  return <section className={styles.panel} aria-label="Редактирование остатка">
    <form className={`${styles.form} ${local.form}`} onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className={styles.toolbar}><h2>Обновить остаток</h2><DmButton type="button" disabled={busy} onClick={onClose}>Закрыть</DmButton></div>
      {loading ? <LoadingState label="Загружаем остаток товара" /> : null}
      {error ? <ErrorState description={error} action={!state && !loading ? <DmButton type="button" onClick={() => setRetry(value => value + 1)}>Повторить загрузку товара</DmButton> : undefined} /> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {offer && state ? <>
        <div><h3>{offer.productVariant.product.canonicalName}</h3><p className={styles.hint}>{offer.packaging?.name ?? offer.saleUnit?.nameRu} · {warehouseName ?? offer.inventoryBalances.find(item => item.warehouseId === selection.warehouseId)?.warehouse.name ?? "Выбранный склад"}</p></div>
        {!manual ? <p role="status">Это предложение недоступно для ручного изменения. Для подключённого источника обновите количество в его системе учёта.</p> : !canSave ? <p role="status">Для изменения остатка нужно право на корректировку запасов.</p> : null}
        <DmField className={local.field} label={`На складе, ${offer.saleUnit?.symbol ?? "ед. продажи"}`} hint="Фактическое количество до вычета резервов и страхового запаса." validationMessage={fieldError || undefined} validationState={fieldError ? "error" : "none"}>
          <DmInput input={{ ref: input }} inputMode="decimal" value={stock} disabled={locked || !manual || !canSave} onChange={(_, data) => { setStock(data.value); setDirty(true); setFieldError(""); setNotice(""); }} />
        </DmField>
        <p className={styles.hint}>В резерве: {state.balance?.quantityReserved ?? "0"} · Страховой запас: {state.balance?.safetyStock ?? "0"} · Доступно сейчас: {state.balance?.quantityAvailable ?? "0"}</p>
        {unknown ? <p role="status">Ответ не получен. Повтор сохранения проверит тот же запрос без повторного изменения остатка.</p> : null}
        {needsRefresh ? <DmButton type="button" disabled={busy} onClick={() => void refreshConflict()}>Загрузить текущий остаток для сравнения</DmButton> : null}
        {conflict ? <section aria-label="Конфликт остатка"><p>Остаток изменился. Сейчас на складе {conflict.balance?.quantityOnHand ?? "0"}, в резерве {conflict.balance?.quantityReserved ?? "0"}. Ваше значение {stock} сохранено в поле.</p><div className={styles.toolbar}>
          <DmButton type="button" onClick={() => { setState(conflict); setConflict(null); setError(""); }}>Оставить моё значение</DmButton>
          <DmButton type="button" onClick={() => { setState(conflict); setStock(conflict.balance?.quantityOnHand ?? "0"); setConflict(null); setDirty(false); setError(""); }}>Загрузить текущее значение</DmButton>
        </div></section> : null}
        {manual && canSave ? <div className={local.actions}><DmButton type="submit" appearance="primary" disabled={busy || Boolean(conflict) || needsRefresh}>{busy ? "Сохраняем…" : unknown ? "Повторить сохранение остатка" : "Сохранить остаток"}</DmButton></div> : null}
      </> : null}
    </form>
  </section>;
}

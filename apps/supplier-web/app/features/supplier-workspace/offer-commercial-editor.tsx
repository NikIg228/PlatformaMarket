"use client";
import { ActionFeedback } from "@marketplace/ui";
import { useEffect, useRef, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import type { OfferCommercialState, SaveOfferCommercialInput, SaveOfferPriceInput, SupplierWarehouseList } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmDropdown as DmSelect, ErrorState, errorMessage, formatMoney, usePermissions } from "@marketplace/ui";
import { offerPriceMinor, offerPriceText, offerQuantity } from "./offer-editor-model";

type Draft = { stock: string; baseline: OfferCommercialState["balance"] };
export function OfferCommercialEditor({ api, supplierId, offerId, warehouses, initialWarehouseId, onChanged, onWarehouseChange, onWarehousesChange, stockEditable = true }: {
  api: MarketplaceApiClient; supplierId: string; offerId: string; warehouses: SupplierWarehouseList; initialWarehouseId?: string;
  onChanged: () => Promise<void>; onWarehouseChange: (id: string) => void; onWarehousesChange: (warehouses: SupplierWarehouseList) => void;
  stockEditable?: boolean;
}) {
  const has = usePermissions();
  const activeWarehouses = warehouses.filter(warehouse => warehouse.status === "ACTIVE");
  const [warehouseId, setWarehouseId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [price, setPrice] = useState("");
  const [includesVat, setIncludesVat] = useState(true);
  const [vatRate, setVatRate] = useState("");
  const [offerVersion, setOfferVersion] = useState<number | null>(null);
  const [publication, setPublication] = useState<{ status: string; visible: boolean } | null>(null);
  const [conflict, setConflict] = useState<OfferCommercialState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [unknownOutcome, setUnknownOutcome] = useState(false);
  const [saved, setSaved] = useState(false);
  const pending = useRef<SaveOfferCommercialInput | SaveOfferPriceInput | null>(null);
  const inFlight = useRef(false);
  const alive = useRef(true);
  const initializedPrice = useRef(false);
  const selectedDraft = drafts[warehouseId];
  const locked = busy || unknownOutcome;
  const canSave = stockEditable ? has("pricing.manage", "inventory.adjust") : has("pricing.manage");

  const acceptState = (state: OfferCommercialState, replaceInput: boolean) => {
    setOfferVersion(state.offerVersion);
    setPublication({ status: state.publicationStatus, visible: state.marketplaceVisible });
    setDrafts(current => ({ ...current, [state.warehouseId]: { stock: replaceInput ? state.balance?.quantityOnHand ?? "0" : current[state.warehouseId]?.stock ?? "0", baseline: state.balance } }));
    if (replaceInput) {
      setPrice(state.price ? offerPriceText(state.price.amountMinor) : "");
      setIncludesVat(state.price?.includesVat ?? true); setVatRate(state.price?.vatRate ?? "");
    }
  };
  const selectWarehouse = async (id: string) => {
    if (inFlight.current || unknownOutcome) return;
    if (!id) { setWarehouseId(""); onWarehouseChange(""); return; }
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      if (!drafts[id]) {
        const state = await api.getSupplierOfferCommercial(supplierId, offerId, id);
        if (!alive.current) return;
        setDrafts(current => ({ ...current, [id]: { stock: state.balance?.quantityOnHand ?? "0", baseline: state.balance } }));
        if (!initializedPrice.current) { acceptState(state, true); initializedPrice.current = true; }
      }
      if (alive.current) { setWarehouseId(id); onWarehouseChange(id); setSaved(false); setConflict(null); }
    } catch (cause) { if (alive.current) setError(errorMessage(cause)); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  useEffect(() => {
    alive.current = true;
    if (initialWarehouseId && activeWarehouses.some(warehouse => warehouse.id === initialWarehouseId)) void selectWarehouse(initialWarehouseId);
    return () => { alive.current = false; };
    // The parent keys this editor by offer ID. Later reads never reset its drafts.
  }, []);

  const refreshWarehouses = async () => {
    if (inFlight.current || unknownOutcome) return;
    inFlight.current = true; setBusy(true);
    try {
      const next = await api.listSupplierWarehouses(supplierId);
      if (!alive.current) return;
      onWarehousesChange(next);
      if (!next.some(warehouse => warehouse.id === warehouseId && warehouse.status === "ACTIVE")) {
        setWarehouseId(""); onWarehouseChange(""); setSaved(false);
        setError("Выбранный склад недоступен. Черновик сохранён; выберите действующий склад.");
      }
    } catch (cause) { if (alive.current) setError(errorMessage(cause)); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  const save = async () => {
    if (!canSave) return;
    if (inFlight.current || !selectedDraft || offerVersion === null || conflict) return;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      if (!pending.current) {
        const rate = vatRate.trim() ? Number(vatRate.replace(",", ".")) : null;
        if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) throw new Error("Ставка НДС должна быть от 0 до 100%.");
        pending.current = { warehouseId, expectedOfferVersion: offerVersion, expectedBalanceVersion: selectedDraft.baseline?.version ?? null,
          idempotencyKey: crypto.randomUUID(), amountMinor: String(offerPriceMinor(price)), currency: "KZT", includesVat, vatRate: rate,
          ...(stockEditable ? { quantityOnHand: offerQuantity(selectedDraft.stock, true) } : {}) };
      }
      const result = stockEditable && "quantityOnHand" in pending.current
        ? await api.saveSupplierOfferCommercial(supplierId, offerId, pending.current)
        : await api.saveSupplierOfferPrice(supplierId, offerId, pending.current);
      if (!alive.current) return;
      pending.current = null; setUnknownOutcome(false); setSaved(true); acceptState(result, true);
      setNotice(`${stockEditable ? "Цена и остаток сохранены." : "Цена сохранена. Остаток не изменён."} ${result.marketplaceVisible ? "Предложение остаётся опубликованным." : "Предложение не опубликовано."}`);
      try { await onChanged(); } catch { if (alive.current) setError("Условия сохранены, но список не удалось обновить. Обновите список вручную."); }
    } catch (cause) {
      if (!alive.current) return;
      const status = cause && typeof cause === "object" && "status" in cause ? cause.status : undefined;
      setError(errorMessage(cause));
      if (typeof status === "number" && status >= 400 && status < 500 && status !== 408) {
        pending.current = null; setUnknownOutcome(false);
        if (status === 409) {
          try { const current = await api.getSupplierOfferCommercial(supplierId, offerId, warehouseId); if (alive.current) setConflict(current); }
          catch { /* Keep entered values and the original error if refresh fails. */ }
        }
      } else if (pending.current) setUnknownOutcome(true);
    } finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  const publish = async () => {
    if (!has("catalog.offer.publish")) return;
    if (inFlight.current || !saved || offerVersion === null) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const result = await api.setSupplierOfferPublication(supplierId, offerId, { status: "PUBLISHED", marketplaceVisible: true, expectedVersion: offerVersion });
      if (!alive.current) return;
      setOfferVersion(result.offerVersion); setPublication({ status: result.status, visible: result.marketplaceVisible });
      setNotice("Предложение опубликовано. Цена и остаток доступны клиникам.");
      try { await onChanged(); } catch { if (alive.current) setError("Предложение опубликовано, но список не удалось обновить. Обновите список вручную."); }
    } catch (cause) { if (alive.current) setError(errorMessage(cause)); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  return <form className="mp-stack" onSubmit={event => { event.preventDefault(); void save(); }}>
    <h3>{stockEditable ? "Цена и остаток" : "Цена"}</h3>
    {error ? <ErrorState description={error} /> : null}
    {notice ? <ActionFeedback tone="success" description={notice} /> : null}
    {unknownOutcome ? <p role="status">Ответ не получен. Повтор сохранения проверит прежний запрос; введённые условия сохранены.</p> : null}
    <DmField label="Склад"><DmSelect value={warehouseId} disabled={locked} onChange={(_, data) => void selectWarehouse(data.value)}>
      <option value="">Выберите склад</option>{activeWarehouses.map(warehouse => <option value={warehouse.id} key={warehouse.id}>{warehouse.name}</option>)}
    </DmSelect></DmField>
    <DmButton type="button" disabled={locked} onClick={() => void refreshWarehouses()}>Обновить склады</DmButton>
    {!activeWarehouses.length ? <p role="alert">Нет действующего склада. Добавьте склад в настройках организации.</p> : null}
    <DmField label="Цена за упаковку, ₸"><DmInput inputMode="decimal" value={price} disabled={locked || !selectedDraft} onChange={(_, data) => { setPrice(data.value); setSaved(false); }} /></DmField>
    <DmField label="НДС в цене"><DmSelect value={includesVat ? "included" : "excluded"} disabled={locked || !selectedDraft} onChange={(_, data) => { setIncludesVat(data.value === "included"); setSaved(false); }}><option value="included">Включён в цену</option><option value="excluded">Без НДС</option></DmSelect></DmField>
    <DmField label="Ставка НДС, % (если применима)"><DmInput inputMode="decimal" value={vatRate} disabled={locked || !selectedDraft} onChange={(_, data) => { setVatRate(data.value); setSaved(false); }} /></DmField>
    {stockEditable ? <DmField label="Остаток, упаковок" hint="Фактический остаток выбранного склада. Количество другого склада сюда не переносится."><DmInput inputMode="decimal" value={selectedDraft?.stock ?? ""} disabled={locked || !selectedDraft} onChange={(_, data) => { setDrafts(current => ({ ...current, [warehouseId]: { ...current[warehouseId]!, stock: data.value } })); setSaved(false); }} /></DmField> : <a href={`/supplier/products/inventory?offer=${offerId}&edit=1${warehouseId ? `&warehouse=${warehouseId}` : ""}${selectedDraft?.baseline ? `&balance=${selectedDraft.baseline.id}` : ""}`}>Обновить остатки</a>}
    {selectedDraft ? <p>Зарезервировано: {selectedDraft.baseline?.quantityReserved ?? "0"}. Доступно по последним данным: {selectedDraft.baseline?.quantityAvailable ?? "0"}.</p> : null}
    {conflict ? <section aria-label="Конфликт условий"><p>Текущая цена: {conflict.price ? formatMoney(conflict.price.amountMinor, conflict.price.currency) : "не задана"}. НДС: {conflict.price?.includesVat ? "включён" : "не включён"}, ставка {conflict.price?.vatRate ?? "не указана"}. Остаток на складе: {conflict.balance?.quantityOnHand ?? "0"}; резерв: {conflict.balance?.quantityReserved ?? "0"}. Ваши значения оставлены в полях выше.</p>
      <DmButton type="button" disabled={busy} onClick={() => { acceptState(conflict, false); setConflict(null); setError(""); setNotice(`Проверьте свои значения и нажмите «${stockEditable ? "Сохранить условия" : "Сохранить цену"}».`); }}>Применить мои значения вместо текущих</DmButton>
      <DmButton type="button" disabled={busy} onClick={() => { acceptState(conflict, true); setConflict(null); setError(""); }}>Загрузить текущие значения</DmButton>
    </section> : null}
    {!canSave ? <p role="status">{stockEditable ? "Для сохранения цены и остатка нужны права на обе операции." : "Для сохранения цены нужно право на управление ценами."} Ввод сохранён.</p> : null}
    <DmButton type="submit" appearance="primary" disabled={busy || !selectedDraft || Boolean(conflict) || !canSave}>{busy ? "Сохраняем…" : unknownOutcome ? "Повторить сохранение" : stockEditable ? "Сохранить условия" : "Сохранить цену"}</DmButton>
    {saved && !publication?.visible ? <section aria-label="Проверка перед публикацией"><h3>Проверьте перед публикацией</h3><p>{formatMoney(String(offerPriceMinor(price)), "KZT")} за упаковку · остаток {selectedDraft?.stock} · {activeWarehouses.find(item => item.id === warehouseId)?.name}</p><DmButton type="button" disabled={busy || !has("catalog.offer.publish")} onClick={() => void publish()}>Опубликовать предложение</DmButton>{!has("catalog.offer.publish") ? <p>Публикация недоступна вашей роли.</p> : null}</section> : null}
    <p>{stockEditable ? "Цена и остаток сохраняются вместе." : "Остаток изменяется на странице «Остатки»."} Публикация — отдельное действие с проверкой договора и допуска поставщика.</p>
  </form>;
}

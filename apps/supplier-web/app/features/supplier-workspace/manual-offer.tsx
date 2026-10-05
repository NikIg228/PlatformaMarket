"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import type { OfferOption, OfferOptionsResponse, SupplierWarehouseList } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmDropdown as DmSelect, ErrorState, Section, errorMessage, usePermissions } from "@marketplace/ui";
import { offerQuantity } from "./offer-editor-model";
import type { Offer } from "./types";
import { OfferDelivery } from "./offer-delivery";
import { OfferCommercialEditor } from "./offer-commercial-editor";
import formStyles from "./product-forms.module.css";

export function ManualOffer({ api, supplierId, onChanged, initialOffer, initiallyOpen = false, initialProposal, hideHeading = false }: {
  api: MarketplaceApiClient; supplierId: string; onChanged: () => Promise<void>; initialOffer?: Offer; initiallyOpen?: boolean;
  initialProposal?: { proposedName: string; proposedSku: string | null; proposedBrand: string | null; proposedGtin: string | null; description?: string | null };
  hideHeading?: boolean;
}) {
  const has = usePermissions();
  const [open, setOpen] = useState(initiallyOpen);
  const [query, setQuery] = useState(initialProposal?.proposedName ?? "");
  const [result, setResult] = useState<OfferOptionsResponse | null>(null);
  const [searched, setSearched] = useState("");
  const [selected, setSelected] = useState<OfferOption | null>(null);
  const [packId, setPackId] = useState("");
  const [warehouses, setWarehouses] = useState<SupplierWarehouseList>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [sku, setSku] = useState(initialProposal?.proposedSku ?? "");
  const [minimum, setMinimum] = useState("1");
  const [increment, setIncrement] = useState("1");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [packAssigned, setPackAssigned] = useState(false);
  const [proposal, setProposal] = useState(Boolean(initialProposal));
  const [description, setDescription] = useState(initialProposal?.description ?? "");
  const [brand, setBrand] = useState(initialProposal?.proposedBrand ?? "");
  const [gtin, setGtin] = useState(initialProposal?.proposedGtin ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    if (!initialOffer) return;
    if (!["MANUAL", "IMPORT"].includes(initialOffer.sourceType)) {
      setOpen(true); setError("Предложение управляется интеграцией. Изменяйте источник и коммерческие данные в настройках подключения.");
      return;
    }
    let cancelled = false;
    setOpen(true); setBusy(true); inFlight.current = true;
    void Promise.all([api.searchOfferOptions({ variantId: initialOffer.productVariantId }), api.listSupplierWarehouses(supplierId)])
      .then(([options, available]) => {
        if (cancelled) return;
        const option = options.items.find(item => item.id === initialOffer.productVariantId);
        if (!option) throw new Error("Вариант снят с публикации. Обратитесь к оператору каталога.");
        const balance = initialOffer.inventoryBalances[0];
        setSelected(option); setCreatedId(initialOffer.id); setSku(initialOffer.supplierSku ?? "");
        setPackId(initialOffer.packaging?.id ?? option.packagings[0]?.id ?? "");
        setWarehouses(available.filter(warehouse => warehouse.status === "ACTIVE")); setWarehouseId(balance?.warehouseId ?? "");
        setMinimum(initialOffer.minimumOrderQuantity ?? "1"); setIncrement(initialOffer.orderIncrement ?? "1");
      }).catch(cause => { if (!cancelled) setError(errorMessage(cause)); })
      .finally(() => { if (!cancelled) { setBusy(false); inFlight.current = false; } });
    return () => { cancelled = true; };
  }, [api, supplierId, initialOffer]);
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null); setNotice(null);
    try { await action(); } catch (cause) { setError(errorMessage(cause)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const search = (more = false) => run(async () => {
    const nextQuery = more ? searched : query.trim();
    const response = await api.searchOfferOptions({ q: nextQuery, limit: 20, ...(more && result?.nextCursor ? { cursor: result.nextCursor } : {}) });
    setResult(current => ({ ...response, items: more ? [...(current?.items ?? []), ...response.items] : response.items }));
    setSearched(nextQuery);
  });
  const select = (option: OfferOption) => run(async () => {
    const available = await api.listSupplierWarehouses(supplierId);
    setWarehouses(available.filter(warehouse => warehouse.status === "ACTIVE"));
    setSelected(option); setPackId(option.packagings[0]?.id ?? ""); setWarehouseId("");
  });
  const save = () => run(async () => {
    if (!has("catalog.offer.edit")) throw new Error("Нет права редактировать предложение. Ввод сохранён.");
    if (initialOffer && !["MANUAL", "IMPORT"].includes(initialOffer.sourceType)) throw new Error("Ручная форма не меняет данные подключённого источника.");
    const packaging = selected?.packagings.find(pack => pack.id === packId);
    if (!selected || !packaging) throw new Error("Выберите товар и упаковку.");
    const minimumOrderQuantity = offerQuantity(minimum);
    const orderIncrement = offerQuantity(increment);
    let id = createdId;
    if (id && initialOffer && !initialOffer.packaging?.id && !packAssigned) {
      if (!initialOffer.version) throw new Error("Обновите список предложений перед назначением упаковки.");
      await api.assignSupplierOfferPackaging(supplierId, id, { packagingId: packaging.id, version: initialOffer.version });
      setPackAssigned(true);
    }
    if (!id) {
      const offer = await api.createSupplierOffer(supplierId, {
        productVariantId: selected.id, packagingId: packaging.id, saleUnitId: packaging.unitId,
        baseUnitsPerSaleUnit: Number(packaging.quantityInBaseUnit), supplierSku: sku.trim() || null,
        minimumOrderQuantity, orderIncrement, sourceType: "MANUAL", confirmationMode: "MANUAL",
      });
      id = offer.id; setCreatedId(id);
    }
    setNotice(initialOffer ? "Упаковка назначена. Проверьте цену и остаток ниже." : "Черновик создан. Укажите цену и остаток, затем опубликуйте предложение.");
    await onChanged();
  });
  const submit = () => run(async () => {
    if (!has("catalog.offer.edit")) throw new Error("Нет права отправить заявку. Ввод сохранён.");
    if (query.trim().length < 3 || !description.trim()) throw new Error("Укажите название товара и сведения для модератора.");
    if (gtin && !/^\d{8,14}$/.test(gtin)) throw new Error("Штрихкод должен содержать от 8 до 14 цифр.");
    const response = await api.submitProductCandidate({ proposedName: query.trim(), proposedSku: sku.trim() || null,
      proposedBrand: brand.trim() || null, proposedGtin: gtin || null, rawSubmission: { description: description.trim() } });
    setNotice(`Заявка ${response.candidate.id.slice(0, 8)} отправлена на модерацию. Публикация возможна после создания мастер-карточки.${response.duplicateSuggestions.length ? " Найдены похожие товары: " + response.duplicateSuggestions.map(item => item.canonicalName).join(", ") : ""}`);
    setProposal(false);
    await onChanged();
  });
  return <Section className={formStyles.panel} title={hideHeading ? undefined : initialOffer ? "Редактировать предложение" : "Добавить товар"}>
    {!initialOffer && !initialProposal ? <ol className={formStyles.steps} aria-label="Этапы добавления"><li aria-current={!selected ? "step" : undefined}>1. Товар</li><li aria-current={selected && !createdId ? "step" : undefined}>2. Упаковка</li><li aria-current={createdId ? "step" : undefined}>3. Условия и публикация</li></ol> : null}
    {!open ? <DmButton appearance="primary" onClick={() => setOpen(true)}>Добавить предложение вручную</DmButton> : <div className="mp-stack">
      {error ? <ErrorState description={error} /> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {!has("catalog.offer.edit") ? <p role="status">Создание и изменение предложения недоступны вашей роли. Ввод сохранён.</p> : null}
      {!selected ? <>
        <form onSubmit={event => { event.preventDefault(); void search(); }}>
          <DmField label="Товар, артикул или штрихкод"><DmInput value={query} maxLength={160} disabled={busy} onChange={(_, data) => setQuery(data.value)} /></DmField>
          <DmButton type="submit" disabled={busy}>{busy ? "Загружаем…" : "Найти в мастер-каталоге"}</DmButton>
        </form>
        {result?.items.length === 0 ? <p>Товар не найден. Измените запрос или отправьте заявку модератору.</p> : null}
        {result?.items.map(option => <div key={option.id}>
          <strong>{option.name}</strong><p>Артикул: {option.sku ?? "не указан"} · Штрихкод: {option.gtin ?? "не указан"}</p>
          <DmButton disabled={busy || !option.packagings.length} onClick={() => void select(option)}>Выбрать {option.sku ?? option.name}</DmButton>
          {!option.packagings.length ? <p>У варианта пока нет утверждённой упаковки. Обратитесь к оператору каталога.</p> : null}
        </div>)}
        {result?.nextCursor ? <DmButton disabled={busy} onClick={() => void search(true)}>Показать ещё варианты</DmButton> : null}
        <DmButton disabled={busy} onClick={() => setProposal(!proposal)}>Нет нужного товара — заявка модератору</DmButton>
        {proposal ? <form onSubmit={event => { event.preventDefault(); void submit(); }} className="mp-stack">
          <DmField label="Название нового товара" required><DmInput value={query} maxLength={160} disabled={busy} onChange={(_, data) => setQuery(data.value)} /></DmField>
          <DmField label="Артикул нового товара"><DmInput value={sku} maxLength={120} disabled={busy} onChange={(_, data) => setSku(data.value)} /></DmField>
          <DmField label="Бренд"><DmInput value={brand} maxLength={160} disabled={busy} onChange={(_, data) => setBrand(data.value)} /></DmField>
          <DmField label="Штрихкод нового товара"><DmInput value={gtin} maxLength={14} disabled={busy} onChange={(_, data) => setGtin(data.value)} /></DmField>
          <DmField label="Описание, упаковка и ссылка на материалы"><DmInput value={description} maxLength={2000} disabled={busy} onChange={(_, data) => setDescription(data.value)} /></DmField>
          <DmButton type="submit" disabled={busy || !has("catalog.offer.edit")}>Отправить заявку</DmButton>
        </form> : null}
      </> : <><form onSubmit={event => { event.preventDefault(); void save(); }} className="mp-stack">
        <h3>{selected.name}</h3>
        {!createdId ? <DmButton type="button" disabled={busy} onClick={() => setSelected(null)}>Выбрать другой товар</DmButton> : <p>Предложение создано. Цена, остаток и публикация редактируются ниже.</p>}
        <DmField label="Упаковка предложения"><DmSelect value={packId} disabled={busy || packAssigned || Boolean(createdId && (!initialOffer || initialOffer.packaging?.id))} onChange={(_, data) => setPackId(data.value)}>
          {selected.packagings.map(pack => <option key={pack.id} value={pack.id}>{pack.name} · {pack.quantityInBaseUnit} базовых единиц · {pack.unit}</option>)}
        </DmSelect></DmField>
        <DmField label="Артикул поставщика"><DmInput value={sku} maxLength={120} disabled={busy || Boolean(createdId)} onChange={(_, data) => setSku(data.value)} /></DmField>
        <DmField label="Минимальная партия, упаковок"><DmInput value={minimum} disabled={busy || Boolean(createdId)} onChange={(_, data) => setMinimum(data.value)} /></DmField>
        <DmField label="Шаг заказа, упаковок"><DmInput value={increment} disabled={busy || Boolean(createdId)} onChange={(_, data) => setIncrement(data.value)} /></DmField>
        {!createdId || Boolean(initialOffer && !initialOffer.packaging?.id && !packAssigned) ? <DmButton type="submit" appearance="primary" disabled={busy || !has("catalog.offer.edit")}>{busy ? "Сохраняем…" : createdId ? "Назначить упаковку" : "Создать черновик предложения"}</DmButton> : null}
      </form>
      {createdId && (!initialOffer || initialOffer.packaging?.id || packAssigned) ? <OfferCommercialEditor key={createdId} api={api} supplierId={supplierId} offerId={createdId}
        warehouses={warehouses} initialWarehouseId={warehouseId} onWarehouseChange={setWarehouseId} onWarehousesChange={setWarehouses} onChanged={onChanged} /> : null}
      </>}
      {createdId && selected ? <OfferDelivery key={createdId} api={api} supplierId={supplierId} offerId={createdId} warehouses={warehouses} defaultWarehouseId={warehouseId} /> : null}
    </div>}
  </Section>;
}

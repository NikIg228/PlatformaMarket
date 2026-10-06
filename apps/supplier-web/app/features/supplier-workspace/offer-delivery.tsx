"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import type { OfferDeliveryOptionResponse, SupplierWarehouseList } from "@marketplace/schemas";
import { DmButton, DmCheckbox, DmField, DmInput, DmDropdown as DmSelect, ErrorState, Section, errorMessage, formatStatus, PermissionFields } from "@marketplace/ui";
import { offerPriceMinor, offerPriceText } from "./offer-editor-model";

const methods = { PICKUP: "Самовывоз", SUPPLIER_CITY: "Доставка поставщиком по городу", NATIONWIDE: "По Казахстану", CARRIER: "Транспортная компания", SPECIAL: "Специальная доставка" } as const;
type Method = keyof typeof methods;
export function OfferDelivery({ api, supplierId, offerId, warehouses, defaultWarehouseId, initiallyOpen = false, onSaved }: {
  api: MarketplaceApiClient; supplierId: string; offerId: string; warehouses: SupplierWarehouseList; defaultWarehouseId: string;
  initiallyOpen?: boolean; onSaved?: () => void;
}) {
  const [options, setOptions] = useState<OfferDeliveryOptionResponse[] | null>(null);
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);
  const [method, setMethod] = useState<string>("PICKUP");
  const [priceType, setPriceType] = useState("PRICE_ON_REQUEST");
  const [fixed, setFixed] = useState("");
  const [threshold, setThreshold] = useState("");
  const [minimum, setMinimum] = useState("0");
  const [maximum, setMaximum] = useState("");
  const [instructions, setInstructions] = useState("");
  const [cold, setCold] = useState(false);
  const [installation, setInstallation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    if (!initiallyOpen) return;
    let cancelled = false;
    setBusy(true); inFlight.current = true;
    void api.listOfferDeliveryOptions(supplierId, offerId)
      .then(items => { if (!cancelled) setOptions(items); })
      .catch(cause => { if (!cancelled) setError(errorMessage(cause)); })
      .finally(() => { if (!cancelled) { setBusy(false); inFlight.current = false; } });
    return () => { cancelled = true; };
  }, [api, supplierId, offerId, initiallyOpen]);
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null); setNotice(null);
    try { await action(); } catch (cause) { setError(errorMessage(cause)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const fill = (option: OfferDeliveryOptionResponse) => {
    if (option.currency !== "KZT") { setError("Эта форма работает с условиями в тенге. Условия в другой валюте требуют отдельного согласования."); return; }
    setWarehouseId(option.warehouseId); setMethod(option.method); setPriceType(option.priceType);
    setFixed(option.fixedAmountMinor === null ? "" : offerPriceText(option.fixedAmountMinor));
    setThreshold(option.freeFromAmountMinor === null ? "" : offerPriceText(option.freeFromAmountMinor));
    setMinimum(String(option.minLeadTimeHours)); setMaximum(option.maxLeadTimeHours === null ? "" : String(option.maxLeadTimeHours));
    setInstructions(option.pickupInstructions ?? ""); setCold(option.temperatureControlled); setInstallation(option.installationRequired);
  };
  const save = () => run(async () => {
    if (!/^\d+$/.test(minimum) || (maximum && !/^\d+$/.test(maximum))) throw new Error("Срок указывается целым числом часов.");
    const money = (value: string) => /^0(?:[.,]0{1,2})?$/.test(value.trim()) ? 0 : offerPriceMinor(value);
    const { createOfferDeliveryOptionSchema } = await import("@marketplace/schemas");
    const parsed = createOfferDeliveryOptionSchema.safeParse({ warehouseId, method, priceType, currency: "KZT",
      fixedAmountMinor: ["FIXED", "FREE_FROM_AMOUNT"].includes(priceType) ? money(fixed) : null,
      freeFromAmountMinor: priceType === "FREE_FROM_AMOUNT" ? money(threshold) : null,
      minLeadTimeHours: Number(minimum), maxLeadTimeHours: maximum ? Number(maximum) : null,
      pickupInstructions: instructions.trim() || null, temperatureControlled: cold, installationRequired: installation,
    });
    if (!parsed.success) throw new Error("Проверьте склад, стоимость и сроки: от 0 до 8760 часов, верхняя граница не меньше нижней.");
    const saved = await api.saveOfferDeliveryOption(supplierId, offerId, parsed.data);
    setOptions(current => [...(current ?? []).filter(item => item.id !== saved.id), saved]);
    setNotice("Условия доставки сохранены и доступны клинике при сравнении предложений.");
    onSaved?.();
  });
  return <PermissionFields required={["delivery.view", "delivery.manage"]}><Section title="Условия доставки предложения" description="Укажите сроки подготовки и доставки. Выбор транспортной компании здесь не создаёт отправление.">
    {error ? <ErrorState description={error} /> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {options === null ? <DmButton disabled={busy} onClick={() => void run(async () => setOptions(await api.listOfferDeliveryOptions(supplierId, offerId)))}>Настроить доставку</DmButton> : <div className="mp-stack">
      {!options.length ? <p>Условия доставки ещё не указаны.</p> : options.map(option => <div key={option.id}>
        <span>{methods[option.method as Method] ?? formatStatus(option.method)} · {warehouses.find(item => item.id === option.warehouseId)?.name ?? "Склад недоступен"} · от {option.minLeadTimeHours} ч.{option.maxLeadTimeHours === null ? "" : ` до ${option.maxLeadTimeHours} ч.`}</span>
        <DmButton disabled={busy} onClick={() => fill(option)}>Изменить условия</DmButton>
      </div>)}
      <form className="mp-stack" onSubmit={event => { event.preventDefault(); void save(); }}>
        <p>Для того же склада и способа условия обновятся. Другой способ добавляется отдельным вариантом.</p>
        <DmField label="Склад отправления"><DmSelect value={warehouseId} disabled={busy} onChange={(_, data) => setWarehouseId(data.value)}><option value="">Выберите склад</option>{warehouses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</DmSelect></DmField>
        <DmField label="Способ доставки"><DmSelect value={method} disabled={busy} onChange={(_, data) => setMethod(data.value)}>{Object.entries(methods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}{!Object.hasOwn(methods, method) ? <option value={method}>{formatStatus(method)}</option> : null}</DmSelect></DmField>
        <DmField label="Стоимость доставки"><DmSelect value={priceType} disabled={busy} onChange={(_, data) => setPriceType(data.value)}><option value="PRICE_ON_REQUEST">По согласованию</option><option value="FREE">Бесплатно</option><option value="FIXED">Фиксированная</option><option value="FREE_FROM_AMOUNT">Бесплатно от суммы</option></DmSelect></DmField>
        {["FIXED", "FREE_FROM_AMOUNT"].includes(priceType) ? <DmField label="Цена доставки, ₸"><DmInput inputMode="decimal" value={fixed} disabled={busy} onChange={(_, data) => setFixed(data.value)} /></DmField> : null}
        {priceType === "FREE_FROM_AMOUNT" ? <DmField label="Бесплатно от суммы, ₸"><DmInput inputMode="decimal" value={threshold} disabled={busy} onChange={(_, data) => setThreshold(data.value)} /></DmField> : null}
        <DmField label="Минимальный срок, часов"><DmInput inputMode="numeric" value={minimum} disabled={busy} onChange={(_, data) => setMinimum(data.value)} /></DmField>
        <DmField label="Максимальный срок, часов"><DmInput inputMode="numeric" value={maximum} disabled={busy} onChange={(_, data) => setMaximum(data.value)} /></DmField>
        <DmField label="Инструкции по получению"><DmInput maxLength={1000} value={instructions} disabled={busy} onChange={(_, data) => setInstructions(data.value)} /></DmField>
        <DmCheckbox label="Температурный режим" checked={cold} disabled={busy} onChange={(_, data) => setCold(data.checked === true)} />
        <DmCheckbox label="Требуется установка" checked={installation} disabled={busy} onChange={(_, data) => setInstallation(data.checked === true)} />
        <DmButton type="submit" disabled={busy}>Сохранить доставку</DmButton>
      </form>
    </div>}
  </Section></PermissionFields>;
}

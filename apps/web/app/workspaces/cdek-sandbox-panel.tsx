"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import { cdekSandboxQuoteInputSchema, type CdekCities, type CdekSandboxQuote } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmSelect, Section } from "@marketplace/ui";
import { LoadingState } from "@marketplace/ui/loading-state";
import { ErrorState } from "@marketplace/ui/primitives";
import { formatMoney } from "@marketplace/ui/money";
import styles from "./cdek-sandbox.module.css";

const copy = {
  ru: { title: "Доставка СДЭК: тестовый расчёт", notice: "Учебные тарифы. Расчёт не меняет сумму заказа и не создаёт отправление.", from: "Город отправления", to: "Город получения", search: "Найти город", choose: "Выберите город", none: "Город не найден в учебном справочнике. Уточните название.", cityLoading: "Ищем города…", weight: "Вес с упаковкой, г", length: "Длина, см", width: "Ширина, см", height: "Высота, см", calculate: "Рассчитать доставку", calculating: "Рассчитываем доставку…", loading: "Проверяем тестовое подключение…", disabled: "Тестовое подключение не настроено на сервере.", retry: "Повторить проверку", failed: "Не удалось получить данные СДЭК. Повторите попытку, введённые данные сохранены.", invalid: "Выберите оба города и укажите целые положительные вес и размеры упаковки.", empty: "Для этого маршрута и упаковки учебный API не вернул тарифов.", tariff: "Учебный тариф", select: "Выберите тариф", chosen: "Выбран для тестового расчёта. В заказ не сохранён.", days: "дн.", package: "Одно грузовое место", modes: ["", "От двери до двери", "От двери до ПВЗ", "От ПВЗ до двери", "От ПВЗ до ПВЗ"] },
  kk: { title: "СДЭК жеткізуі: сынақ есебі", notice: "Оқу тарифтері. Есеп тапсырыс сомасын өзгертпейді және жөнелтілім жасамайды.", from: "Жөнелту қаласы", to: "Алу қаласы", search: "Қаланы табу", choose: "Қаланы таңдаңыз", none: "Қала оқу анықтамалығында табылмады. Атауын нақтылаңыз.", cityLoading: "Қалалар ізделуде…", weight: "Қаптамамен салмағы, г", length: "Ұзындығы, см", width: "Ені, см", height: "Биіктігі, см", calculate: "Жеткізуді есептеу", calculating: "Жеткізу есептелуде…", loading: "Сынақ қосылымы тексерілуде…", disabled: "Серверде сынақ қосылымы бапталмаған.", retry: "Қайта тексеру", failed: "СДЭК деректері алынбады. Қайта көріңіз, енгізілген деректер сақталды.", invalid: "Екі қаланы таңдап, қаптаманың салмағы мен өлшемдерін оң бүтін сандармен көрсетіңіз.", empty: "Оқу API осы бағыт пен қаптама үшін тарифтерді қайтармады.", tariff: "Оқу тарифі", select: "Тарифті таңдаңыз", chosen: "Сынақ есебі үшін таңдалды. Тапсырысқа сақталмады.", days: "күн", package: "Бір жүк орны", modes: ["", "Есіктен есікке", "Есіктен беру пунктіне", "Беру пунктінен есікке", "Беру пунктінен беру пунктіне"] },
};
type Text = typeof copy.ru;
function CityField({ api, orderId, label, text, onChange, disabled }: { api: MarketplaceApiClient; orderId: string; label: string; text: Text; onChange: (code: number | null) => void; disabled: boolean }) {
  const id = useId();
  const [query, setQuery] = useState(""), [rows, setRows] = useState<CdekCities | null>(null), [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const search = async () => {
    if (query.trim().length < 2 || busy) return;
    const current = ++generation.current; setBusy(true); setError(false); setRows(null); setSelected(""); onChange(null);
    try { const result = await api.cdekSandboxCities(orderId, query.trim()); if (generation.current === current) setRows(result); }
    catch { if (generation.current === current) setError(true); }
    finally { if (generation.current === current) setBusy(false); }
  };
  return <div className={styles.stack}>
    <DmField label={label}><DmInput id={id} aria-label={label} value={query} maxLength={100} disabled={disabled || busy} onChange={(_, data) => { generation.current++; setQuery(data.value); setRows(null); setSelected(""); onChange(null); }} /></DmField>
    <DmButton disabled={disabled || busy || query.trim().length < 2} onClick={() => void search()} aria-label={`${text.search}: ${label}`}>{text.search}</DmButton>
    {busy ? <LoadingState presentation="inline" label={text.cityLoading} /> : null}
    {error ? <ErrorState title="" description={text.failed} presentation="inline" /> : null}
    {rows?.length === 0 ? <p role="status">{text.none}</p> : null}
    {rows && rows.length > 0 ? <DmField label={`${label}: ${text.choose}`}><DmSelect aria-label={`${label}: ${text.choose}`} value={selected} disabled={disabled || busy} onChange={(_, data) => { setSelected(data.value); onChange(data.value ? Number(data.value) : null); }}>
      <option value="">{text.choose}</option>{rows.map(row => <option key={row.code} value={row.code}>{row.city}{row.region ? ` (${row.region})` : ""}</option>)}
    </DmSelect></DmField> : null}
  </div>;
}

export function CdekSandboxPanel({ api, orderId, locale = "ru" }: { api: MarketplaceApiClient; orderId: string; locale?: "ru" | "kk" }) {
  const text = copy[locale];
  const [enabled, setEnabled] = useState<boolean | null>(null), [connectionError, setConnectionError] = useState(false), [attempt, setAttempt] = useState(0);
  const [from, setFrom] = useState<number | null>(null), [to, setTo] = useState<number | null>(null);
  const [parcel, setParcel] = useState({ weight: "", length: "", width: "", height: "" });
  const [result, setResult] = useState<CdekSandboxQuote | null>(null), [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const generation = useRef(0), lock = useRef(false);
  const chosenTariff = result?.tariffs.find(row => String(row.code) === selected);
  useEffect(() => {
    let alive = true; setEnabled(null); setConnectionError(false);
    void api.cdekSandboxStatus(orderId).then(value => { if (alive) setEnabled(value.enabled); }).catch(() => { if (alive) setConnectionError(true); });
    return () => { alive = false; generation.current++; };
  }, [api, orderId, attempt]);
  const invalidate = () => { generation.current++; setResult(null); setSelected(""); setError(""); };
  const calculate = async () => {
    if (lock.current) return;
    const parsed = cdekSandboxQuoteInputSchema.safeParse({ fromCityCode: from, toCityCode: to, packages: [Object.fromEntries(Object.entries(parcel).map(([key, value]) => [key, Number(value)]))] });
    if (!parsed.success) { setError(text.invalid); return; }
    invalidate(); const current = generation.current; lock.current = true; setBusy(true);
    try { const quote = await api.cdekSandboxQuote(orderId, parsed.data); if (generation.current === current) setResult(quote); }
    catch { if (generation.current === current) setError(text.failed); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Section title={text.title} description={text.notice}>
    {connectionError ? <ErrorState title="" description={text.failed} presentation="inline" action={<DmButton onClick={() => setAttempt(value => value + 1)}>{text.retry}</DmButton>} /> : enabled === null ? <LoadingState label={text.loading} /> : !enabled ? <p role="status">{text.disabled}</p> : <div className={styles.stack}>
      <div className={styles.form}>
        <CityField api={api} orderId={orderId} label={text.from} text={text} disabled={busy} onChange={code => { invalidate(); setFrom(code); }} />
        <CityField api={api} orderId={orderId} label={text.to} text={text} disabled={busy} onChange={code => { invalidate(); setTo(code); }} />
      </div>
      <p>{text.package}</p>
      <div className={styles.form}>{(["weight", "length", "width", "height"] as const).map(key => <DmField label={text[key]} key={key} required><DmInput aria-label={text[key]} type="number" min={1} max={key === "weight" ? 100000 : 300} step={1} value={parcel[key]} disabled={busy} onChange={(_, data) => { invalidate(); setParcel(previous => ({ ...previous, [key]: data.value })); }} /></DmField>)}</div>
      {error ? <ErrorState title="" description={error} presentation="inline" /> : null}
      <DmButton appearance="primary" onClick={() => void calculate()} disabled={busy}>{text.calculate}</DmButton>
      {busy ? <LoadingState presentation="inline" label={text.calculating} /> : null}
      {result?.tariffs.length === 0 ? <p role="status">{text.empty}</p> : null}
      {result && result.tariffs.length > 0 ? <DmField label={text.tariff}><DmSelect aria-label={text.tariff} value={selected} onChange={(_, data) => setSelected(data.value)}>
        <option value="">{text.select}</option>{result.tariffs.map(row => <option key={row.code} value={row.code}>{row.name}: {text.modes[row.deliveryMode]}, {formatMoney(row.amountMinor, result.currency)}, {row.minDays}–{row.maxDays} {text.days}</option>)}
      </DmSelect></DmField> : null}
      {chosenTariff && result ? <div role="status"><p>{chosenTariff.name}: {text.modes[chosenTariff.deliveryMode]}, {formatMoney(chosenTariff.amountMinor, result.currency)}, {chosenTariff.minDays}–{chosenTariff.maxDays} {text.days}</p><p>{text.chosen}</p></div> : null}
    </div>}
  </Section>;
}

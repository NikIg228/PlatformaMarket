"use client";

import { useState } from "react";
import { lookupJanaPostLocal, type MarketplaceApiClient } from "@marketplace/api-client";
import type { JanaPostLocalCity, JanaPostLocalResult } from "@marketplace/schemas";
import { DmButton, DmField, DmSelect, Section } from "@marketplace/ui";
import { LoadingState } from "@marketplace/ui/loading-state";
import styles from "./workspace.module.css";
import panelStyles from "./janapost-local-panel.module.css";

const copy = {
  ru: {
    title: "JanaPost · тестовый режим", description: "Выберите город, чтобы проверить список ПВЗ и статус тестовой посылки.",
    city: "Город", point: "Пункт выдачи", choose: "Выберите пункт", search: "Проверить доставку",
    loading: "Загружаем пункты выдачи…", failed: "Не удалось загрузить данные. Повторите проверку.",
    empty: "В этом городе нет тестовых ПВЗ. Выберите другой город.",
    arrived: "Посылка в пункте выдачи", almaty: "Алматы", astana: "Астана", shymkent: "Шымкент",
  },
  kk: {
    title: "JanaPost · сынақ режимі", description: "Беру пункттері мен сынақ сәлемдемесінің күйін тексеру үшін қаланы таңдаңыз.",
    city: "Қала", point: "Беру пункті", choose: "Пунктті таңдаңыз", search: "Жеткізуді тексеру",
    loading: "Беру пункттері жүктелуде…", failed: "Деректер жүктелмеді. Қайталап көріңіз.",
    empty: "Бұл қалада сынақ беру пункттері жоқ. Басқа қаланы таңдаңыз.",
    arrived: "Сәлемдеме беру пунктінде", almaty: "Алматы", astana: "Астана", shymkent: "Шымкент",
  },
};
const cities = ["almaty", "astana", "shymkent"] as const;

export function JanaPostLocalPanel({ api, orderId, locale }: {
  api: MarketplaceApiClient;
  orderId: string;
  locale: keyof typeof copy;
}) {
  const t = copy[locale];
  const [city, setCity] = useState<JanaPostLocalCity>("almaty");
  const [result, setResult] = useState<JanaPostLocalResult | null>(null);
  const [point, setPoint] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function lookup() {
    setBusy(true);
    setFailed(false);
    try {
      setResult(await lookupJanaPostLocal(api, orderId, city));
      setPoint("");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return <Section title={t.title} description={t.description} className={panelStyles.section}>
    <div className={`${styles.stack} ${panelStyles.body}`}>
      <DmField label={t.city}>
        <DmSelect aria-label={t.city} value={city} disabled={busy} onChange={(_, data) => {
          const next = cities.find(value => value === data.value);
          if (!next) return;
          setCity(next);
          setResult(null);
          setPoint("");
          setFailed(false);
        }}>
          {cities.map(value => <option key={value} value={value}>{t[value]}</option>)}
        </DmSelect>
      </DmField>
      <div><DmButton disabled={busy} onClick={() => void lookup()}>{t.search}</DmButton></div>
      {busy ? <LoadingState presentation="inline" label={t.loading} /> : null}
      {failed ? <p role="alert">{t.failed}</p> : null}
      {result && <div className={styles.stack}>
        {result.points.length ? <DmField label={t.point}>
          <DmSelect aria-label={t.point} value={point} onChange={(_, data) => setPoint(data.value)}>
            <option value="">{t.choose}</option>
            {result.points.map((row, index) => <option key={row.code} value={row.code}>
              {t[city]} · {t.point} {index + 1}
            </option>)}
          </DmSelect>
        </DmField> : <p role="status">{t.empty}</p>}
        <p role="status">{result.tracking.number} · {t.arrived}</p>
      </div>}
    </div>
  </Section>;
}

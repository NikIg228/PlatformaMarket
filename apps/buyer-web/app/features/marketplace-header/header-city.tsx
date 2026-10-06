"use client";
import { DmCheckbox } from "@marketplace/ui/controls";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DmButton as Button } from "@marketplace/ui/controls";
import { ChevronDown20Regular } from "@fluentui/react-icons/svg/chevron-down";
import { useDeliveryContext } from "./delivery-context";
import styles from "./header.module.css";
const CityPicker = dynamic(() => import("./city-picker"), { loading: () => <p role="status">Загружаем список…</p> });
export function HeaderCity({ toolbar = false }: { toolbar?: boolean }) {
  const delivery = useDeliveryContext(); const root = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = (e: Event) => { if (root.current && !root.current.contains(e.target as Node)) root.current.open = false; };
    document.addEventListener("pointerdown", close);
    // A label may blur to body before forwarding activation to its input.
    document.addEventListener("focusin", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("focusin", close);
    };
  }, []);
  return <details ref={root} className={`${styles.city} ${toolbar ? styles.cityToolbar : ""}`} onToggle={e => setOpen(e.currentTarget.open)} onKeyDown={e => { if (e.key === "Escape" && root.current) { root.current.open = false; root.current.querySelector("summary")?.focus(); } }}>
    <summary className={!delivery.city ? styles.cityUnselected : undefined} aria-label={delivery.city ? `Город: ${delivery.city.nameRu}` : "Выберите город"}><span>{delivery.city?.nameRu ?? "Выберите город"}{delivery.city && delivery.message ? <small className={styles.cityNotice}>Выберите город</small> : null}</span><ChevronDown20Regular aria-hidden="true" className={styles.cityChevron} /></summary>
    <div className={styles.cityPanel}><strong>Город доставки</strong>
      <p>Уточняет доступность предложений и условия доставки. Адрес подтвердим при оформлении заказа.</p>
      {!delivery.ready ? <p role="status">Загружаем города…</p> : <>
        {delivery.message ? <p role="alert">{delivery.message}</p> : null}
        {open ? <CityPicker /> : null}
        <DmCheckbox checked={delivery.inCity} disabled={!delivery.city} onChange={e => delivery.choose(delivery.city?.id ?? "", e.target.checked)} label="Доступно в выбранном городе" className={styles.check} />
        {!delivery.cities.length ? <Button onClick={delivery.retry}>Повторить загрузку городов</Button> : null}
      </>}
    </div>
  </details>;
}

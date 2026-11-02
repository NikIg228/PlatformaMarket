"use client";
import { DmButton, DmFeedback, DmField, DmHeading, DmInput, Section, formatMoney } from "@marketplace/ui";
import type { PersonalCart, PersonalCartValidation, CartLineSnapshotResponse } from "@marketplace/schemas";
import type { PersonalCartCopy } from "./copy";
import styles from "./personal-cart.module.css";

export function validPersonalQuantity(value: string, snapshot: CartLineSnapshotResponse) {
  const quantity = Number(value), min = Number(snapshot.minimumOrderQuantity), step = Number(snapshot.orderIncrement);
  const count = (quantity - min) / step;
  return value.trim() !== "" && Number.isFinite(quantity) && quantity > 0 && quantity <= 1_000_000 && quantity >= min && step > 0
    && /^\d+(?:\.\d{1,6})?$/.test(value) && Math.abs(count - Math.round(count)) < 1e-9;
}
function conditions(snapshot: CartLineSnapshotResponse, t: PersonalCartCopy) {
  const terms = snapshot.commercialTerms;
  return [
    [t.unit, formatMoney(snapshot.unitPriceMinor, snapshot.currency)],
    [t.line, formatMoney(snapshot.totalPriceMinor, snapshot.currency)],
    [t.stock, snapshot.availableQuantity ?? "—"],
    [t.availability, snapshot.fulfillmentStatus === "AVAILABLE" ? t.available : snapshot.fulfillmentStatus === "OUT_OF_STOCK" ? t.outOfStock : t.insufficient],
    [t.min, snapshot.minimumOrderQuantity], [t.step, snapshot.orderIncrement],
    [t.saleUnit, terms?.saleUnitName ?? "—"], [t.packaging, terms?.packagingName ?? "—"], [t.baseUnits, terms?.baseUnitsPerSaleUnit ?? "—"],
    [t.promotion, snapshot.promotion ? `${snapshot.promotion.name}${snapshot.promotion.gift ? ` · ${snapshot.promotion.gift.name} × ${snapshot.promotion.gift.quantity}` : ""}` : t.noPromotion],
    [t.tax, snapshot.tax ? formatMoney(snapshot.tax.vatMinor, snapshot.currency) : terms?.vatRate ? `${terms.vatRate}%` : "—"],
  ];
}
export function PersonalCartItem({ item, checked, draft, busy, t, onDraft, onSave, onRemove, onAccept }: {
  item: PersonalCart["items"][number]; checked?: PersonalCartValidation["items"][number]; draft?: string; busy: boolean; t: PersonalCartCopy;
  onDraft: (value: string) => void; onSave: () => void; onRemove: () => void; onAccept: () => void;
}) {
  const value = draft ?? item.snapshot.quantity;
  const valid = validPersonalQuantity(value, item.snapshot);
  const previous = conditions(item.snapshot, t), current = checked?.current ? conditions(checked.current, t) : null;
  return <Section><article className={styles.row} aria-label={item.name}>
    <div className={styles.details}>
      <DmHeading level={2} title={item.name} />
      <p className={styles.text}>{item.supplierName}</p>
      <dl className={styles.values}>{previous.slice(0, 2).map(([label, field]) => <div key={label}><dt>{label}</dt><dd>{field}</dd></div>)}</dl>
      <p className={styles.text}>{t.packaging}: {item.snapshot.commercialTerms?.packagingName ?? item.snapshot.commercialTerms?.saleUnitName ?? "—"}</p>
    </div>
    <div className={styles.editor}>
      <div className={styles.quantity}><DmField label={t.quantity} validationState={valid ? "none" : "error"} validationMessage={!valid ? t.invalid : undefined}>
        <DmInput type="number" min={item.snapshot.minimumOrderQuantity} step={item.snapshot.orderIncrement} max={1_000_000}
          aria-label={`${t.quantity}: ${item.name}`} value={value} disabled={busy} onChange={(_, data) => onDraft(data.value)} />
      </DmField></div>
      <p className={styles.text}>{t.current}: {item.snapshot.quantity} · {t.min}: {item.snapshot.minimumOrderQuantity} · {t.step}: {item.snapshot.orderIncrement}</p>
      <div className={styles.actions}>
        <DmButton disabled={busy || !valid || value === item.snapshot.quantity} onClick={onSave}>{t.save}</DmButton>
        <DmButton disabled={busy} onClick={onRemove} aria-label={`${t.remove}: ${item.name}`}>{t.remove}</DmButton>
      </div>
    </div>
    {checked && !checked.current ? <div className={styles.diff}><DmFeedback presentation="note" tone="warning" title={t.unavailable} description={t.unavailableText} /></div> : null}
    {checked?.requiresAcceptance && current ? <div className={styles.diff}>
      <DmFeedback presentation="note" tone="warning" title={t.changed} description={t.check} />
      <dl className={styles.values} aria-label={t.terms}>{current.map(([label, field], index) => previous[index][1] !== field ? <div key={label}><dt>{label}</dt><dd><del>{previous[index][1]}</del> → <strong>{field}</strong></dd></div> : null)}</dl>
      <DmButton appearance="primary" disabled={busy || draft !== undefined && draft !== item.snapshot.quantity} onClick={onAccept}>{t.accept}</DmButton>
    </div> : null}
  </article></Section>;
}

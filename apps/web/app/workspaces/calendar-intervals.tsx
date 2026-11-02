"use client";
import { DmButton, DmField, DmInput } from "@marketplace/ui";
import { calendarCopy, type CalendarLocale } from "./calendar-copy";
import type { IntervalDraft } from "./calendar-draft";
import styles from "./calendar.module.css";

export function CalendarIntervals({ value, onChange, disabled, label, error, locale }: {
  value: IntervalDraft[]; onChange: (value: IntervalDraft[]) => void; disabled: boolean;
  label: string; error?: string; locale: CalendarLocale;
}) {
  const t = calendarCopy[locale];
  return <div className={styles.intervals}>
    {value.length === 0 ? <p className={styles.text}>{t.off}</p> : null}
    {value.map((interval, index) => <div key={index} className={styles.interval}>
      {(["from", "to"] as const).map(field => <DmField key={field} className={styles.time} label={t[field]} validationState={error ? "error" : "none"}>
        <DmInput value={interval[field]} aria-label={`${label} · ${index + 1} · ${t[field]}`} aria-invalid={!!error}
          placeholder={field === "from" ? "09:00" : "18:00"} maxLength={5} disabled={disabled}
          onChange={(_, data) => onChange(value.map((row, at) => at === index ? { ...row, [field]: data.value } : row))} />
      </DmField>)}
      <DmButton disabled={disabled} aria-label={`${t.remove} · ${label} · ${index + 1}`} onClick={() => onChange(value.filter((_, at) => at !== index))}>{t.remove}</DmButton>
    </div>)}
    {error ? <DmField validationState="error" validationMessage={error} /> : null}
    <div className={styles.actions}><DmButton disabled={disabled || value.length >= 8} aria-label={`${t.add} · ${label}`}
      onClick={() => onChange([...value, { from: value.at(-1)?.to ?? "09:00", to: "18:00" }])}>{t.add}</DmButton></div>
  </div>;
}

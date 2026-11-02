"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveSupplierCalendar, SupplierCalendarResponse } from "@marketplace/schemas";
import { DmButton, DmDisclosureSummary, DmDropdown, DmFeedback, DmField, DmHeading, DmInput, DmSurface,
  ErrorState, LoadingState, errorMessage, useSaveToast, useUnsavedChanges } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { calendarCopy, type CalendarLocale } from "./calendar-copy";
import { calendarDraft, parseCalendarDraft } from "./calendar-draft";
import { calendarHolidays, holidaySource } from "./calendar-holidays";
import { CalendarIntervals } from "./calendar-intervals";
import styles from "./calendar.module.css";

export function SettingsCalendar({ onDirtyChange, locale }: { onDirtyChange: (dirty: boolean) => void; locale: CalendarLocale }) {
  const { api, organizationId } = useWorkspace(), t = calendarCopy[locale];
  const load = useCallback(() => api.getSupplierCalendar(), [api]);
  const resource = useResource(load, { automatic: false });
  if (!resource.data) return resource.error ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>{t.retry}</DmButton>} /> : <LoadingState label={t.loading} />;
  return <CalendarEditor key={organizationId} initial={resource.data} onDirtyChange={onDirtyChange} locale={locale} />;
}

function CalendarEditor({ initial, onDirtyChange, locale }: {
  initial: SupplierCalendarResponse; onDirtyChange: (dirty: boolean) => void; locale: CalendarLocale;
}) {
  const { api } = useWorkspace(), notify = useSaveToast(), t = calendarCopy[locale];
  const [saved, setSaved] = useState(initial), [draft, setDraft] = useState(() => calendarDraft(initial.calendar));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const lock = useRef(false), alive = useRef(true), form = useRef<HTMLFormElement>(null);
  const retry = useRef<{ signature: string; input: SaveSupplierCalendar } | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(calendarDraft(saved.calendar));
  const disabled = busy || !saved.canEdit;
  useUnsavedChanges(dirty || busy);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onDirtyChange(dirty || busy); return () => onDirtyChange(false); }, [dirty, busy, onDirtyChange]);
  async function save() {
    if (lock.current || !saved.canEdit) return;
    const parsed = parseCalendarDraft(draft);
    if (!parsed.success) {
      setIssues(parsed.error.issues.map(issue => issue.path.join(".")));
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const signature = JSON.stringify({ ...parsed.data, expectedVersion: saved.version });
    if (retry.current?.signature !== signature) retry.current = { signature, input: { ...parsed.data, expectedVersion: saved.version, idempotencyKey: crypto.randomUUID() } };
    lock.current = true; setBusy(true); setError(""); setIssues([]);
    try {
      const result = await api.saveSupplierCalendar(retry.current.input);
      if (!alive.current) return;
      setSaved(result); setDraft(calendarDraft(result.calendar)); retry.current = null; notify(t.saved);
    } catch (cause) { if (alive.current) setError(errorMessage(cause)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function reload() {
    if (lock.current || (dirty && !window.confirm(t.confirm))) return;
    lock.current = true; setBusy(true);
    try {
      const result = await api.getSupplierCalendar();
      if (!alive.current) return;
      setSaved(result); setDraft(calendarDraft(result.calendar)); retry.current = null; setError(""); setIssues([]);
    } catch (cause) { if (alive.current) setError(errorMessage(cause)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const hasIssue = (path: string) => issues.some(issue => issue === path || issue.startsWith(`${path}.`));
  const zones = [...new Set(["Asia/Almaty", "Asia/Qyzylorda", "Asia/Aqtobe", "Asia/Aqtau", "Asia/Atyrau", "Asia/Oral", "Asia/Qostanay", draft.timezone])];
  return <DmSurface className={styles.card} lang={locale}>
    <DmHeading title={t.title} />
    <p className={styles.text}>{t.intro}</p>
    {saved.source === "DEFAULT" ? <DmFeedback presentation="note" tone="neutral" title={t.week} description={t.fallback} /> : null}
    {!saved.canEdit ? <DmFeedback presentation="note" tone="neutral" title={t.title} description={t.readonly} /> : null}
    <form ref={form} className={styles.form} onSubmit={event => { event.preventDefault(); void save(); }}>
      <DmField className={styles.zone} label={t.zone} validationState={hasIssue("timezone") ? "error" : "none"}>
        <DmDropdown value={draft.timezone} disabled={disabled} onChange={(_, data) => setDraft(value => ({ ...value, timezone: data.value }))}>
          {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
        </DmDropdown>
      </DmField>
      <section className={styles.section} aria-label={t.week}>
        <h3 className={styles.heading}>{t.week}</h3><p className={styles.text}>{t.intervals}</p>
        {issues.includes("week") ? <DmField validationState="error" validationMessage={t.validation} /> : null}
        <div className={styles.days}>{draft.week.map((day, index) => <div key={day.day} className={styles.day}>
          <h4 className={styles.heading}>{t.days[day.day - 1]}</h4>
          <CalendarIntervals value={day.intervals} label={t.days[day.day - 1]!} locale={locale} disabled={disabled}
            error={hasIssue(`week.${index}`) ? t.timeError : undefined}
            onChange={intervals => setDraft(value => ({ ...value, week: value.week.map(row => row.day === day.day ? { ...row, intervals } : row) }))} />
        </div>)}</div>
      </section>
      <section className={styles.section} aria-label={t.exceptions}>
        <h3 className={styles.heading}>{t.exceptions}</h3><p className={styles.text}>{t.exceptionHelp}</p>
        {draft.exceptions.length === 0 ? <p className={styles.text}>{t.empty}</p> : null}
        <div className={styles.days}>{draft.exceptions.map((day, index) => <div key={index} className={styles.day}>
          <DmField className={styles.date} label={`${t.date} · ${index + 1}`} validationState={issues.includes("exceptions") || hasIssue(`exceptions.${index}.date`) ? "error" : "none"}
            validationMessage={issues.includes("exceptions") || hasIssue(`exceptions.${index}.date`) ? t.dateError : undefined}>
            <DmInput type="date" value={day.date} disabled={disabled} aria-invalid={issues.includes("exceptions") || hasIssue(`exceptions.${index}.date`)}
              onChange={(_, data) => setDraft(value => ({ ...value, exceptions: value.exceptions.map((row, at) => at === index ? { ...row, date: data.value } : row) }))} />
          </DmField>
          {calendarHolidays.filter(holiday => holiday.dates.includes(day.date)).map(holiday => <p className={styles.text} key={holiday.ru}>{holiday[locale]}</p>)}
          {day.date && !day.date.startsWith("2026-") ? <p className={styles.text}>{t.unknownYear}</p> : null}
          <CalendarIntervals value={day.intervals} label={`${t.date} ${index + 1}`} locale={locale} disabled={disabled}
            error={hasIssue(`exceptions.${index}.intervals`) ? t.timeError : undefined}
            onChange={intervals => setDraft(value => ({ ...value, exceptions: value.exceptions.map((row, at) => at === index ? { ...row, intervals } : row) }))} />
          <div className={styles.actions}><DmButton disabled={disabled} aria-label={`${t.removeDate} · ${index + 1}`} onClick={() => setDraft(value => ({ ...value, exceptions: value.exceptions.filter((_, at) => at !== index) }))}>{t.removeDate}</DmButton></div>
        </div>)}</div>
        <div className={styles.actions}><DmButton disabled={disabled || draft.exceptions.length >= 366} onClick={() => setDraft(value => ({ ...value, exceptions: [...value.exceptions, { date: "", intervals: [] }] }))}>{t.addDate}</DmButton></div>
      </section>
      <details className={styles.section}>
        <DmDisclosureSummary>{t.holidays}</DmDisclosureSummary>
        <p className={styles.text}>{t.holidayHelp}</p>
        <ul className={styles.holidays}>{calendarHolidays.map(holiday => <li key={holiday.ru}>{holiday.dates.map(date => date.slice(5).split("-").reverse().join(".")).join(", ")} · {holiday[locale]}</li>)}</ul>
        <a href={holidaySource} target="_blank" rel="noopener noreferrer">{t.source}</a>
      </details>
      {issues.length ? <DmFeedback presentation="note" tone="danger" title={t.invalid} description={t.validation} alert /> : null}
      {error ? <DmFeedback presentation="note" tone="danger" title={t.error} description={`${error} ${t.draftKept}`} alert
        action={<DmButton disabled={busy} onClick={() => void reload()}>{t.reload}</DmButton>} /> : null}
      <div className={styles.actions}><DmButton type="submit" appearance="primary" disabled={disabled || (!dirty && saved.source !== "DEFAULT")}>{busy ? t.saving : t.save}</DmButton></div>
    </form>
  </DmSurface>;
}

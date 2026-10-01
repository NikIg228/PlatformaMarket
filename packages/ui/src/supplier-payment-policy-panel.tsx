"use client";
import { useRef, useState } from "react";
import { supplierPaymentPolicyFieldsSchema, type SaveSupplierPaymentPolicy, type SupplierPaymentPolicyFields, type SupplierPaymentPolicyResponse } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmSelect, DmFeedback, Section, errorMessage } from "./index";

export type PaymentPolicyApi = {
  getSupplierPaymentPolicy(): Promise<SupplierPaymentPolicyResponse>;
  saveSupplierPaymentPolicy(input: SaveSupplierPaymentPolicy): Promise<SupplierPaymentPolicyResponse>;
};
const days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const timeValue = (minute: number) => `${Math.floor(minute / 60).toString().padStart(2, "0")}:${(minute % 60).toString().padStart(2, "0")}`;
const minuteValue = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; };

export function SupplierPaymentPolicyPanel({ api, onSaved }: { api: PaymentPolicyApi; onSaved: () => Promise<void> }) {
  const [state, setState] = useState<SupplierPaymentPolicyResponse | null>(null);
  const [draft, setDraft] = useState<SupplierPaymentPolicyFields | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const writing = useRef(false);
  const pending = useRef<{ signature: string; input: SaveSupplierPaymentPolicy } | null>(null);
  const load = async () => {
    if (writing.current) return;
    writing.current = true; setBusy(true); setError("");
    try {
      const next = await api.getSupplierPaymentPolicy(); setState(next);
      setDraft(current => current ?? next.policy ?? { primaryUserId: "", backupUserId: "", timezone: "Asia/Almaty", workingWindows: [] });
    } catch (cause) { setError(errorMessage(cause)); }
    finally { writing.current = false; setBusy(false); }
  };
  const save = async () => {
    if (!state || !draft || writing.current) return;
    const parsed = supplierPaymentPolicyFieldsSchema.safeParse(draft);
    if (!parsed.success) { setError(parsed.error.issues.map(issue => issue.message).join(". ")); return; }
    writing.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const signature = JSON.stringify(parsed.data);
      if (pending.current && pending.current.signature !== signature) throw new Error("Результат прошлого сохранения неизвестен. Повторите с прежними настройками.");
      pending.current ??= { signature, input: { ...parsed.data, expectedVersion: state.version, idempotencyKey: crypto.randomUUID() } };
      const next = await api.saveSupplierPaymentPolicy(pending.current.input);
      pending.current = null; setState(next); setDraft(next.policy); setNotice("Настройки сохранены. Они применятся к новым заявлениям о переводе.");
      await onSaved();
    } catch (cause) {
      const status = cause && typeof cause === "object" && "status" in cause ? cause.status : undefined;
      if (typeof status === "number" && status >= 400 && status < 500 && status !== 408) pending.current = null;
      setError(errorMessage(cause));
    } finally { writing.current = false; setBusy(false); }
  };
  return <Section title="Ответственные за проверку оплаты">
    <p>Настройка общая для заказов поставщика. Напоминание основному сотруднику — через 15 рабочих минут, резервному — через 30, обращение в поддержку — через 60. Укажите фактический график, включая перерывы.</p>
    {error ? <DmFeedback tone="danger" title="Настройки не сохранены" description={error} /> : null}
    {notice ? <DmFeedback tone="success" title="Готово" description={notice} /> : null}
    <DmButton disabled={busy} onClick={() => void load()}>{busy ? "Загрузка…" : state ? "Обновить версию настроек, сохранив ввод" : "Открыть настройки проверки"}</DmButton>
    {state && draft ? <div style={{ display: "grid", gap: 12 }}>
      {state.eligibleMembers.length < 2 ? <DmFeedback tone="warning" title="Нужны два ответственных сотрудника" description="Назначьте двум активным сотрудникам право подтверждения переводов в настройках организации." /> : null}
      <DmField label="Основной ответственный"><DmSelect value={draft.primaryUserId} disabled={busy} onChange={(_, d) => setDraft({ ...draft, primaryUserId: d.value })}><option value="">Выберите сотрудника</option>{state.eligibleMembers.map(member => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}</DmSelect></DmField>
      <DmField label="Резервный ответственный"><DmSelect value={draft.backupUserId} disabled={busy} onChange={(_, d) => setDraft({ ...draft, backupUserId: d.value })}><option value="">Выберите сотрудника</option>{state.eligibleMembers.map(member => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}</DmSelect></DmField>
      <DmField label="Часовой пояс" hint="Например, Asia/Almaty"><DmInput value={draft.timezone} disabled={busy} onChange={(_, d) => setDraft({ ...draft, timezone: d.value })} /></DmField>
      {!draft.workingWindows.length ? <p>Рабочие периоды пока не указаны.</p> : null}
      {draft.workingWindows.map((window, index) => <div key={index} style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 12 }}>
        <DmField label={`Период ${index + 1}: день`}><DmSelect disabled={busy} value={String(window.day)} onChange={(_, d) => setDraft({ ...draft, workingWindows: draft.workingWindows.map((item, i) => i === index ? { ...item, day: Number(d.value) } : item) })}>{days.map((day, i) => <option key={day} value={i + 1}>{day}</option>)}</DmSelect></DmField>
        <DmField label={`Период ${index + 1}: начало`}><DmInput disabled={busy} type="time" value={timeValue(window.fromMinute)} onChange={(_, d) => setDraft({ ...draft, workingWindows: draft.workingWindows.map((item, i) => i === index ? { ...item, fromMinute: d.value ? minuteValue(d.value) : item.fromMinute } : item) })} /></DmField>
        <DmField label={`Период ${index + 1}: конец`} hint="00:00 означает конец суток"><DmInput type="time" disabled={busy} value={timeValue(window.toMinute === 1440 ? 0 : window.toMinute)} onChange={(_, d) => setDraft({ ...draft, workingWindows: draft.workingWindows.map((item, i) => i === index ? { ...item, toMinute: d.value ? minuteValue(d.value) || 1440 : item.toMinute } : item) })} /></DmField>
        <DmButton disabled={busy} onClick={() => setDraft({ ...draft, workingWindows: draft.workingWindows.filter((_, i) => i !== index) })}>Удалить период {index + 1}</DmButton>
      </div>)}
      <DmButton disabled={busy || draft.workingWindows.length >= 28} onClick={() => setDraft({ ...draft, workingWindows: [...draft.workingWindows, { day: 1, fromMinute: 540, toMinute: 1080 }] })}>Добавить рабочий период</DmButton>
      <DmButton disabled={busy || state.eligibleMembers.length < 2} onClick={() => void save()}>Сохранить график и ответственных</DmButton>
    </div> : null}
  </Section>;
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OfferPromotion, OfferPromotionCommand, PromotionPage } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmSelect, EmptyState, ErrorState, LoadingState, Section, errorMessage, formatDate, formatMoney } from "./index";
import { PromotionEditor } from "./promotion-editor";
import { promotionLabels as labels, promotionLocalDate, type PromotionWorkspaceApi } from "./promotion-workspace-types";

function PromotionCard({ item, api, operator, reload, edit }: { item: OfferPromotion; api: PromotionWorkspaceApi; operator: boolean; reload: () => Promise<void>; edit: (template: boolean) => void }) {
  const [reason, setReason] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [starts, setStarts] = useState(promotionLocalDate(item.placementStartsAt ?? new Date(Math.ceil(Date.parse(item.terms.startsAt) / 60000) * 60000).toISOString()));
  const [ends, setEnds] = useState(promotionLocalDate(item.placementEndsAt ?? item.terms.endsAt));
  const lock = useRef(false), request = useRef<{ body: string; key: string } | null>(null);
  const command = async (action: OfferPromotionCommand["action"], remove = false) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const body = { action, expectedVersion: item.version, ...(["APPROVE", "REQUEST_CHANGES", "REJECT"].includes(action) ? { reason } : {}), ...(action === "PLACE" ? { startsAt: remove ? null : new Date(starts).toISOString(), endsAt: remove ? null : new Date(ends).toISOString() } : {}) };
      const serialized = JSON.stringify(body);
      if (request.current?.body !== serialized) request.current = { body: serialized, key: crypto.randomUUID() };
      await api.commandOfferPromotion(item.id, { ...body, idempotencyKey: request.current.key } as OfferPromotionCommand);
      await reload();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Section title={item.terms.name} description={`${item.supplierName} · ${item.offerName}`}>
    <div className="mp-stack">
      <p>Согласование: <strong>{labels[item.moderationStatus]}</strong> · Срок: <strong>{labels[item.temporalStatus]}</strong> · Версия условий {item.revision}</p>
      <p>{formatDate(item.terms.startsAt)} — {formatDate(item.terms.endsAt)} · {item.terms.description}</p>
      <p>{item.terms.kind === "BUY_X_GET_Y" ? `За ${item.terms.buyQuantity} — ${item.terms.giftQuantity} в подарок` : `Цена по акции: ${formatMoney(item.unitPriceMinor, item.currency)}`} · Минимум {item.terms.minimumQuantity} · Оформлено {item.claimedQuantity} из {item.terms.quantityLimit}</p>
      <p>Исходная цена: {formatMoney(item.evidence.baseAmountMinor, item.currency)} · Минимум за последние 30 дней: {formatMoney(item.evidence.minimum30DaysMinor, item.currency)} · Доступна история за {Math.floor(item.evidence.historyDays)} дн.</p>
      {item.evidence.raisedRecently ? <p role="status"><strong>Обычная цена недавно повышалась.</strong> Проверьте историю перед согласованием.</p> : null}
      {error ? <ErrorState description={error} /> : null}
      {!operator ? <>
        <DmButton disabled={busy} onClick={() => edit(false)}>Изменить условия</DmButton>
        {["DRAFT", "CHANGES_REQUESTED", "REJECTED"].includes(item.moderationStatus) && item.status !== "ARCHIVED" ? <DmButton disabled={busy} appearance="primary" onClick={() => void command("SUBMIT")}>Отправить на согласование</DmButton> : null}
        {item.isTemplate ? <DmButton disabled={busy} onClick={() => edit(true)}>Создать из шаблона</DmButton> : <DmButton disabled={busy} onClick={() => void command("SAVE_TEMPLATE")}>Сохранить как шаблон</DmButton>}
      </> : null}
      {operator && item.moderationStatus === "PENDING" ? <>
        <DmField label="Причина решения" required><DmInput disabled={busy} value={reason} onChange={(_, data) => setReason(data.value)} /></DmField>
        {([ ["APPROVE", "Согласовать версию"], ["REQUEST_CHANGES", "Вернуть на доработку"], ["REJECT", "Отклонить"] ] as const).map(([action, label]) => <DmButton key={action} disabled={busy || reason.trim().length < 3} onClick={() => void command(action)}>{label}</DmButton>)}
      </> : null}
      {item.moderationStatus === "APPROVED" && ["ACTIVE", "PAUSED", "SCHEDULED"].includes(item.temporalStatus) ? <DmButton disabled={busy} onClick={() => void command(item.status === "PAUSED" ? "RESUME" : "PAUSE")}>{item.status === "PAUSED" ? "Возобновить" : "Приостановить"}</DmButton> : null}
      {operator && item.moderationStatus === "APPROVED" && item.status === "ACTIVE" ? <>
        <DmField label="Начало размещения на витрине"><DmInput type="datetime-local" disabled={busy} value={starts} onChange={(_, data) => setStarts(data.value)} /></DmField>
        <DmField label="Окончание размещения на витрине"><DmInput type="datetime-local" disabled={busy} value={ends} onChange={(_, data) => setEnds(data.value)} /></DmField>
        <DmButton disabled={busy || !starts || !ends} onClick={() => void command("PLACE")}>Разместить на витрине</DmButton>
        {item.placementStartsAt ? <DmButton disabled={busy} onClick={() => void command("PLACE", true)}>Снять с витрины</DmButton> : null}
      </> : null}
      {item.status !== "ARCHIVED" ? <DmButton disabled={busy} onClick={() => void command("ARCHIVE")}>Завершить и архивировать</DmButton> : null}
      <details><summary>История условий, цен и решений</summary>
        {item.revisions.map(version => <div key={version.revision}><h4>Версия {version.revision} · {formatDate(version.createdAt)}</h4><p>{version.terms.name} · {formatDate(version.terms.startsAt)} — {formatDate(version.terms.endsAt)} · Лимит {version.terms.quantityLimit}</p><p>{version.terms.kind === "BUY_X_GET_Y" ? `${version.terms.buyQuantity} + ${version.terms.giftQuantity}` : version.terms.kind === "PERCENTAGE" ? `${(version.terms.percentageBasisPoints ?? 0) / 100}%` : formatMoney(version.terms.fixedAmountMinor ?? "0", version.evidence.currency)}</p><ul>{version.evidence.observations.map((point, index) => <li key={index}>{formatDate(point.observedAt)} — {formatMoney(point.amountMinor, version.evidence.currency)}</li>)}</ul></div>)}
        <ul>{item.decisions.map((decision, index) => <li key={index}>{formatDate(decision.createdAt)} · версия {decision.revision} · {labels[decision.action] ?? decision.action}{decision.reason ? `: ${decision.reason}` : ""}</li>)}</ul>
      </details>
    </div>
  </Section>;
}

export function PromotionWorkspace({ api, operator = false }: { api: PromotionWorkspaceApi; operator?: boolean }) {
  const [page, setPage] = useState<PromotionPage | null>(null), [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null), [notice, setNotice] = useState("");
  const [status, setStatus] = useState(""), [editor, setEditor] = useState<{ selected?: OfferPromotion; template?: OfferPromotion } | null>(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current; setLoading(true); setError(null);
    try { const result = await api.listPromotions({ offset, limit: 10, ...(status ? { moderationStatus: status as "PENDING" } : {}) }); if (current === generation.current) setPage(result); }
    catch (cause) { if (current === generation.current) setError(errorMessage(cause)); }
    finally { if (current === generation.current) setLoading(false); }
  }, [api, offset, status]);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [load]);
  const saved = async () => { setNotice("Изменения сохранены. История обновлена."); await load(); };
  return <div className="mp-stack">
    <h2>{operator ? "Согласование акций" : "Акции поставщика"}</h2>
    {notice ? <p role="status">{notice}</p> : null}
    {!operator && !editor ? <DmButton appearance="primary" onClick={() => setEditor({})}>Новая акция</DmButton> : null}
    {editor ? <PromotionEditor key={editor.selected?.id ?? editor.template?.id ?? "new"} api={api} {...editor} onSaved={saved} onClose={() => setEditor(null)} /> : null}
    <DmField label="Статус согласования"><DmSelect value={status} onChange={(_, data) => { setStatus(data.value); setOffset(0); }}><option value="">Все статусы и история</option>{["DRAFT", "PENDING", "CHANGES_REQUESTED", "REJECTED", "APPROVED"].map(value => <option key={value} value={value}>{labels[value]}</option>)}</DmSelect></DmField>
    <DmButton disabled={loading} onClick={() => void load()}>Обновить акции</DmButton>
    {error ? <ErrorState description={error} /> : null}
    {loading ? <LoadingState label="Загружаем акции" /> : page?.items.length ? page.items.map(item => <PromotionCard key={`${item.id}:${item.version}`} item={item} api={api} operator={operator} reload={saved} edit={template => setEditor(template ? { template: item } : { selected: item })} />) : !error ? <EmptyState title="Акций пока нет" description={operator ? "Здесь появятся условия, отправленные поставщиками." : "Создайте черновик для одного предложения."} /> : null}
    <div><DmButton disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - 10))}>Назад</DmButton> <DmButton disabled={loading || !page || offset + page.items.length >= page.total} onClick={() => setOffset(offset + 10)}>Далее</DmButton></div>
  </div>;
}

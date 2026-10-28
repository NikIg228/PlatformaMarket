"use client";
import { useCallback, useRef, useState } from "react";
import { ActionFeedback, DmButton, DmDisclosureSummary, DmField, DmSelect, DmTextarea, Section } from "@marketplace/ui";
import { MarketplaceApiError, type MarketplaceApiClient } from "@marketplace/api-client";
import type { CreateVerifiedReviewInput } from "@marketplace/schemas";
import { useResource } from "./use-resource";
import styles from "./workspace.module.css";

const dimensions = [
  ["availabilityAccuracy", "Точность наличия"], ["priceAccuracy", "Точность цены"],
  ["confirmationSpeed", "Скорость подтверждения"], ["completeness", "Комплектность"],
  ["delivery", "Доставка"], ["documents", "Документы"], ["communication", "Общение"],
] as const;
const statuses = { PENDING: "На проверке", PUBLISHED: "Опубликован", HIDDEN: "Скрыт модерацией", DISPUTED: "Оспаривается" };
export function OrderReview({ api, orderId }: { api: MarketplaceApiClient; orderId: string }) {
  const load = useCallback(() => api.getOrderReviewState(orderId), [api, orderId]);
  const resource = useResource(load, { intervalMs: 15000 });
  const [rating, setRating] = useState("");
  const [scores, setScores] = useState<CreateVerifiedReviewInput["dimensions"]>({});
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const pending = useRef<CreateVerifiedReviewInput | null>(null);
  const submit = async () => {
    if (lock.current || !resource.data?.eligible || resource.data.review || !rating) return;
    lock.current = true; setBusy(true); setError("");
    // Retain the exact request after an unknown response. Recover by reading the
    // saved review; never send edited content under an uncertain previous key.
    pending.current ??= { overallRating: Number(rating), dimensions: scores, comment, idempotencyKey: `buyer-review:${orderId}` };
    try {
      const review = await api.createOrderReview(orderId, pending.current);
      resource.setData({ orderId, eligible: true, review });
      pending.current = null;
      await resource.refreshAfterWrite();
    } catch (cause) {
      if (cause instanceof MarketplaceApiError && cause.status >= 400 && cause.status < 500 && cause.status !== 408) pending.current = null;
      setError(cause instanceof Error ? cause.message : "Не удалось отправить отзыв. Текст сохранён.");
      await resource.refreshAfterWrite();
    } finally { lock.current = false; setBusy(false); }
  };
  const state = resource.data;
  return <Section title="Отзыв о поставщике">
    {state && resource.error ? <ActionFeedback tone="error" description="Не удалось обновить состояние отзыва."
      action={<DmButton onClick={() => void resource.refresh()}>Повторить проверку</DmButton>} /> : null}
    {!state ? resource.error ? <ActionFeedback tone="error" description="Не удалось проверить право на отзыв."
      action={<DmButton onClick={() => void resource.refresh()}>Повторить проверку</DmButton>} /> : <p role="status">Проверяем получение заказа…</p> :
      state.review ? <div role="status"><p>Отзыв сохранён. {statuses[state.review.status]} · {state.review.overallRating} из 5</p><p>{state.review.comment}</p></div> :
      !state.eligible ? <p>Отзыв станет доступен после полного фактического получения заказа. Завершать подписание документов для этого не нужно.</p> :
        <form className={styles.stack} onSubmit={event => { event.preventDefault(); void submit(); }}>
          <p>Заказ получен полностью. Оцените поставщика; подписание документов можно завершить отдельно.</p>
          <DmField label="Общая оценка" required><DmSelect aria-label="Общая оценка" required value={rating} disabled={busy || Boolean(pending.current)} onChange={(_, data) => setRating(data.value)}>
            <option value="">Выберите оценку</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} из 5</option>)}
          </DmSelect></DmField>
          <details><DmDisclosureSummary>Дополнительные оценки — по желанию</DmDisclosureSummary><div className={styles.form}>
            {dimensions.map(([key, label]) => <DmField label={label} key={key}><DmSelect aria-label={label} value={scores[key] ?? ""} disabled={busy || Boolean(pending.current)} onChange={(_, data) => setScores(previous => ({ ...previous, [key]: data.value ? Number(data.value) : undefined }))}>
              <option value="">Не оцениваю</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} из 5</option>)}
            </DmSelect></DmField>)}
          </div></details>
          <DmField label="Комментарий"><DmTextarea aria-label="Комментарий к отзыву" value={comment} maxLength={4000} disabled={busy || Boolean(pending.current)} onChange={(_, data) => setComment(data.value)} /></DmField>
          {error ? <ActionFeedback tone="error" description={error} /> : null}
          <DmButton type="submit" appearance="primary" disabled={busy || !rating}>{busy ? "Отправляем…" : pending.current ? "Повторить отправку" : "Отправить отзыв"}</DmButton>
        </form>}
  </Section>;
}

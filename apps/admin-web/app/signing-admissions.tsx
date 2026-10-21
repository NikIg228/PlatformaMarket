"use client";
import { useCallback, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import { PilotSigningApiClient } from "@marketplace/api-client/pilot-signing";
import { DmButton, DmHeading, DmSurface, EmptyState, ErrorState, LoadingState } from "@marketplace/ui";
import { useOperatorProjection } from "./use-operator-projection";
import { useAdminQuery } from "./use-admin-query";
import { SigningAdmissionReview } from "./signing-admission-review";
import styles from "./signing-admissions.module.css";

export function SigningAdmissions() {
  const { state, write } = useAdminQuery();
  const [offset, setOffset] = useState(0);
  const read = useCallback((api: MarketplaceApiClient) => new PilotSigningApiClient(api).call("admissionQueue", {}, { offset, limit: 25 }), [offset]);
  const resource = useOperatorProjection(read);
  return <section className={styles.section} aria-label="Допуск руководителей и ИП">
    <DmHeading title="Допуск руководителей и ИП" level={2} />
    {state.admissionId ? <SigningAdmissionReview key={state.admissionId} id={state.admissionId} onClose={() => { write({ ...state, admissionId: undefined }); void resource.refresh(); }} /> : <>
      <div className={styles.actions}><p>Заявки на первичный допуск после подтверждения личности.</p><DmButton disabled={resource.loading} onClick={() => void resource.refresh()}>Обновить очередь допуска</DmButton></div>
      {resource.loading ? <LoadingState label="Загружаем заявки на допуск" /> : null}
      {resource.error ? <ErrorState presentation="inline" title="Очередь допуска недоступна" description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить загрузку заявок</DmButton>} /> : null}
      {resource.data?.items.length === 0 && !resource.error ? <EmptyState title="Нет заявок на проверку" description={offset ? "Вернитесь на предыдущую страницу." : "Новые заявки руководителей и ИП появятся здесь."} /> : null}
      {resource.data?.items.map(item => <DmSurface key={item.id} variant="card" className={styles.row}>
        <div><strong>{item.applicant.displayName}</strong><p>{item.application.basis.kind === "LEGAL_ENTITY_HEAD" ? "Руководитель ЮЛ" : "ИП лично"} · ИИН {item.applicant.maskedIin}</p><p>{new Date(item.createdAt).toLocaleString("ru-KZ")}</p></div>
        <DmButton disabled={resource.loading || Boolean(resource.error)} onClick={() => write({ ...state, admissionId: item.id })} aria-label={`Проверить заявку ${item.applicant.displayName}`}>Проверить заявку</DmButton>
      </DmSurface>)}
      {resource.data ? <div className={styles.actions}><DmButton disabled={resource.loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Предыдущие заявки</DmButton><span role="status">Страница {offset / 25 + 1} · Всего {resource.data.total}</span><DmButton disabled={resource.loading || offset + 25 >= resource.data.total} onClick={() => setOffset(offset + 25)}>Следующие заявки</DmButton></div> : null}
    </>}
  </section>;
}

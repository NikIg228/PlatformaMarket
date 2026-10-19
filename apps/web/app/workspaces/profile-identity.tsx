"use client";
import { DmButton, DmFeedback, DmHeading, DmSurface, LoadingState } from "@marketplace/ui";
import { useIdentitySigning } from "./use-identity-signing";
import { identityReason } from "./identity-signing-feedback";
import styles from "./account-settings.module.css";
import layout from "./profile-identity.module.css";

export function ProfileIdentity() {
  const state = useIdentitySigning();
  const { identity, session, busy, loading, error } = state;
  const verified = identity?.status === "VERIFIED";
  const terminal = session && ["CANCELLED", "EXPIRED", "REJECTED", "EVIDENCE_ONLY"].includes(session.status);
  const canStart = identity?.status === "UNVERIFIED" && identity.verificationAvailable && (!session || terminal);
  return <DmSurface className={styles.card} role="region" aria-label="Подтверждение личности">
    <DmHeading title="Подтверждение личности" />
    <div className={layout.content}>
      <p className={layout.description}>Подтвердите личность своей ЭЦП через NCALayer. Подтверждение связывает ИИН с вашим аккаунтом; право подписывать документы организации оформляется отдельно.</p>
      {loading && !identity ? <LoadingState label="Загружаем статус подтверждения" /> : null}
      {error ? <DmFeedback presentation="inline" tone="danger" title="Действие не завершено" description={error} alert action={<DmButton disabled={busy || loading} onClick={() => void state.refresh()}>Восстановить состояние</DmButton>} /> : null}
      {verified ? <DmFeedback presentation="inline" tone="success" title="Личность подтверждена" description={`ИИН ${identity.maskedIin}. Подтверждено ${new Date(identity.verifiedAt).toLocaleDateString("ru-KZ")}. Для изменения привязки обратитесь в поддержку.`} /> : null}
      {identity?.status === "UNVERIFIED" && !identity.verificationAvailable && !session ? <DmFeedback presentation="inline" tone="warning" title="Проверка пока недоступна" description="Сервис проверки ЭЦП не настроен. Подтверждение станет доступно после его подключения." /> : null}
      {!verified && session?.status === "AWAITING_USER" ? <DmFeedback presentation="inline" tone="info" title="Запрос готов к подписанию" description={`Откройте NCALayer и выберите свою ЭЦП. Запрос действует до ${new Date(session.signingInput.expiresAt).toLocaleTimeString("ru-KZ", { hour: "2-digit", minute: "2-digit" })}. Пароль ключа вводится только в NCALayer.`} /> : null}
      {!verified && session?.status === "VERIFYING" ? <DmFeedback presentation="inline" tone="info" title="Проверяем подпись" description="Подпись принята. Можно закрыть страницу и вернуться позже — результат проверки сохранится." /> : null}
      {!verified && session?.status === "UNKNOWN" ? <DmFeedback presentation="inline" tone="warning" title="Проверка не завершена" description={identityReason(session.reasonCode)} /> : null}
      {!verified && session?.status === "CANCELLED" ? <DmFeedback presentation="inline" tone="neutral" title="Подтверждение отменено" description="Личность не привязана. При необходимости начните новое подтверждение." /> : null}
      {!verified && session?.status === "EXPIRED" ? <DmFeedback presentation="inline" tone="warning" title="Время подтверждения истекло" description={identityReason("SESSION_EXPIRED")} /> : null}
      {!verified && (session?.status === "REJECTED" || session?.status === "EVIDENCE_ONLY") ? <DmFeedback presentation="inline" tone="warning" title="Личность не подтверждена" description={identityReason(session.reasonCode)} /> : null}
      {busy ? <LoadingState label={session?.status === "AWAITING_USER" ? "Ожидаем подпись или ответ сервера" : "Выполняем действие"} /> : null}
      {!verified ? <div className={layout.actions}>
        {canStart ? <DmButton appearance="primary" disabled={busy || loading || Boolean(error)} onClick={() => void state.create()}>Подтвердить личность</DmButton> : null}
        {session?.status === "AWAITING_USER" ? <DmButton appearance="primary" disabled={busy || loading || Boolean(error)} onClick={() => void state.sign()}>{state.hasPendingCms ? "Отправить сохранённую подпись" : "Подписать через NCALayer"}</DmButton> : null}
        {session?.status === "UNKNOWN" ? <DmButton appearance="primary" disabled={busy || loading || Boolean(error)} onClick={() => void state.retry()}>Повторить проверку</DmButton> : null}
        {session && ["AWAITING_USER", "VERIFYING", "UNKNOWN"].includes(session.status) ? <DmButton disabled={busy || loading || Boolean(error)} onClick={() => void state.cancel()}>Отменить подтверждение</DmButton> : null}
      </div> : null}
    </div>
  </DmSurface>;
}

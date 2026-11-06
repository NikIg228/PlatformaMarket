"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { MarketplaceApiClient, MarketplaceApiError } from "@marketplace/api-client";
import { mfaStatusSchema, mfaEnrollmentSchema, mfaChallengeResultSchema, mfaVerificationResultSchema, type MfaEnrollment } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmTextarea, DmFeedback, LoadingState } from "@marketplace/ui";
import { apiUrl, type AuthSession } from "../auth-client";

export function MfaStep({ session, locale, onComplete, onCancel }: { session: AuthSession; locale: string | null; onComplete: (session: AuthSession) => Promise<unknown>; onCancel: () => void }) {
  const kk = locale === "kk";
  const api = useMemo(() => new MarketplaceApiClient(apiUrl, { accessToken: session.accessToken }), [session.accessToken]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const active = useRef(0);
  const locked = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const failed = (cause: unknown) => cause instanceof MarketplaceApiError && cause.status === 429
    ? (kk ? "Тым көп әрекет. Кейінірек қайталаңыз." : "Слишком много попыток. Повторите позже.")
    : (kk ? "Код расталмады. Код пен байланысты тексеріңіз немесе қайта кіріңіз." : "Код не подтверждён. Проверьте код и соединение или войдите заново.");

  useEffect(() => {
    const request = ++active.current;
    setEnabled(null); setError("");
    void api.mfaStatus().then(value => { if (request === active.current) setEnabled(mfaStatusSchema.parse(value).enabled); })
      .catch(() => { if (request === active.current) setError(kk ? "Қорғаныс күйі жүктелмеді. Қайталап көріңіз." : "Не удалось загрузить настройки защиты. Повторите попытку."); });
    return () => { active.current += 1; };
  }, [api, revision, kk]);
  useEffect(() => { if (enabled || enrollment) input.current?.focus(); }, [enabled, enrollment]);

  const enroll = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError("");
    const request = active.current;
    try {
      const value = mfaEnrollmentSchema.parse(await api.enrollMfa());
      if (request === active.current) setEnrollment(value);
    } catch (cause) { if (request === active.current) setError(failed(cause)); }
    finally { if (request === active.current) { locked.current = false; setBusy(false); } }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true; setBusy(true); setError("");
    const request = active.current;
    try {
      const result = enrollment
        ? mfaVerificationResultSchema.parse(await api.verifyMfaEnrollment({ code: code.trim().toUpperCase() }))
        : mfaChallengeResultSchema.parse(await api.challengeMfa({ code: code.trim().toUpperCase() }));
      if (!("accessToken" in result)) throw new Error("Missing elevated session");
      if (request === active.current) {
        setEnabled(true); setEnrollment(null); setCode("");
        await onComplete({ ...session, accessToken: result.accessToken, activeOrganizationId: result.activeOrganizationId });
      }
    } catch (cause) { if (request === active.current) { setError(failed(cause)); input.current?.focus(); } }
    finally { if (request === active.current) { locked.current = false; setBusy(false); } }
  };
  return <div className="emailLoginForm">
    <p>{kk ? "Кіруді аутентификатор қолданбасындағы кодпен растаңыз." : "Подтвердите вход кодом из приложения-аутентификатора."}</p>
    {enabled === null && !error ? <LoadingState label={kk ? "Қорғаныс баптаулары жүктелуде…" : "Загружаем настройки защиты…"} /> : null}
    {enabled === false && !enrollment ? <DmButton appearance="primary" disabled={busy} onClick={() => void enroll()}>{kk ? "Аутентификаторды баптау" : "Настроить аутентификатор"}</DmButton> : null}
    {enrollment ? <>
      <DmField label={kk ? "Қолданбаға қосу кілті" : "Ключ для добавления в приложение"}><DmInput readOnly value={enrollment.secret} /></DmField>
      <DmField label={kk ? "Қалпына келтіру кодтары — қауіпсіз жерде сақтаңыз" : "Коды восстановления — сохраните в безопасном месте"}><DmTextarea readOnly rows={5} value={enrollment.recoveryCodes.join("\n")} /></DmField>
    </> : null}
    {enabled || enrollment ? <form className="emailLoginForm" onSubmit={submit} aria-busy={busy}>
      <DmField label={kk ? "Растау немесе қалпына келтіру коды" : "Код подтверждения или восстановления"} required>
        <DmInput ref={input} name="mfa-code" autoComplete="one-time-code" value={code} onChange={(_, data) => setCode(data.value)} maxLength={32} required disabled={busy} />
      </DmField>
      <DmButton type="submit" appearance="primary" disabled={busy || !code.trim()}>{kk ? "Растау" : "Подтвердить"}</DmButton>
    </form> : null}
    {busy ? <LoadingState presentation="inline" label={kk ? "Растау өңделуде…" : "Проверяем код подтверждения…"} /> : null}
    {error ? <DmFeedback presentation="inline" tone="danger" title={kk ? "Кіру аяқталмады" : "Вход не завершён"} description={error} alert /> : null}
    {enabled === null && error ? <DmButton onClick={() => setRevision(value => value + 1)}>{kk ? "Қайталау" : "Повторить"}</DmButton> : null}
    <DmButton appearance="subtle" disabled={busy} onClick={onCancel}>{kk ? "Басқа аккаунтпен кіру" : "Войти другим аккаунтом"}</DmButton>
  </div>;
}

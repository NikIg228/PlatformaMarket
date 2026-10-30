"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import type { InvitationDetails } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, LoadingState } from "@marketplace/ui";
import { AuthBrand, AuthNotice } from "../auth-components";
import { feedbackFromError, type AuthFeedback } from "../auth-client";

export default function InvitationPage() {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", {}), []);
  const initialized = useRef(false);
  const proof = useRef("");
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const [done, setDone] = useState(false);
  async function load() {
    setLoading(true); setFeedback(null);
    try {
      if (!proof.current) throw new Error("Откройте ссылку из приглашения. Если срок истёк, попросите администратора отправить новую.");
      setDetails(await api.invitationDetails(proof.current));
    } catch (cause) { setFeedback(feedbackFromError(cause, "Приглашение недоступно")); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    proof.current = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    window.history.replaceState(window.history.state, "", window.location.pathname);
    void load();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (flight.current || !details) return;
    if (password.length < 12 || (!details.accountExists && displayName.trim().length < 2)) {
      setFeedback({ kind: "error", message: "Укажите имя и пароль длиной не менее 12 символов." }); return;
    }
    flight.current = true; setBusy(true); setFeedback(null);
    try {
      await api.acceptInvitation({ token: proof.current, password, displayName: details.accountExists ? "Участник организации" : displayName, ...(details.mfaRequired ? { mfaCode } : {}) });
      setDone(true); proof.current = ""; setPassword(""); setMfaCode("");
      setFeedback({ kind: "success", message: "Вы добавлены в организацию. Войдите в аккаунт, чтобы начать работу." });
    } catch (cause) { setFeedback(feedbackFromError(cause, "Не удалось принять приглашение")); }
    finally { flight.current = false; setBusy(false); }
  }
  return <main className="authUtilityPage"><section className="authUtilityCard" aria-labelledby="invitation-title">
    <AuthBrand /><p className="eyebrow">Доступ к организации</p><h1 id="invitation-title">Приглашение сотрудника</h1>
    {loading ? <LoadingState label="Проверяем приглашение" /> : null}
    {feedback ? <AuthNotice feedback={feedback} /> : null}
    {details && !done ? <><p className="authUtilityLead">{details.organizationName}</p><p>{details.email}</p><p>Роли: {details.roles.join(", ") || "Без назначенных прав"}</p>
      <form className="passwordForm" onSubmit={submit}>
        {!details.accountExists ? <DmField label="Ваше имя" required><DmInput value={displayName} onChange={(_, value) => setDisplayName(value.value)} autoComplete="name" required minLength={2} maxLength={160} disabled={busy} /></DmField> : <p>Аккаунт уже существует. Введите его действующий пароль. Имя и пароль аккаунта не изменятся.</p>}
        <DmField label={details.accountExists ? "Действующий пароль" : "Создайте пароль"} hint="Минимум 12 символов" required><DmInput type="password" autoComplete={details.accountExists ? "current-password" : "new-password"} value={password} onChange={(_, value) => setPassword(value.value)} minLength={12} maxLength={128} required disabled={busy} /></DmField>
        {details.mfaRequired ? <DmField label="Код MFA или код восстановления" required><DmInput value={mfaCode} onChange={(_, value) => setMfaCode(value.value)} autoComplete="one-time-code" required minLength={6} maxLength={32} disabled={busy} /></DmField> : null}
        <DmButton type="submit" appearance="primary" disabled={busy}>{busy ? "Принимаем приглашение…" : "Принять приглашение"}</DmButton>
        {details.accountExists ? <a href="/login">Восстановить пароль на странице входа</a> : null}
      </form></> : null}
    {!loading && !details ? <DmButton onClick={() => void load()}>Повторить проверку</DmButton> : null}
    {done ? <DmButton as="a" href="/login" appearance="primary">Войти в аккаунт</DmButton> : null}
  </section></main>;
}

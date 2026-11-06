"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import { registrationEmailCorrectionSchema, type AuthRegistrationAccepted } from "@marketplace/schemas";
import { DmButton, DmField, DmInput } from "@marketplace/ui";
import { AuthNotice } from "../auth-components";
import { apiUrl, type AuthFeedback } from "../auth-client";

export function RegistrationEmailCorrection({ initialEmail, registrationToken, password, returnTo, onAccepted, onCancel }: {
  initialEmail: string; registrationToken: string; password: string; returnTo?: string;
  onAccepted: (result: AuthRegistrationAccepted) => void; onCancel: () => void;
}) {
  const api = useMemo(() => new MarketplaceApiClient(apiUrl, {}), []);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const lock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const invalidEmail = !registrationEmailCorrectionSchema.shape.email.safeParse(email).success;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    setSubmitted(true); setFeedback(null);
    if (invalidEmail) { input.current?.focus(); return; }
    lock.current = true; setBusy(true);
    try {
      const result = await api.correctRegistrationEmail({ registrationToken, password, email, returnTo });
      onAccepted(result);
    } catch (cause) {
      setFeedback({ kind: "error", message: cause instanceof TypeError
        ? "Не удалось связаться с сервером. Адрес сохранён, проверьте соединение и повторите отправку."
        : cause instanceof Error ? cause.message : "Не удалось отправить письмо. Повторите попытку." });
    } finally { lock.current = false; setBusy(false); }
  }
  return <form className="mp-stack" onSubmit={submit} noValidate aria-label="Исправление email">
    <p>Реквизиты организации и согласия сохранятся. Новый адрес нужно подтвердить по ссылке в письме. Предыдущая ссылка перестанет действовать.</p>
    <DmField label="Новый рабочий email" required validationState={submitted && invalidEmail ? "error" : "none"} validationMessage={submitted && invalidEmail ? "Укажите корректный email." : undefined}>
      <DmInput type="email" autoComplete="email" required value={email} disabled={busy} input={{ ref: input }} onChange={(_, data) => setEmail(data.value)} />
    </DmField>
    {feedback ? <AuthNotice feedback={feedback} /> : null}
    <div className="registrationActions">
      <DmButton type="submit" appearance="primary" disabled={busy}>{busy ? "Отправляем письмо…" : "Отправить подтверждение"}</DmButton>
      <DmButton type="button" appearance="subtle" disabled={busy} onClick={onCancel}>Отмена</DmButton>
    </div>
  </form>;
}

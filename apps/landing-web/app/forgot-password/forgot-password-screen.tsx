"use client";

import { authForgotAcceptedSchema, emailForgotPasswordSchema } from "@marketplace/schemas";
import { withWorkspaceReturn } from "@marketplace/schemas/product-navigation";
import { DmButton, DmField, DmInput, LoadingState } from "@marketplace/ui";
import { type FormEvent, useRef, useState } from "react";
import { AuthBrand, AuthNotice } from "../auth-components";
import { authRequest, feedbackFromError, type AuthFeedback } from "../auth-client";
import { useProductReturn } from "../use-product-return";
import styles from "./forgot-password.module.css";

export default function ForgotPasswordPage() {
  const returnTo = useProductReturn();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const valid = emailForgotPasswordSchema.safeParse({ email: email.trim() });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    setSubmitted(true);
    if (!valid.success) return;
    pending.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      const accepted = authForgotAcceptedSchema.parse(await authRequest("/auth/password/forgot", valid.data));
      setFeedback({ kind: "success", message: accepted.delivery === "LOCAL_FILE"
        ? "Запрос принят. На локальном стенде письмо доступно оператору."
        : "Мы выслали письмо на указанный email." });
    } catch (cause) {
      setFeedback(feedbackFromError(cause, "Не удалось отправить письмо",
        "Сервер не ответил. Email сохранён — проверьте соединение и повторите запрос."));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <main className="authUtilityPage">
    <section className={`authUtilityCard ${styles.card}`} aria-labelledby="forgot-title">
      <AuthBrand href="/catalog" />
      <h1 id="forgot-title">Восстановить пароль</h1>
      <p className="authUtilityLead">Укажите email вашего аккаунта. Мы отправим ссылку для создания нового пароля.</p>
      <form className="passwordForm" onSubmit={submit} noValidate>
        <DmField label="Рабочий email" required validationState={submitted && !valid.success ? "error" : "none"}
          validationMessage={submitted && !valid.success ? "Укажите корректный email." : undefined}>
          <DmInput type="email" autoComplete="email" value={email} required disabled={busy}
            onChange={(_, data) => { setEmail(data.value); setFeedback(null); }} />
        </DmField>
        <DmButton type="submit" appearance="primary" disabled={busy} aria-busy={busy}>
          {busy ? <LoadingState presentation="inline" label="Отправляем письмо…" /> : "Отправить письмо"}
        </DmButton>
      </form>
      {feedback ? <AuthNotice feedback={feedback} /> : null}
      <a className="authBackLink" href={withWorkspaceReturn("/login?signedOut=1", returnTo)}>Вернуться ко входу</a>
    </section>
  </main>;
}

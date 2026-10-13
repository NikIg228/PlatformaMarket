"use client";
import { MarketplaceApiClient } from "@marketplace/api-client";
import { operatorSessionSchema } from "@marketplace/schemas";
import { DmButton, DmFeedback, DmField, DmInput, DmSurface, errorMessage } from "@marketplace/ui";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { saveAdminSession } from "../admin-auth";
import { adminLoginDestination } from "../admin-navigation";
import styles from "./login.module.css";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [changedAccount, setChangedAccount] = useState(false);
  useEffect(() => { setChangedAccount(new URLSearchParams(window.location.search).get("notice") === "session-changed"); }, []);
  const lock = useRef(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const api = new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", {});
      const session = operatorSessionSchema.parse(await api.loginOperator({ email: email.trim().toLowerCase(), password }));
      saveAdminSession(session); setPassword("");
      window.location.assign(adminLoginDestination(window.location.search));
    } catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <main className={styles.page}>
    <DmSurface className={styles.card}>
      <div className={styles.brand}><strong>PlatformaMarket</strong><span>Кабинет оператора</span></div>
      <div className={styles.heading}><h1>Вход в кабинет</h1><p>Введите email и пароль вашей рабочей учётной записи.</p></div>
      <form className={styles.form} onSubmit={submit} aria-busy={busy}>
        {changedAccount ? <DmFeedback tone="warning" title="Аккаунт изменён в другой вкладке" description="Работа с прежним аккаунтом остановлена. Войдите снова, чтобы продолжить." alert /> : null}
        <DmField label="Email оператора" required><DmInput name="email" type="email" value={email} onChange={(_, data) => setEmail(data.value)} autoComplete="username" required disabled={busy} /></DmField>
        <DmField label="Пароль оператора" required><DmInput name="password" type={visible ? "text" : "password"} value={password} onChange={(_, data) => setPassword(data.value)} autoComplete="current-password" maxLength={128} required disabled={busy} /></DmField>
        <DmButton appearance="subtle" aria-pressed={visible} onClick={() => setVisible(value => !value)} disabled={busy}>{visible ? "Скрыть пароль" : "Показать пароль"}</DmButton>
        {error ? <DmFeedback tone="danger" title="Вход не выполнен" description={error} alert /> : null}
        <DmButton type="submit" appearance="primary" disabled={busy}>{busy ? "Входим…" : "Войти"}</DmButton>
      </form>
    </DmSurface>
  </main>;
}

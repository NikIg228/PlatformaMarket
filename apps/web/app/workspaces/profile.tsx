"use client";
import { useCallback } from "react";
import { Avatar } from "@fluentui/react-components";
import type { CurrentSession } from "@marketplace/schemas/workspace-session";
import { DmButton, ErrorState, LoadingState } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { ProfileSessions } from "./profile-sessions";
import styles from "./account-settings.module.css";
export default function Profile() {
  const { api, role, session, logout } = useWorkspace();
  const load = useCallback(async (signal: AbortSignal) => {
    const current = await api.request<CurrentSession | null>(`/auth/current?workspace=${role === "clinic" ? "BUYER" : "SUPPLIER"}`, { signal, credentials: "include" });
    if (!current || current.sessionId !== session.sessionId) throw new Error("Не удалось получить данные аккаунта. Повторите загрузку или войдите заново.");
    return current.user;
  }, [api, role, session.sessionId]);
  const resource = useResource(load, { automatic: false });
  return <div className={styles.page}>
    <section className={styles.card} aria-label="Данные аккаунта"><h2>Данные аккаунта</h2>
      {resource.error ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : null}
      {!resource.data && resource.loading ? <LoadingState label="Загружаем данные аккаунта" /> : null}
      {resource.data ? <div className={styles.identity}><Avatar name={resource.data.displayName} size={48} color="brand" aria-hidden="true" /><dl><div><dt>Имя</dt><dd>{resource.data.displayName}</dd></div><div><dt>Электронная почта</dt><dd>{resource.data.email}</dd></div></dl></div> : null}
    </section>
    <ProfileSessions />
    <DmButton appearance="outline" intent="brand" className={styles.logout} disabled={logout.logoutPending} onClick={logout.onLogout}>{logout.logoutPending ? "Выходим…" : "Выйти из аккаунта"}</DmButton>
  </div>;
}

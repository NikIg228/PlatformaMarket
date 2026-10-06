"use client";
import { Avatar } from "@fluentui/react-components";
import { DmButton, SessionManagement } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import styles from "./profile.module.css";
import workspaceStyles from "./workspace.module.css";

export default function Profile() {
  const { api, role, session, logout } = useWorkspace();
  return <div className={workspaceStyles.stack}>
    <section className={`${workspaceStyles.panel} ${styles.profile}`} aria-label="Данные сотрудника">
      <Avatar name={session.displayName} size={56} color="brand" aria-hidden="true" />
      <div className={styles.identity}>
        <h2>{session.displayName || "Сотрудник"}</h2>
        <span>{role === "clinic" ? "Кабинет клиники" : "Кабинет поставщика"}</span>
        {session.organizationDisplayName ? <span>{session.organizationDisplayName}</span> : null}
      </div>
      <DmButton disabled={logout.logoutPending} onClick={logout.onLogout}>
        {logout.logoutPending ? "Выходим…" : "Выйти"}
      </DmButton>
    </section>
    <SessionManagement api={api} currentSessionId={session.sessionId} onCurrentRevoked={() => window.location.assign("/login")} />
  </div>;
}

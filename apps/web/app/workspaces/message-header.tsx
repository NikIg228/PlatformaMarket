"use client";
import { ConversationCounter, DmButton, usePermissions } from "@marketplace/ui";
import { Tooltip } from "@fluentui/react-components";
import { Alert24Regular } from "@fluentui/react-icons/svg/alert";
import { Chat24Regular } from "@fluentui/react-icons/svg/chat";
import { QuestionCircle24Regular } from "@fluentui/react-icons/svg/question-circle";
import { useEffect, useState } from "react";
import { useWorkspace } from "./workspace";
import { workspaceGreeting } from "./greeting";
import styles from "./message-header.module.css";
export function MessageHeader() {
  const { api, role, session } = useWorkspace();
  const has = usePermissions();
  const [greeting, setGreeting] = useState("Здравствуйте");
  useEffect(() => {
    const update = () => setGreeting(workspaceGreeting(new Date().getHours(), session.displayName));
    update();
    const timer = window.setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [session.displayName]);
  return <header className={styles.header} aria-label="События организации">
    <p className={styles.greeting}>{greeting}</p>
    <div className={styles.actions}>
      {has("notification.view") ? <Tooltip content="Уведомления" relationship="label"><DmButton as="a" href={`/${role}/notifications`} appearance="subtle" icon={<Alert24Regular />} aria-label="Уведомления" /></Tooltip> : null}
      {has("support.ticket.view") ? <>
        <Tooltip content="Сообщения" relationship="description"><span className={styles.counter}><ConversationCounter api={api} href={`/${role}/messages`} icon={<Chat24Regular />} /></span></Tooltip>
        <Tooltip content="Поддержка" relationship="label"><DmButton as="a" href={`/${role}/support`} appearance="subtle" icon={<QuestionCircle24Regular />} aria-label="Поддержка" /></Tooltip>
      </> : null}
    </div>
  </header>;
}

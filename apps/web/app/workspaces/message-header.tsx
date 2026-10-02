"use client";
import { ConversationCounter, DmButton, usePermissions } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
export function MessageHeader() {
  const { api, role } = useWorkspace();
  const has = usePermissions();
  return <header style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "flex-end", marginBottom: 16 }} aria-label="События организации">{has("notification.view") ? <DmButton as="a" href={`/${role}/notifications`}>Уведомления</DmButton> : null}{has("support.ticket.view") ? <><ConversationCounter api={api} href={`/${role}/messages`} /><DmButton as="a" href={`/${role}/support`}>Поддержка</DmButton></> : null}</header>;
}

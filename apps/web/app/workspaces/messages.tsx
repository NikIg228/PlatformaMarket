"use client";
import { useSearchParams } from "next/navigation";
import { ConversationWorkspace, usePermissions } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { PermissionBoundary } from "./permission-boundary";
import styles from "./messages.module.css";

export default function Messages() {
  const { api, organizationId, role } = useWorkspace();
  const query = useSearchParams();
  const has = usePermissions();
  const type = query.get("contextType");
  const id = query.get("contextId");
  const context = (type === "OFFER" || type === "ORDER") && id ? { contextType: type, contextId: id } as const : undefined;
  return <div className={styles.workspace}><PermissionBoundary required={["support.ticket.view"]}><ConversationWorkspace hideHeading hideRefresh compactList key={organizationId} onSelect={selected => { const url = new URL(window.location.href); if (selected) url.searchParams.set("conversationId", selected); else url.searchParams.delete("conversationId"); url.searchParams.delete("contextType"); url.searchParams.delete("contextId"); window.history.pushState(null, "", `${url.pathname}${url.search}`); }} api={api} organizationId={organizationId} initialId={query.get("conversationId") ?? undefined} context={context} canWrite={has("support.ticket.create")} contextHref={(kind, contextId) => kind === "ORDER" ? `/${role}/orders/${contextId}` : `/catalog?offerId=${contextId}`} /></PermissionBoundary></div>;
}

"use client";
import { useSearchParams } from "next/navigation";
import { ConversationWorkspace, usePermissions } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { PermissionBoundary } from "./permission-boundary";

export default function Messages() {
  const { api, organizationId, role } = useWorkspace();
  const query = useSearchParams();
  const has = usePermissions();
  const type = query.get("contextType");
  const id = query.get("contextId");
  const context = (type === "OFFER" || type === "ORDER") && id ? { contextType: type, contextId: id } as const : undefined;
  return <PermissionBoundary required={["support.ticket.view"]}><ConversationWorkspace hideHeading key={`${organizationId}:${query.toString()}`} api={api} organizationId={organizationId} initialId={query.get("conversationId") ?? undefined} context={context} canWrite={has("support.ticket.create")} contextHref={(kind, contextId) => kind === "ORDER" ? `/${role}/orders/${contextId}` : `/catalog?offerId=${contextId}`} /></PermissionBoundary>;
}

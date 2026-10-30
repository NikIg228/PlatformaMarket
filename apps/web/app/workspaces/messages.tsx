"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { ConversationWorkspace, usePermissions } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { PermissionBoundary } from "./permission-boundary";
import styles from "./messages.module.css";

export default function Messages() {
  const workspace = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = workspace.current;
    if (!element) return;
    // The buyer-context panel can wrap or change height after loading.
    // Measure its actual space instead of assuming a fixed header offset.
    const resize = () => {
      const top = element.getBoundingClientRect().top + window.scrollY;
      element.style.setProperty("--messages-available-height", `${Math.max(360, window.innerHeight - top - 8)}px`);
    };
    const observer = new ResizeObserver(resize);
    if (element.parentElement) {
      observer.observe(element.parentElement);
      for (const sibling of element.parentElement.children) {
        if (sibling !== element) observer.observe(sibling);
      }
    }
    window.addEventListener("resize", resize);
    resize();
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); };
  }, []);
  const { api, organizationId, role } = useWorkspace();
  const query = useSearchParams();
  const has = usePermissions();
  const type = query.get("contextType");
  const id = query.get("contextId");
  const context = (type === "OFFER" || type === "ORDER") && id ? { contextType: type, contextId: id } as const : undefined;
  return <div ref={workspace} className={styles.workspace}><PermissionBoundary required={["support.ticket.view"]}><ConversationWorkspace hideHeading hideRefresh compactList key={organizationId} onSelect={selected => { const url = new URL(window.location.href); if (selected) url.searchParams.set("conversationId", selected); else url.searchParams.delete("conversationId"); url.searchParams.delete("contextType"); url.searchParams.delete("contextId"); window.history.pushState(null, "", `${url.pathname}${url.search}`); }} api={api} organizationId={organizationId} initialId={query.get("conversationId") ?? undefined} context={context} canWrite={has("support.ticket.create")} contextHref={(kind, contextId) => kind === "ORDER" ? `/${role}/orders/${contextId}` : `/catalog?offerId=${contextId}`} /></PermissionBoundary></div>;
}

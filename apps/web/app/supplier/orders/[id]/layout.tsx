"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { PermissionFields } from "@marketplace/ui";
import { JanaPostLocalPanel } from "../../../workspaces/janapost-local-panel";
import { useWorkspace } from "../../../workspaces/workspace";

export default function SupplierOrderLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const { api, role, organizationId, session, locale } = useWorkspace();
  const showJanaPost = role === "supplier" && process.env.NODE_ENV !== "production"
    && process.env.NEXT_PUBLIC_JANAPOST_LOCAL_FIXTURES === "true";

  return <>
    {children}
    {showJanaPost && <PermissionFields required={["delivery.view"]}>
      <JanaPostLocalPanel key={`${organizationId}:${session.sessionId}:${id}`} api={api} orderId={id} locale={locale} />
    </PermissionFields>}
  </>;
}

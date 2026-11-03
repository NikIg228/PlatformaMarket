"use client";
import { useRef, type ReactNode } from "react";
import { PermissionFields, usePermissions } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { workspaceText } from "./workspace-locale";

export function PermissionBoundary({ required, children }: { required: string[]; children: ReactNode }) {
  const has = usePermissions();
  const { locale } = useWorkspace();
  const opened = useRef(false);
  if (has(...required)) opened.current = true;
  if (!opened.current) return <p role="status">{workspaceText(locale, "Этот раздел недоступен вашей роли. Обратитесь к администратору организации.")}</p>;
  return <PermissionFields required={required}>{children}</PermissionFields>;
}

"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { AccessPolicy } from "@marketplace/schemas";

// Legacy surfaces retain their existing guards. Unified workspaces always provide
// the current server permission set; an empty set grants no actions.
const Permissions = createContext<readonly string[] | null>(null);
const AccessMode = createContext<AccessPolicy["mode"]>("ROLE_BASED");
export function useAccessMode() { return useContext(AccessMode); }
export function PermissionsProvider({ permissions, mode = "ROLE_BASED", children }: { permissions: readonly string[]; mode?: AccessPolicy["mode"]; children: ReactNode }) {
  return <AccessMode.Provider value={mode}><Permissions.Provider value={permissions}>{children}</Permissions.Provider></AccessMode.Provider>;
}
export function usePermissions() {
  const permissions = useContext(Permissions);
  return (...required: string[]) => permissions === null || required.every(code => permissions.includes(code));
}
export function PermissionFields({ required, children }: { required: string[]; children: ReactNode }) {
  const has = usePermissions();
  const allowed = has(...required);
  return <>
    {!allowed ? <p role="status">Действие недоступно вашей роли. Ввод сохранён; обратитесь к администратору организации.</p> : null}
    <fieldset disabled={!allowed} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>{children}</fieldset>
  </>;
}

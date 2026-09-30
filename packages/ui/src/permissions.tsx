"use client";
import { createContext, useContext, type ReactNode } from "react";

// Legacy surfaces retain their existing guards. Unified workspaces always provide
// the current server permission set; an empty set grants no actions.
const Permissions = createContext<readonly string[] | null>(null);
export function PermissionsProvider({ permissions, children }: { permissions: readonly string[]; children: ReactNode }) {
  return <Permissions.Provider value={permissions}>{children}</Permissions.Provider>;
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

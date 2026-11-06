import type { CurrentSession } from "@marketplace/schemas/workspace-session";

type AccountDestination =
  | { kind: "loading" | "error" | "guest" }
  | { kind: "personal"; name: string }
  | { kind: "choice"; name: string }
  | { kind: "workspace"; name: string; capability: "BUYER" | "SUPPLIER" };

export function accountDestination(input: {
  ready: boolean;
  error: boolean;
  session: CurrentSession | null;
  personalReady: boolean;
  personalError: boolean;
  personalUser: { id: string; displayName: string } | null;
}): AccountDestination {
  if (!input.ready) return { kind: "loading" };
  if (input.error) return { kind: "error" };
  if (input.session) {
    const active = input.session.workspaces.find(item => item.organizationId === input.session?.activeOrganizationId);
    if (!active || !active.capabilities.length) return { kind: "error" };
    if (active.capabilities.length !== 1) return { kind: "choice", name: active.organizationDisplayName };
    return { kind: "workspace", name: active.organizationDisplayName, capability: active.capabilities[0] };
  }
  if (!input.personalReady) return { kind: "loading" };
  if (input.personalError) return { kind: "error" };
  return input.personalUser ? { kind: "personal", name: input.personalUser.displayName } : { kind: "guest" };
}

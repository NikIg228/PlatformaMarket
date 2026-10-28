export type SessionHandoffEnvelope = {
  actorId?: string;
  sessionId?: string;
  csrfToken?: string;
  accessTokenExpiresAt?: number;
  displayName?: string;
  organizationDisplayName?: string;
  organizationId?: string;
  accessToken?: string;
  handoffCode?: string;
  capability?: string;
};

export function parseSessionHandoff(serialized: string | null, capability: "BUYER" | "SUPPLIER", source: "storage" | "url" = "storage"): SessionHandoffEnvelope | null {
  if (!serialized) return null;
  try {
    const value = JSON.parse(serialized) as SessionHandoffEnvelope;
    if (source === "url" && (typeof value?.handoffCode !== "string" || !value.handoffCode || value.accessToken !== undefined)) return null;
    if (!value || typeof value !== "object" || value.capability !== capability || typeof value.organizationId !== "string" || !value.organizationId ||
      !(typeof value.accessToken === "string" && value.accessToken || typeof value.handoffCode === "string" && value.handoffCode)) return null;
    return value;
  } catch {
    return null;
  }
}

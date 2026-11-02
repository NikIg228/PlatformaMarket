import { server, response, mfaStatus, org, type Reply } from "./market-session";
import { mfaChallengeElevated } from "./mfa";
export const entryPassword = "SYNTHETIC-entry-password";
export function entryElevation(method: "TOTP" | "RECOVERY_CODE" = "TOTP", serial = 0) { return { ...mfaChallengeElevated(method, serial), activeOrganizationId: org }; }
export function entryBackend(override?: (path: string, init: RequestInit) => Reply | Promise<Reply> | undefined) {
  let serial = 0;
  return server((path, init) => {
    const custom = override?.(path, init); if (custom) return custom;
    if (path.startsWith("/auth/current")) return response(null);
    if (path === "/identity/mfa") return response(mfaStatus(true));
    if (path === "/identity/mfa/challenge") return response(entryElevation(/^\d{6}$/.test(JSON.parse(String(init.body)).code) ? "TOTP" : "RECOVERY_CODE", serial++), 201);
  });
}

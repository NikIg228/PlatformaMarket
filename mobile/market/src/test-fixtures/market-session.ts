import type { FetchTransport } from "../market-transport";

// Existing synthetic unit-test data/transport only; never import in the application.
export const api = "https://market.example.invalid/api";
export const user = { id: "00000000-0000-4000-8000-000000000001", email: "synthetic@example.invalid", displayName: "Synthetic user" };
export const org = "00000000-0000-4000-8000-000000000002";
export const otherOrg = "00000000-0000-4000-8000-000000000003";
export const loginId = "00000000-0000-4000-8000-000000000004";
export const sessionId = "00000000-0000-4000-8000-000000000005";
export const accessToken = "synthetic-buyer-access-token";
export const csrf = "synthetic-csrf-token-for-only-tests";
export const workspace = (organizationId = org) => ({ organizationId, organizationDisplayName: `Synthetic ${organizationId}`, capabilities: ["BUYER"] });
export const current = (overrides: object = {}) => ({ user, accessToken, accessTokenExpiresIn: 300, sessionId, activeOrganizationId: org, organizationIds: [org],
  csrfToken: csrf, refreshTokenExpiresAt: "2099-01-01T00:00:00.000Z", workspaces: [workspace()], ...overrides });
export const login = () => ({ ...current(), sessionId: loginId, accessToken: "synthetic-login-access-token", organizationIds: [org, otherOrg], workspaces: undefined });
export const exchange = (organizationId = org) => ({ ...current(), workspaces: undefined, organizationId, activeOrganizationId: organizationId, organizationIds: [organizationId], organizationDisplayName: `Synthetic ${organizationId}`, capability: "BUYER" });
export const mfaStatus = (enabled = false) => ({ enabled, status: enabled ? "ACTIVE" : "NOT_ENROLLED", verifiedAt: null, lastUsedAt: null, recoveryCodesRemaining: 0, lockedUntil: null });
export function response(payload: unknown, status = 200) { return { status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(payload) }; }
export type Reply = ReturnType<typeof response>;
export function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
export async function until(predicate: () => boolean) { for (let n = 0; n < 100 && !predicate(); n++) await Promise.resolve(); expect(predicate()).toBe(true); }
export function server(override?: (path: string, init: RequestInit) => Reply | Promise<Reply> | undefined) {
  return jest.fn<ReturnType<FetchTransport>, Parameters<FetchTransport>>(async (url, init) => {
    const path = url.slice(api.length); const custom = override?.(path, init); if (custom) return custom;
    if (path === "/auth/current?workspace=BUYER") return response(current());
    if (path === "/auth/login") return response(login(), 201);
    if (path === "/identity/mfa") return response(mfaStatus());
    if (path === "/auth/workspaces") return response([workspace(), workspace(otherOrg), { ...workspace("00000000-0000-4000-8000-000000000006"), capabilities: ["SUPPLIER"] }]);
    if (path === "/auth/workspace-context") return response(workspace((init.headers as Record<string, string>)["x-organization-id"] ?? org));
    if (path === "/auth/handoff") { const { organizationId, organizationDisplayName } = workspace((init.headers as Record<string, string>)["x-organization-id"]); return response({ organizationId, organizationDisplayName, capability: "BUYER", handoffCode: "synthetic-one-use-handoff-code", expiresAt: "2099-01-01T00:00:00.000Z" }, 201); }
    if (path === "/auth/handoff/exchange") return response(exchange(), 201);
    if (path === "/auth/refresh") { const { user: _, workspaces: __, ...refresh } = current({ accessToken: "synthetic-renewed-access-token" }); return response(refresh, 201); }
    if (path === "/auth/session-logout") { const body = JSON.parse(String(init.body)); return response({ sessionId: body.sessionId, status: "REVOKED", loginStatus: "REVOKED" }, 201); }
    return response({ read: path });
  });
}
export const paths = (fetcher: ReturnType<typeof server>) => fetcher.mock.calls.map(([url]) => url.slice(api.length));

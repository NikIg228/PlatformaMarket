import { login, server, response, type Reply } from "./market-session";
// Synthetic source-shaped mail code and session only; never import from application code.
export const verificationToken = "SYNTHETIC-email-proof-only-opaque-code".repeat(2);
export const verificationLink = `https://mail-link.example.invalid/verify-email?token=${verificationToken}`;
export const verificationRoute = "/auth/email/verify";
export const verificationInput = () => ({ token: verificationToken });
export function verifiedReply(overrides: object = {}) { const { workspaces: _, ...session } = login(); return { ...session, verified: true, ...overrides }; }
export function verificationBackend(override?: (path: string, init: RequestInit) => Reply | Promise<Reply> | undefined) { return server((path, init) => { const custom = override?.(path, init); if (custom) return custom; if (path === "/auth/current?workspace=BUYER") return response(null); if (path === verificationRoute) return response(verifiedReply(), 201); return undefined; }); }

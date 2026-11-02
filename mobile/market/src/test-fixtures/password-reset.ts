import { server, response, type Reply } from "./market-session";
// Synthetic opaque code and password; never import from application code.
export const resetToken = "SYNTHETIC-reset-only-opaque-code".repeat(2);
export const resetPassword = "  SYNTHETIC-new-password  ";
export const resetLink = `https://mail-link.example.invalid/reset-password?token=${encodeURIComponent(resetToken)}`;
export const resetInput = () => ({ token: resetToken, password: resetPassword });
export const resetRoute = "/auth/password/reset";
export function resetBackend(reply: Reply | Promise<Reply> = response({ ok: true }, 201)) { return server(path => path === "/auth/current?workspace=BUYER" ? response(null) : path === resetRoute ? reply : undefined); }

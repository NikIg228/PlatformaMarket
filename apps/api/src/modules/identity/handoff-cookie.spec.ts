import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthSessionsController } from "./auth-sessions.controller";

const config = vi.hoisted(() => ({ NODE_ENV: "test", AUTH_COOKIE_DOMAIN: ".example.invalid" }));
vi.mock("../../platform/config/environment", () => ({ environment: () => config }));
afterEach(() => { config.NODE_ENV = "test"; });
describe("browser-bound handoff cookie", () => {
  it.each(["test", "production"])("issues a host-only HttpOnly proof and clears the same cookie in %s", async mode => {
    config.NODE_ENV = mode;
    const issued = { handoffCode: "code", expiresAt: new Date(Date.now() + 120000), capability: "BUYER", organizationId: "org" };
    const sessions = { createHandoff: vi.fn().mockResolvedValue(issued), exchangeHandoff: vi.fn().mockResolvedValue({ ...issued, refreshToken: "refresh", csrfToken: "unused", refreshTokenExpiresAt: issued.expiresAt }) };
    const controller = new AuthSessionsController(sessions as never);
    const response = { cookie: vi.fn(), clearCookie: vi.fn() };
    await controller.createHandoff("user", "org", "source", { capability: "BUYER" }, response as never);
    const [name, proof, options] = response.cookie.mock.calls[0];
    expect(proof).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(name).toBe(`${mode === "production" ? "__Host-" : ""}mp_handoff_buyer`);
    expect(options).toMatchObject({ httpOnly: true, secure: mode === "production", sameSite: "lax", path: mode === "production" ? "/" : "/api/auth/handoff" });
    expect(options).not.toHaveProperty("domain");
    expect(sessions.createHandoff).toHaveBeenCalledWith("user", "org", "BUYER", "source", proof);
    expect(issued).not.toHaveProperty("browserProof");
    const request = { ip: "127.0.0.1", header: (key: string) => key === "cookie" ? `${name}=${proof}` : undefined };
    await controller.exchangeHandoff({ handoffCode: "c".repeat(32) }, request as never, response as never);
    expect(sessions.exchangeHandoff).toHaveBeenCalledWith("c".repeat(32), { BUYER: proof, SUPPLIER: undefined }, expect.any(Object));
    expect(response.clearCookie).toHaveBeenCalledWith(name, expect.objectContaining({ path: options.path, httpOnly: true, secure: options.secure }));
  });
});

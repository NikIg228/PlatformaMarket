import { beforeEach, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { AuthSessionsController } from "./auth-sessions.controller";
import { AuthSessionsService } from "./auth-sessions.service";

vi.mock("../../platform/config/environment", () => ({ environment: () => ({ NODE_ENV: "test", JWT_SECRET: "synthetic-key-at-least-thirty-two-characters", AUTH_ACCESS_TOKEN_TTL_SECONDS: 900 }) }));
let sessions: any, controller: AuthSessionsController, response: any;
beforeEach(() => {
  sessions = { loginOperator: vi.fn(async () => ({ accessToken: "token", refreshToken: "private-refresh", refreshTokenExpiresAt: new Date(Date.now() + 60_000) })), currentOperatorSession: vi.fn(async () => null), revokeByRefreshToken: vi.fn() };
  controller = new AuthSessionsController(sessions);
  response = { cookie: vi.fn(), clearCookie: vi.fn(), json: vi.fn() };
});
const request = (cookie = "", csrf = "") => ({ header: (name: string) => name === "cookie" ? cookie : name === "x-csrf-token" ? csrf : undefined });
it("operator login rejects client authority and never leaks refresh tokens", async () => {
  await expect(controller.operatorLogin({ email: "operator@example.invalid", password: "pw", role: "OPERATOR" }, request() as never, response)).rejects.toThrow();
  expect(sessions.loginOperator).not.toHaveBeenCalled();
  const result = await controller.operatorLogin({ email: "operator@example.invalid", password: "pw" }, request() as never, response);
  expect(result.refreshToken).toBeUndefined();
  expect(response.cookie).toHaveBeenCalledWith("mp_refresh_admin", "private-refresh", expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/api/auth" }));
  expect(response.cookie).toHaveBeenCalledWith("mp_csrf_admin", expect.any(String), expect.objectContaining({ httpOnly: false, path: "/" }));
});
it("restores only operator cookies and renders absent sessions as JSON null", async () => {
  await controller.currentOperator(request("mp_refresh=buyer; mp_csrf=buyer-proof; mp_refresh_admin=staff; mp_csrf_admin=staff-proof") as never, response);
  expect(sessions.currentOperatorSession).toHaveBeenCalledWith("staff", "staff-proof");
  expect(response.json).toHaveBeenCalledWith(null);
});
it("logout requires matching CSRF, revokes the operator session and leaves other cookies alone", async () => {
  const cookie = "mp_refresh=buyer; mp_refresh_admin=staff; mp_csrf_admin=proof";
  await expect(controller.operatorLogout(request(cookie, "wrong") as never, response)).rejects.toThrow("CSRF");
  expect(sessions.revokeByRefreshToken).not.toHaveBeenCalled();
  await controller.operatorLogout(request(cookie, "proof") as never, response);
  expect(sessions.revokeByRefreshToken).toHaveBeenCalledWith("staff", undefined, "operator_logout");
  expect(response.clearCookie.mock.calls.map((call: unknown[]) => call[0])).toEqual(["mp_refresh_admin", "mp_csrf_admin"]);
});
it("restoration rechecks operator authority and binds the token to that organization", async () => {
  const data = { id: "session", userId: "staff", user: { id: "staff", email: "operator@example.invalid", displayName: "Staff", status: "ACTIVE" }, activeOrganizationId: "operator", organizationIds: ["operator"], authMethods: ["password", "operator_password"], expiresAt: new Date(Date.now() + 60_000) };
  const db = { authSession: { findFirst: vi.fn(async () => data) } };
  const authority = { assertPlatformOperator: vi.fn() };
  const service = new AuthSessionsService(db as never, {} as never, {} as never, authority as never);
  const current = await service.currentOperatorSession("refresh", "synthetic-csrf-with-enough-characters");
  expect(current?.organizationIds).toEqual(["operator"]);
  expect(current).not.toHaveProperty("refreshToken");
  authority.assertPlatformOperator.mockRejectedValue(new ForbiddenException());
  expect(await service.currentOperatorSession("refresh", "synthetic-csrf-with-enough-characters")).toBeNull();
});

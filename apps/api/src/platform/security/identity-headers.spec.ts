import { expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { identityContextMiddleware } from "./identity-context.middleware";
const config = vi.hoisted(() => ({ AUTH_MODE: "jwt", JWT_SECRET: "synthetic-jwt-secret-at-least-32-characters" }));
vi.mock("../config/environment", () => ({ environment: () => config }));
function request(headers: Record<string, string>) { return { headers, header: (name: string) => headers[name], originalUrl: "/api/auth/workspace-context" }; }
it("removes every untrusted identity header from anonymous requests", () => {
  const req = request({ "x-user-id": "operator", "x-organization-id": "foreign", "x-session-id": "fake", "x-authentication-methods": "mfa" });
  const next = vi.fn(); identityContextMiddleware()(req as never, {} as never, next);
  expect(req.headers).toEqual({}); expect(next).toHaveBeenCalledWith();
});
it.each(["Bearer", "bearer", "BEARER"])("derives actor, tenant and session solely from a valid active %s JWT", async scheme => {
  const token = jwt.sign({ organization_ids: ["org"], organization_id: "org", amr: ["password"] }, config.JWT_SECRET, { subject: "member", jwtid: "real-session", expiresIn: 60 });
  const req = request({ authorization: `${scheme} ${token}`, "x-user-id": "operator", "x-session-id": "fake", "x-authentication-methods": "mfa" });
  const assertActive = vi.fn().mockResolvedValue(undefined);
  await new Promise<void>((resolve, reject) => identityContextMiddleware({ assertActive })(req as never, {} as never, error => error ? reject(error) : resolve()));
  expect(assertActive).toHaveBeenCalledWith("real-session", "member");
  expect(req.headers).toMatchObject({ "x-user-id": "member", "x-organization-id": "org", "x-session-id": "real-session", "x-authentication-methods": "password" });
});
it.each(["enroll", "heartbeat", "jobs/claim", "jobs/job/complete", "jobs/job/fail"])("routes connector %s credentials to its controller after clearing identity headers", action => {
  const req = { ...request({ authorization: "Bearer synthetic-agent-token", "x-user-id": "operator", "x-organization-id": "foreign", "x-session-id": "fake", "x-authentication-methods": "mfa" }), method: "POST", originalUrl: `/api/connector-agents/agent/${action}/?query=value` };
  const next = vi.fn();
  identityContextMiddleware()(req as never, {} as never, next);
  expect(next).toHaveBeenCalledWith();
  expect(req.headers).toEqual({ authorization: "Bearer synthetic-agent-token" });
});
it.each([
  ["GET", "/api/connector-agents/agent/heartbeat"],
  ["POST", "/api/connector-agents/agent/heartbeat/admin"],
  ["POST", "/api/connector-agents/agent/jobs/job/complete/extra"],
  ["POST", "/api/auth/sessions/session/organization"],
])("does not accept agent credentials on %s %s", async (method, originalUrl) => {
  const req = { ...request({ authorization: "Bearer synthetic-agent-token" }), method, originalUrl };
  const error = await new Promise(resolve => identityContextMiddleware()(req as never, {} as never, resolve));
  expect(error).toMatchObject({ status: 401 });
});
it.each(["/api/metrics", "/api/metrics/", "/api/metrics?format=prometheus"])("leaves %s scraper credentials for the metrics controller without trusting identity headers", path => {
  const req = { ...request({ authorization: "Bearer synthetic-scraper-token", "x-user-id": "operator", "x-organization-id": "foreign", "x-session-id": "fake", "x-authentication-methods": "mfa" }), method: "GET", originalUrl: path };
  const next = vi.fn();
  identityContextMiddleware()(req as never, {} as never, next);
  expect(next).toHaveBeenCalledWith();
  expect(req.headers).toEqual({ authorization: "Bearer synthetic-scraper-token" });
});
it.each(["/api/metrics/private", "/api/metrics-other", "/api/auth/workspace-context"])("never treats %s as a metrics route", async path => {
  const req = { ...request({ authorization: "Bearer synthetic-scraper-token" }), method: "GET", originalUrl: path };
  const error = await new Promise(resolve => identityContextMiddleware()(req as never, {} as never, resolve));
  expect(error).toMatchObject({ status: 401 });
});

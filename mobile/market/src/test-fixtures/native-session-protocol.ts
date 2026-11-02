import { createMarketSession, type SessionSnapshot } from "../market-session";
import type { FetchTransport } from "../market-transport";
import * as fixture from "./market-session";

export const sessionProtocolCaseIds = ["restore-logout", "login-select", "mfa-select", "expired-refresh", "refresh-revoked", "context-denied", "forbidden-json-refresh", "logout-network"] as const;
type Case = typeof sessionProtocolCaseIds[number];
type Kind = "null" | "array" | "object" | "string" | "number" | "boolean";
type Shape = Readonly<Record<string, Kind>>;
type Step = Readonly<{ event: string; phase: SessionSnapshot["phase"]; issue?: SessionSnapshot["issue"]; hasSession: boolean; canLogout: boolean; choices: number }>;
type Call = Readonly<{ method: "GET" | "POST"; path: string; queryKeys: readonly string[]; headerNames: readonly string[]; cookies: boolean; rejectsRedirects: boolean; bodyType: Kind | "absent"; bodyFields: Shape; httpStatus: number | "network-error"; responseType?: Kind; responseFields?: Shape; responseItemFields?: Shape }>;
export type NativeSessionProtocolReport = Readonly<{
  formatVersion: 1; scenario: Case; transitions: readonly Step[]; requests: readonly Call[];
  syntheticTransportCalls: number; businessCommandCalls: 0; realNetworkRequests: 0; realServerMutations: 0;
  realInputsAccepted: false; credentialStoreAccessed: false; serverAccepted: false; productionAuthorizationVerified: false;
  defaultNativeMutationAdmission: "NOT_VERIFIED";
}>;
const paths = new Set(["/auth/current", "/auth/workspace-context", "/auth/login", "/identity/mfa", "/auth/workspaces", "/auth/handoff", "/auth/handoff/exchange", "/identity/mfa/challenge", "/auth/refresh", "/auth/session-logout", "/supplier-orders/:id/workflow"]);
function kind(value: unknown): Kind {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean" || type === "object") return type;
  throw Error("Unsupported synthetic protocol field");
}
function shape(value: unknown): Shape {
  if (!value || typeof value !== "object" || Array.isArray(value)) return Object.freeze({});
  const source = value as Record<string, unknown>;
  return Object.freeze(Object.fromEntries(Object.keys(source).sort().map(key => {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) throw Error("Unsupported synthetic protocol field name");
    return [key, kind(source[key])];
  })));
}

/** Actual controller on generated synthetic transport. Only names/types/phases escape this function. */
export async function syntheticNativeSessionProtocol(scenario: Case): Promise<NativeSessionProtocolReport> {
  if (!sessionProtocolCaseIds.includes(scenario)) throw Error("Unknown synthetic session scenario");
  let time = 0;
  const fake = fixture.server(path => {
    if (scenario === "context-denied" && path === "/auth/workspace-context") return fixture.response(null, 403);
    if (scenario === "forbidden-json-refresh" && path === "/auth/login") return fixture.response({ ...fixture.login(), refreshToken: "synthetic-forbidden-refresh-proof" }, 201);
    if (scenario === "refresh-revoked" && path === "/auth/refresh") return fixture.response(null, 401);
    if (scenario === "logout-network" && path === "/auth/session-logout") throw TypeError("synthetic private transport failure");
    if (scenario === "mfa-select" && path === "/identity/mfa") return fixture.response(fixture.mfaStatus(true));
    if (scenario === "mfa-select" && path === "/identity/mfa/challenge") return fixture.response({ accessToken: "synthetic-elevated-access-token", accessTokenExpiresIn: 300, activeOrganizationId: fixture.org, authenticationMethods: ["password", "totp"], factor: { verified: true, method: "TOTP", challengeId: fixture.user.id, recoveryCodesRemaining: 0 } });
    return undefined;
  });
  const calls: Call[] = [], transitions: Step[] = [];
  const fetcher: FetchTransport = async (url, init) => {
    const parsed = new URL(url), path = parsed.pathname.replace(/^\/api(?=\/)/, "").replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id"), method = init.method ?? "GET";
    if (!paths.has(path) || method !== "GET" && method !== "POST") throw Error("Unsupported synthetic session request");
    const body = init.body === undefined ? undefined : JSON.parse(String(init.body));
    const common: Omit<Call, "httpStatus" | "responseType" | "responseFields" | "responseItemFields"> = { method, path, queryKeys: Object.freeze([...parsed.searchParams.keys()].sort()), headerNames: Object.freeze(Object.keys(init.headers ?? {}).map(key => key.toLowerCase()).sort()), cookies: init.credentials === "include", rejectsRedirects: init.redirect === "error", bodyType: body === undefined ? "absent" : kind(body), bodyFields: shape(body) };
    let reply: fixture.Reply;
    try { reply = await fake(url, init); }
    catch (error) { calls.push(Object.freeze({ ...common, httpStatus: "network-error" })); throw error; }
    const raw = await reply.text(), value: unknown = JSON.parse(raw);
    calls.push(Object.freeze({ ...common, httpStatus: reply.status, responseType: kind(value), responseFields: shape(value), ...(Array.isArray(value) && value.length ? { responseItemFields: shape(value[0]) } : {}) }));
    return { ...reply, text: async () => raw };
  };
  const controller = createMarketSession(fixture.api, fetcher, () => time);
  const record = (event: string) => {
    const state = controller.getSnapshot();
    transitions.push(Object.freeze({ event, phase: state.phase, ...(state.issue ? { issue: state.issue } : {}), hasSession: !!state.session, canLogout: state.canLogout, choices: state.choices.length }));
  };
  try {
    if (scenario === "login-select" || scenario === "mfa-select" || scenario === "forbidden-json-refresh") {
      await controller.login(fixture.user.email, "synthetic-password"); record("login");
      if (scenario === "mfa-select") { await controller.challenge("123456"); record("challenge"); }
      if (scenario !== "forbidden-json-refresh") { await controller.selectOrganization(fixture.org); record("select"); await controller.logout(); record("logout"); }
    } else {
      await controller.start(); record("start");
      if (scenario === "expired-refresh" || scenario === "refresh-revoked") {
        time = 280_000;
        const client = controller.getSnapshot().session?.client; if (!client) throw Error("Synthetic session not ready");
        try { await client.getOrderWorkflow(fixture.user.id); record("safe-read"); }
        catch { record("safe-read-rejected"); }
        if (scenario === "expired-refresh") { await controller.logout(); record("logout"); }
      } else if (scenario !== "context-denied") {
        await controller.logout(); record("logout");
        if (scenario === "logout-network") { if (controller.getSnapshot().session) throw Error("Unconfirmed logout must close business scope"); await controller.continueLogout(controller.getSnapshot()); record("check-current"); await controller.getSnapshot().session!.client.getOrderWorkflow(fixture.user.id); record("safe-read"); }
      }
    }
    if (calls.some(call => call.method !== "GET" && !call.path.startsWith("/auth/") && !call.path.startsWith("/identity/"))) throw Error("Unexpected synthetic business command");
    return Object.freeze({ formatVersion: 1, scenario, transitions: Object.freeze(transitions), requests: Object.freeze(calls), syntheticTransportCalls: calls.length, businessCommandCalls: 0, realNetworkRequests: 0, realServerMutations: 0, realInputsAccepted: false, credentialStoreAccessed: false, serverAccepted: false, productionAuthorizationVerified: false, defaultNativeMutationAdmission: "NOT_VERIFIED" });
  } finally { controller.requireLogin(); fake.mockClear(); }
}

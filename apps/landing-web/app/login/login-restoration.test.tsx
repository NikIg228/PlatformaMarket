import { beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";

vi.mock("@fluentui/react-components", async () => {
  const { createRequire } = await import("node:module");
  return createRequire(import.meta.url)("@fluentui/react-components");
});

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, jobs: [] as (() => void)[] }));
const auth = vi.hoisted(() => ({ resume: vi.fn(), contexts: vi.fn(), open: vi.fn(), personal: vi.fn(), query: new URLSearchParams(), returnTo: undefined as string | undefined }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) hooks.slots[index] = initial;
    return [hooks.slots[index], (value: unknown) => { hooks.slots[index] = typeof value === "function" ? value(hooks.slots[index]) : value; }];
  },
  useRef: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
    return hooks.slots[index];
  },
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    const index = hooks.cursor++;
    const previous = hooks.slots[index] as { deps: unknown[]; cleanup?: () => void } | undefined;
    if (previous && deps.every((value, i) => Object.is(value, previous.deps[i]))) return;
    const next = { deps, cleanup: undefined as undefined | (() => void) };
    hooks.slots[index] = next;
    hooks.jobs.push(() => { previous?.cleanup?.(); next.cleanup = effect() || undefined; });
  },
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => auth.query }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/script", () => ({ default: "script" }));
vi.mock("../use-product-return", () => ({ useProductReturn: () => auth.returnTo }));
vi.mock("@marketplace/ui", () => ({ DmButton: "button", DmField: "label", DmInput: "input", LoadingState: "loading" }));
vi.mock("../auth-components", () => ({ AuthBrand: "brand", AuthNotice: "notice" }));
vi.mock("./login-heading", () => ({ LoginHeading: "heading" }));
vi.mock("./workspace-choice", () => ({ LoginWorkspaceChoice: "choice" }));
vi.mock("../auth-client", async original => ({
  ...await original<typeof import("../auth-client")>(),
  resumeAuthSession: auth.resume, availableWorkspaces: auth.contexts, openWorkspace: auth.open, openPersonalWorkspace: auth.personal,
}));
import LoginPage from "./login-screen";

function render() {
  hooks.cursor = 0;
  return LoginPage();
}
function flushEffects() { hooks.jobs.splice(0).forEach(job => job()); }
function find(node: ReactNode, type: string): Record<string, unknown> | undefined {
  if (Array.isArray(node)) return node.map(child => find(child, type)).find(Boolean);
  if (!isValidElement<{ children?: ReactNode }>(node)) return undefined;
  if (node.type === type) return node.props;
  return find(node.props.children, type);
}
const session = { accessToken: "test", user: { id: "user", displayName: "Name" }, activeOrganizationId: "org" };
beforeEach(() => {
  hooks.slots = []; hooks.cursor = 0; hooks.jobs = [];
  vi.clearAllMocks(); auth.query = new URLSearchParams(); auth.returnTo = undefined;
  auth.resume.mockResolvedValue(null); auth.contexts.mockResolvedValue([]); auth.open.mockResolvedValue(undefined); auth.personal.mockResolvedValue(false);
});

it.each(["BUYER", "SUPPLIER"] as const)("never renders the login form while restoring and navigating to %s", async capability => {
  auth.returnTo = capability === "BUYER" ? "/clinic" : "/supplier";
  let resolveSession!: (value: typeof session) => void;
  let finishHandoff!: () => void;
  auth.resume.mockReturnValue(new Promise(resolve => { resolveSession = resolve; }));
  auth.contexts.mockResolvedValue([{ organizationId: "org", organizationDisplayName: "Org", capabilities: [capability] }]);
  auth.open.mockReturnValue(new Promise<void>(resolve => { finishHandoff = resolve; }));
  expect(find(render(), "loading")).toBeDefined();
  expect(find(render(), "form")).toBeUndefined();
  flushEffects(); resolveSession(session);
  await vi.waitFor(() => expect(auth.open).toHaveBeenCalledWith(session, capability, "org", auth.returnTo));
  expect(find(render(), "loading")).toBeDefined();
  finishHandoff(); await new Promise<void>(resolve => setImmediate(resolve));
  expect(find(render(), "loading")).toBeDefined();
  expect(find(render(), "form")).toBeUndefined();
});

it("shows the form only after an absent or expired session is confirmed", async () => {
  expect(find(render(), "form")).toBeUndefined(); flushEffects();
  await vi.waitFor(() => expect(find(render(), "form")).toBeDefined());
  expect(auth.open).not.toHaveBeenCalled();
});

it("does not auto-resume after explicit sign-out", () => {
  auth.query.set("signedOut", "1");
  expect(find(render(), "form")).toBeDefined(); flushEffects();
  expect(auth.resume).not.toHaveBeenCalled();
});

it.each(["check", "handoff"])("recovers from a failed %s without leaving a permanent spinner", async failure => {
  if (failure === "check") auth.resume.mockRejectedValue(new Error("Offline"));
  else {
    auth.resume.mockResolvedValue(session);
    auth.contexts.mockResolvedValue([{ organizationId: "org", organizationDisplayName: "Org", capabilities: ["SUPPLIER"] }]);
    auth.open.mockRejectedValue(new Error("Offline"));
  }
  render(); flushEffects();
  await vi.waitFor(() => expect(find(render(), "notice")).toBeDefined());
  expect(find(render(), "form")).toBeDefined();
});

it.each([false, true])("keeps explicit workspace choice reachable (unavailable=%s)", async unavailable => {
  auth.resume.mockResolvedValue(session);
  auth.returnTo = unavailable ? "/supplier" : undefined;
  auth.contexts.mockResolvedValue([{ organizationId: "org", organizationDisplayName: "Org", capabilities: unavailable ? ["BUYER"] : ["BUYER", "SUPPLIER"] }]);
  render(); flushEffects();
  await vi.waitFor(() => expect(find(render(), "choice")?.unavailable).toBe(unavailable));
  expect(find(render(), "form")).toBeUndefined();
  expect(auth.open).not.toHaveBeenCalled();
  (find(render(), "choice")?.onSwitchAccount as () => void)();
  expect(find(render(), "form")).toBeDefined();
});

it.each([false, true])("restores explicit personal entry without a form flash (session exists=%s)", async exists => {
  auth.query.set("personal", "1"); auth.personal.mockResolvedValue(true);
  auth.resume.mockResolvedValue(exists ? { ...session, activeOrganizationId: undefined } : null);
  render(); flushEffects();
  await vi.waitFor(() => expect(auth.personal).toHaveBeenCalled());
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(find(render(), "loading")).toBeDefined();
  expect(find(render(), "form")).toBeUndefined();
  expect(auth.open).not.toHaveBeenCalled();
});

it("shows the form when personal entry has expired", async () => {
  auth.query.set("personal", "1");
  render(); flushEffects();
  await vi.waitFor(() => expect(find(render(), "form")).toBeDefined());
});

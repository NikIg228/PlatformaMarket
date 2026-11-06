import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, jobs: [] as (() => void)[] }));
const state = vi.hoisted(() => ({ buyer: { ready: true, session: null as null | { organizationId: string } }, get: vi.fn() }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) hooks.slots[index] = initial;
    return [hooks.slots[index], (value: unknown) => { hooks.slots[index] = typeof value === "function" ? value(hooks.slots[index]) : value; }];
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
vi.mock("../../use-buyer-session", () => ({ useBuyerSession: () => state.buyer }));
vi.mock("../../personal-session", () => ({ usePersonalSession: () => ({ ready: true, error: null, session: { user: { id: "user", displayName: "Personal" } } }), personalSessionStore: { retry: vi.fn() } }));
vi.mock("../../resilient-get", () => ({ resilientGet: state.get }));
vi.mock("../../public-links", () => ({ loginUrl: "/login" }));
vi.mock("@marketplace/ui/controls", () => ({ DmButton: "button" }));
import { HeaderAccount } from "./header-account";

function render() {
  hooks.cursor = 0;
  const view = HeaderAccount() as ReactElement<{ children?: ReactElement<{ label?: string }>; href?: string }>;
  hooks.jobs.splice(0).forEach(job => job());
  return view;
}
beforeEach(() => {
  hooks.slots = []; hooks.cursor = 0; hooks.jobs = [];
  state.buyer = { ready: true, session: null }; state.get.mockReset();
  vi.stubGlobal("window", { location: { pathname: "/catalog", search: "" }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

it("keeps navigation closed until the replacement session check completes", async () => {
  const pending: ((response: Response) => void)[] = [];
  state.get.mockImplementation((_url: string, options: { signal: AbortSignal }) => new Promise((resolve, reject) => {
    pending.push(resolve);
    options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
  }));
  expect(render().props.children?.props.label).toBe("Загружаем кабинет…");
  await vi.waitFor(() => expect(state.get).toHaveBeenCalledTimes(1));
  state.buyer.session = { organizationId: "changed" };
  render();
  await vi.waitFor(() => expect(state.get).toHaveBeenCalledTimes(2));
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(render().props.children?.props.label).toBe("Загружаем кабинет…");
  pending[1](Response.json(null));
  await vi.waitFor(() => expect(render().props.href).toBe("/personal/cart"));
});

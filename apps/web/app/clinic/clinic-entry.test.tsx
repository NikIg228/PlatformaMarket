import { afterEach, beforeEach, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ ready: false, mounted: false, effect: undefined as undefined | (() => void) }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: () => [hooks.ready, (ready: boolean) => { hooks.ready = ready; }],
  useEffect: (effect: () => void) => { if (!hooks.mounted) { hooks.effect = effect; hooks.mounted = true; } },
}));
vi.mock("../workspaces/workspace", () => ({ Workspace: "workspace" }));
import { ClinicEntry } from "./clinic-entry";
import { buyerMode, requireOrganizationMode, setBuyerMode } from "../../../buyer-web/app/buyer-context";

beforeEach(() => {
  hooks.ready = false; hooks.mounted = false; hooks.effect = undefined;
  const data = new Map<string, string>();
  vi.stubGlobal("window", { sessionStorage: { getItem: (key: string) => data.get(key), setItem: (key: string, value: string) => data.set(key, value) }, dispatchEvent: vi.fn() });
  setBuyerMode("personal");
});
afterEach(() => vi.unstubAllGlobals());

it("enters the clinic from a personal cart before mounting workspace consumers", () => {
  expect(ClinicEntry({ children: "content" }).props.preparing).toBe(true);
  expect(buyerMode()).toBe("personal");
  hooks.effect?.();
  expect(buyerMode()).toBe("organization");
  const ready = ClinicEntry({ children: "content" });
  expect(ready.props.preparing).toBe(false);
  expect(ready.props.children).toBe("content");
});

it("does not override a later fail-closed context or organization-switch lock", () => {
  ClinicEntry({ children: "workspace" }); hooks.effect?.();
  setBuyerMode("personal");
  ClinicEntry({ children: "workspace" });
  expect(() => requireOrganizationMode()).toThrow("Оформление личных покупок пока недоступно");
  setBuyerMode("switching");
  ClinicEntry({ children: "workspace" });
  expect(() => requireOrganizationMode()).toThrow("Дождитесь");
});

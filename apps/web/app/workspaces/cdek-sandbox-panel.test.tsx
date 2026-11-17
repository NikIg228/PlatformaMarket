import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, effects: [] as (() => void)[] }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => { const index = hooks.cursor++; if (!(index in hooks.slots)) hooks.slots[index] = initial; return [hooks.slots[index], (value: unknown) => { hooks.slots[index] = typeof value === "function" ? value(hooks.slots[index]) : value; }]; },
  useRef: (initial: unknown) => { const index = hooks.cursor++; if (!(index in hooks.slots)) hooks.slots[index] = { current: initial }; return hooks.slots[index]; },
  useEffect: (effect: () => void) => { const index = hooks.cursor++; if (!(index in hooks.slots)) { hooks.slots[index] = true; hooks.effects.push(effect); } },
}));
vi.mock("@marketplace/ui", () => ({ DmButton: "button", DmField: "field", DmInput: "input", DmSelect: "select", Section: "section" }));
vi.mock("@marketplace/ui/primitives", () => ({ ErrorState: "error" }));
vi.mock("@marketplace/ui/loading-state", () => ({ LoadingState: "loading" }));
vi.mock("@marketplace/ui/money", () => ({ formatMoney: (value: string) => value }));
import { CdekSandboxPanel } from "./cdek-sandbox-panel";
type Node = ReactElement<Record<string, unknown>>;
function nodes(value: ReactNode): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...nodes(value.props.children as ReactNode)];
}
describe("CDEK order panel", () => {
  const status = vi.fn(), quote = vi.fn();
  const api = { cdekSandboxStatus: status, cdekSandboxQuote: quote } as unknown as MarketplaceApiClient;
  const render = () => { hooks.cursor = 0; const tree = CdekSandboxPanel({ api, orderId: "order", locale: "ru" }); for (const effect of hooks.effects.splice(0)) effect(); return nodes(tree); };
  const action = (tree: Node[]) => tree.find(node => node.type === "button" && node.props.children === "Рассчитать доставку")!.props.onClick as () => void;
  async function ready() { render(); await Promise.resolve(); await Promise.resolve(); return render(); }
  function fill() {
    let tree = render();
    for (const node of tree.filter(node => typeof node.type === "function")) (node.props.onChange as (code: number) => void)(4756);
    tree = render();
    for (const node of tree.filter(node => node.type === "input")) (node.props.onChange as (event: null, data: { value: string }) => void)(null, { value: node.props["aria-label"] === "Вес с упаковкой, г" ? "1000" : "20" });
  }
  beforeEach(() => { hooks.slots = []; hooks.effects = []; hooks.cursor = 0; status.mockReset().mockResolvedValue({ enabled: true, mode: "sandbox" }); quote.mockReset(); });
  it("rejects incomplete input before contacting CDEK", async () => {
    action(await ready())(); expect(quote).not.toHaveBeenCalled(); expect(render().some(node => node.type === "error")).toBe(true);
  });
  it("keeps parcel inputs when the provider fails and permits retry", async () => {
    await ready(); fill(); quote.mockRejectedValue(new Error("upstream secret")); action(render())(); await Promise.resolve(); await Promise.resolve();
    const tree = render(); expect(tree.find(node => node.type === "input" && node.props["aria-label"] === "Вес с упаковкой, г")?.props.value).toBe("1000");
    expect(tree.find(node => node.type === "error")?.props.description).not.toContain("secret");
    expect(tree.find(node => node.type === "button" && node.props.children === "Рассчитать доставку")?.props.disabled).toBe(false);
  });
  it("removes obsolete tariffs as soon as parcel parameters change", async () => {
    await ready(); fill(); quote.mockResolvedValue({ mode: "sandbox", payable: false, currency: "KZT", tariffs: [{ code: 136, name: "Тариф", deliveryMode: 4, amountMinor: "10000", minDays: 2, maxDays: 3 }] });
    action(render())(); await Promise.resolve(); await Promise.resolve(); let tree = render(); expect(tree.some(node => node.type === "select")).toBe(true);
    (tree.find(node => node.type === "select")!.props.onChange as (event: null, data: { value: string }) => void)(null, { value: "136" });
    tree = render(); expect(tree.some(node => node.props.role === "status")).toBe(true);
    (tree.find(node => node.type === "input")!.props.onChange as (event: null, data: { value: string }) => void)(null, { value: "2000" });
    tree = render(); expect(tree.some(node => node.type === "select")).toBe(false); expect(tree.some(node => node.props.role === "status")).toBe(false);
  });
  it("shows disabled configuration without a calculation action", async () => {
    status.mockResolvedValue({ enabled: false }); const tree = await ready(); expect(tree.some(node => node.type === "button")).toBe(false);
    expect(tree.some(node => node.props.children === "Тестовое подключение не настроено на сервере.")).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, jobs: [] as (() => void)[] }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === "function" ? initial() : initial;
    return [hooks.slots[index], (value: unknown) => {
      hooks.slots[index] = typeof value === "function" ? value(hooks.slots[index]) : value;
    }];
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
vi.mock("@marketplace/ui/controls", () => ({ DmButton: "button" }));
vi.mock("@marketplace/ui/primitives", () => ({ ErrorState: "error", LoadingState: "loading" }));
import { deferredOffer } from "./deferred-offer";

type Props = { open: boolean; offerId: string; initiallyEditing: boolean; cancel: () => void };
type View = ReactElement<Record<string, unknown>> | null;
const options = { label: "Загружаем предложение", active: (props: Props) => props.open, cancel: (props: Props) => props.cancel() };
function render(Component: (props: Props) => View, props: Props) {
  hooks.cursor = 0;
  const result = Component(props);
  hooks.jobs.splice(0).forEach(job => job());
  return result;
}
const props = (): Props => ({ open: true, offerId: "offer-a", initiallyEditing: true, cancel: vi.fn() });

describe("deferred offer lifecycle", () => {
  beforeEach(() => { hooks.slots = []; hooks.cursor = 0; hooks.jobs = []; });

  it("does not load a closed panel and retains the loaded panel on close", async () => {
    const Loaded = () => null, load = vi.fn(async () => Loaded);
    const Panel = deferredOffer<Props>(load, options), current = props();
    expect(render(Panel, { ...current, open: false })).toBeNull();
    expect(load).not.toHaveBeenCalled();
    render(Panel, current);
    await vi.waitFor(() => expect(render(Panel, current)?.type).toBe(Loaded));
    const closed = render(Panel, { ...current, open: false });
    expect(closed?.type).toBe(Loaded);
    expect(closed?.props.open).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("forwards the latest offer and direct-edit flag when the import resolves", async () => {
    const Loaded = () => null;
    let resolve!: (component: typeof Loaded) => void;
    const Panel = deferredOffer<Props>(() => new Promise(done => { resolve = done; }), options);
    const current = props();
    render(Panel, current);
    await vi.waitFor(() => expect(resolve).toBeTypeOf("function"));
    const latest = { ...current, offerId: "offer-b" };
    render(Panel, latest);
    resolve(Loaded);
    await vi.waitFor(() => expect(render(Panel, latest)?.type).toBe(Loaded));
    expect(render(Panel, latest)?.props).toEqual(latest);
  });

  it("does not reopen a panel cancelled while its chunk was loading", async () => {
    const Loaded = () => null;
    let resolve!: (component: typeof Loaded) => void;
    const Panel = deferredOffer<Props>(() => new Promise(done => { resolve = done; }), options);
    const current = props();
    const view = render(Panel, current)!;
    const event = { key: "Escape", preventDefault: vi.fn(), stopPropagation: vi.fn() };
    (view.props.onKeyDown as (value: typeof event) => void)(event);
    expect(current.cancel).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(resolve).toBeTypeOf("function"));
    expect(render(Panel, { ...current, open: false })).toBeNull();
    resolve(Loaded);
    await Promise.resolve();
    await Promise.resolve();
    expect(render(Panel, { ...current, open: false })).toBeNull();
  });

  it("offers a retry after chunk failure without changing the selected offer", async () => {
    const Loaded = () => null;
    const load = vi.fn<() => Promise<typeof Loaded>>().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(Loaded);
    const Panel = deferredOffer<Props>(load, options), current = props();
    render(Panel, current);
    let error!: ReactElement<{ action: ReactElement<{ onClick: () => void }> }>;
    await vi.waitFor(() => {
      error = (render(Panel, current)!.props.children as ReactElement[])[0] as typeof error;
      expect(error.type).toBe("error");
    });
    error.props.action.props.onClick();
    render(Panel, current);
    await vi.waitFor(() => expect(render(Panel, current)?.type).toBe(Loaded));
    expect(render(Panel, current)?.props.offerId).toBe("offer-a");
    expect(load).toHaveBeenCalledTimes(2);
  });
});

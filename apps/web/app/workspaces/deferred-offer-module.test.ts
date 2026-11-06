import { describe, expect, it, vi } from "vitest";
import { deferredOfferModule } from "./deferred-offer-module";

describe("deferred offer module", () => {
  it("does not import until requested and shares an in-flight load", async () => {
    const component = () => null;
    const load = vi.fn(async () => component);
    const module = deferredOfferModule(load);
    expect(load).not.toHaveBeenCalled();
    expect(module.current()).toBeUndefined();
    const first = module.load(), second = module.load();
    expect(first).toBe(second);
    expect(await first).toBe(component);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps a successful component for reopening without another import", async () => {
    const component = () => null;
    const load = vi.fn(async () => component);
    const module = deferredOfferModule(load);
    await module.load();
    expect(module.current()).toBe(component);
    expect(await module.load()).toBe(component);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("allows a failed chunk request to be retried", async () => {
    const component = () => null;
    const load = vi.fn<() => Promise<typeof component>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(component);
    const module = deferredOfferModule(load);
    await expect(module.load()).rejects.toThrow("offline");
    expect(module.current()).toBeUndefined();
    expect(await module.load()).toBe(component);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("turns a synchronous loader failure into a retryable rejection", async () => {
    const load = vi.fn((): Promise<string> => { throw new Error("load failed"); });
    const module = deferredOfferModule(load);
    await expect(module.load()).rejects.toThrow("load failed");
    load.mockImplementation(async () => "loaded");
    expect(await module.load()).toBe("loaded");
  });
});

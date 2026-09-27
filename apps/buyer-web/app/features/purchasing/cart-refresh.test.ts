import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleCartRefresh } from "./cart-refresh";
afterEach(() => vi.useRealTimers());
describe("cart refresh schedule", () => {
  it("refreshes at60s and focus, skips hidden/busy state and cleans listeners", async () => {
    vi.useFakeTimers();
    let visible = true, blocked = false, wake = () => {};
    const refresh = vi.fn(async () => {}), detach = vi.fn();
    const stop = scheduleCartRefresh({ visible: () => visible, blocked: () => blocked, refresh,
      interval: (callback, ms) => { const id = setInterval(callback, ms); return () => clearInterval(id); },
      onWake: callback => { wake = callback; return detach; },
    });
    await vi.advanceTimersByTimeAsync(60000); expect(refresh).toHaveBeenCalledTimes(1);
    visible = false; await vi.advanceTimersByTimeAsync(60000); expect(refresh).toHaveBeenCalledTimes(1);
    visible = true; blocked = true; wake(); expect(refresh).toHaveBeenCalledTimes(1);
    blocked = false; wake(); wake(); await Promise.resolve(); expect(refresh).toHaveBeenCalledTimes(2);
    stop(); await vi.advanceTimersByTimeAsync(60000); wake(); expect(refresh).toHaveBeenCalledTimes(2); expect(detach).toHaveBeenCalledOnce();
  });
  it("never overlaps slow requests", async () => {
    vi.useFakeTimers(); let finish = () => {};
    const refresh = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const stop = scheduleCartRefresh({ visible: () => true, blocked: () => false, refresh,
      interval: (callback, ms) => { const id = setInterval(callback, ms); return () => clearInterval(id); }, onWake: () => () => {},
    });
    await vi.advanceTimersByTimeAsync(180000); expect(refresh).toHaveBeenCalledTimes(1);
    finish(); await vi.advanceTimersByTimeAsync(60000); expect(refresh).toHaveBeenCalledTimes(2); stop(); finish();
  });
});

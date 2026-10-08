import { describe, expect, it, vi } from "vitest";
import { createConnectionMonitor } from "./connection-monitor";

describe("connection recovery", () => {
  it("does not poll healthy sessions or repeat offline notices; confirms recovery", async () => {
    let online = true;
    const probe = vi.fn().mockResolvedValue(false), changed = vi.fn();
    const monitor = createConnectionMonitor({ online: () => online, probe, changed });
    await monitor.check(); expect(probe).not.toHaveBeenCalled();
    online = false; monitor.disconnect(); monitor.disconnect(); await monitor.check();
    expect(changed.mock.calls).toEqual([["offline", false]]);
    online = true; await monitor.check();
    expect(changed).toHaveBeenLastCalledWith("unavailable", false);
    probe.mockResolvedValue(true); await monitor.check();
    expect(changed).toHaveBeenLastCalledWith("online", true);
    await monitor.check(); expect(probe).toHaveBeenCalledTimes(2);
    monitor.dispose();
  });
  it("deduplicates probes and ignores success arriving after a second disconnect", async () => {
    let resolve!: (value: boolean) => void;
    const probe = vi.fn(() => new Promise<boolean>(done => { resolve = done; })), changed = vi.fn();
    const monitor = createConnectionMonitor({ online: () => true, probe, changed });
    monitor.disconnect(); const pending = monitor.check(); await monitor.check();
    expect(probe).toHaveBeenCalledTimes(1);
    monitor.disconnect(); resolve(true); await pending;
    expect(changed).toHaveBeenLastCalledWith("offline", false);
    expect(changed).not.toHaveBeenCalledWith("online", true);
    monitor.dispose();
  });
  it("aborts the request on disposal without a late announcement", async () => {
    let signal!: AbortSignal, resolve!: (value: boolean) => void;
    const changed = vi.fn();
    const monitor = createConnectionMonitor({ online: () => true, changed, probe: value => { signal = value; return new Promise(done => { resolve = done; }); } });
    monitor.disconnect(); const pending = monitor.check(); monitor.dispose();
    expect(signal.aborted).toBe(true); resolve(true); await pending;
    expect(changed).not.toHaveBeenCalledWith("online", true);
  });
});

import { describe, expect, it, vi } from "vitest";
import { WorkflowCommandTracker } from "./order-workflow-command";

const action = { action: "ACCEPT_COMPOSITION" as const };
describe("workflow command outcome tracking", () => {
  it("uses the displayed new version and a new key after a definitive conflict", () => {
    const tracker = new WorkflowCommandTracker(vi.fn().mockReturnValueOnce("old").mockReturnValueOnce("new"));
    expect(tracker.command(action, 1)).toMatchObject({ expectedVersion: 1, idempotencyKey: "old" });
    expect(tracker.rejected({ status: 409 })).toBe(true);
    expect(tracker.command(action, 2)).toMatchObject({ expectedVersion: 2, idempotencyKey: "new" });
  });
  it.each([new Error("network timeout"), { status: 500 }, { status: 408 }])("preserves the exact command when the write outcome is unknown: %j", error => {
    const key = vi.fn(() => "same-key");
    const tracker = new WorkflowCommandTracker(key);
    const sent = tracker.command(action, 1);
    tracker.rejected(error);
    // A successful background GET may already see the committed newer version.
    expect(tracker.command(action, 2)).toBe(sent);
    expect(key).toHaveBeenCalledTimes(1);
    expect(() => tracker.command({ action: "REQUEST_PAYMENT_DETAILS", comment: "Уточнение" }, 2)).toThrow(/предыдущего действия неизвестен/);
  });
  it("replays one committed event after a lost response and permits the next action after confirmation", async () => {
    vi.useFakeTimers();
    try {
      const tracker = new WorkflowCommandTracker(vi.fn().mockReturnValueOnce("one").mockReturnValueOnce("two"));
      const events = new Map<string, string>();
      const sent = tracker.command(action, 1);
      events.set(sent.idempotencyKey, "event-one");
      const timeout = new Promise<void>(resolve => setTimeout(() => { tracker.rejected(new Error("timeout after commit")); resolve(); }, 5000));
      await vi.advanceTimersByTimeAsync(5000); await timeout;
      const retry = tracker.command(action, 2);
      expect(events.get(retry.idempotencyKey)).toBe("event-one");
      expect(events.size).toBe(1);
      tracker.succeeded();
      expect(tracker.command(action, 2).idempotencyKey).toBe("two");
    } finally { vi.useRealTimers(); }
  });
});

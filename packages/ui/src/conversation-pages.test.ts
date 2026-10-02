import { describe, expect, it, vi } from "vitest";
import type { ConversationPage } from "@marketplace/schemas";
import { conversationPages } from "./conversation-pages";

const item = (id: string) => ({ id }) as ConversationPage["items"][number];
describe("conversation list without paging buttons", () => {
  it("keeps earlier conversations when loading the next page and removes overlapping IDs", async () => {
    const load = vi.fn()
      .mockResolvedValueOnce({ items: [item("first"), item("overlap")], hasMore: true, unreadCount: 3 })
      .mockResolvedValueOnce({ items: [item("overlap"), item("last")], hasMore: false, unreadCount: 2 });
    const result = await conversationPages(load, "UNREAD", 30);
    expect(load.mock.calls).toEqual([[{ filter: "UNREAD", offset: 0, limit: 30 }], [{ filter: "UNREAD", offset: 30, limit: 30 }]]);
    expect(result.items.map(value => value.id)).toEqual(["first", "overlap", "last"]);
    expect(result.hasMore).toBe(false);
  });
  it("stops after the last page when the filtered list has become shorter", async () => {
    const load = vi.fn().mockResolvedValue({ items: [], hasMore: false, unreadCount: 0 });
    expect((await conversationPages(load, "ORDERS", 60)).items).toEqual([]);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("surfaces a later-page failure for retry rather than returning a partial success", async () => {
    const load = vi.fn().mockResolvedValueOnce({ items: [item("first")], hasMore: true, unreadCount: 0 }).mockRejectedValueOnce(new Error("offline"));
    await expect(conversationPages(load, "ALL", 30)).rejects.toThrow("offline");
  });
});

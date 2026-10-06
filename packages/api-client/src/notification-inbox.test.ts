import { afterEach, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";
afterEach(() => vi.unstubAllGlobals());
it("encodes inbox filters and sends a snapshot-bound read command", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ items: [], nextCursor: null, unreadCount: 0, asOf: "2026-01-01T00:00:00.000Z" }));
  vi.stubGlobal("fetch", fetcher);
  const api = new MarketplaceApiClient("http://localhost/api", {});
  await api.notificationInbox("org", { unreadOnly: "false", category: "orders", cursor: "opaque+/=", limit: 7 });
  const url = new URL(String(fetcher.mock.calls[0][0]));
  expect(url.pathname).toBe("/api/notifications/organizations/org/inbox");
  expect(Object.fromEntries(url.searchParams)).toEqual({ unreadOnly: "false", category: "orders", cursor: "opaque+/=", limit: "7" });
  await api.readNotificationInbox("org", "2026-01-01T00:00:00.000Z");
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({ before: "2026-01-01T00:00:00.000Z" });
  expect(fetcher.mock.calls[1][1]?.method).toBe("POST");
});

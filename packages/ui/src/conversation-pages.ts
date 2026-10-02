import type { ConversationPage, ConversationQuery } from "@marketplace/schemas";

export const conversationPageSize = 30;

/** Refresh the visible window so sorting/unread changes do not leave stale pages. */
export async function conversationPages(
  load: (query: Partial<ConversationQuery>) => Promise<ConversationPage>,
  filter: ConversationQuery["filter"],
  lastOffset: number,
): Promise<ConversationPage> {
  const items = new Map<string, ConversationPage["items"][number]>();
  let result: ConversationPage = { items: [], hasMore: false, unreadCount: 0 };
  for (let offset = 0; offset <= lastOffset; offset += conversationPageSize) {
    result = await load({ filter, offset, limit: conversationPageSize });
    for (const item of result.items) if (!items.has(item.id)) items.set(item.id, item);
    if (!result.hasMore) break;
  }
  return { ...result, items: [...items.values()] };
}

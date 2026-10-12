import { expect, it } from "vitest";
import type { ConversationDetail } from "@marketplace/schemas";
import { conversationPayload, emptyConversationDraft, mergeConversationHistory, completeConversationUpdate } from "./conversation-draft";

const detail = (id: string, sequences: number[], hasOlder: boolean) => ({ conversation: { id }, messages: sequences.map(sequence => ({ sequence })), hasOlder }) as ConversationDetail;
it("retains loaded older history while replacing current messages and read receipts", () => {
  const previous = detail("first", [1, 2, 3], false), next = detail("first", [2, 3, 4], true);
  const merged = mergeConversationHistory(previous, next);
  expect(merged.messages.map(message => message.sequence)).toEqual([1, 2, 3, 4]); expect(merged.hasOlder).toBe(false);
  expect(merged.messages[1]).toBe(next.messages[0]);
  expect(mergeConversationHistory(previous, detail("second", [1], false)).messages).toHaveLength(1);
});
it("fills every intervening page after a long absence and keeps already loaded messages", async () => {
  const calls: number[] = [];
  const range = (first: number, last: number) => Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const result = await completeConversationUpdate(detail("chat", range(1, 50), false), detail("chat", range(151, 200), true), async before => {
    calls.push(before); return detail("chat", range(before - 50, before - 1), true);
  }, () => true);
  expect(calls).toEqual([151, 101]); expect(result.messages.map(message => message.sequence)).toEqual(range(1, 200)); expect(result.hasOlder).toBe(false);
});
it("stops stale selection work and fails closed when history paging makes no progress", async () => {
  const previous = detail("chat", [1], false), next = detail("chat", [10], true);
  let calls = 0;
  await completeConversationUpdate(previous, next, async () => { calls++; return next; }, () => false);
  expect(calls).toBe(0);
  await expect(completeConversationUpdate(previous, next, async () => next, () => true)).rejects.toThrow("всю историю");
});
it("submits only asset references and trimmed text without leaking file metadata", () => {
  const draft = emptyConversationDraft();
  draft.body = "  Вопрос  "; draft.files.push({ assetId: "asset", name: "Фото.png", contentType: "image/png", sizeBytes: 1, expiresAt: "later" });
  expect(conversationPayload(draft)).toEqual({ body: "Вопрос", attachments: [{ assetId: "asset" }] });
  expect(emptyConversationDraft().files).toEqual([]);
});

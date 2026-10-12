import { afterEach, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";
afterEach(() => vi.unstubAllGlobals());

it("keeps offer context and exact message retry payload, and downloads files with authorization", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ conversationId: "conversation" }));
  vi.stubGlobal("fetch", fetcher);
  const api = new MarketplaceApiClient("http://localhost/api", { accessToken: "synthetic-token" });
  await api.conversationContext("OFFER", "offer");
  expect(Object.fromEntries(new URL(String(fetcher.mock.calls[0][0])).searchParams)).toEqual({ contextType: "OFFER", contextId: "offer" });
  const upload = { contextType: "OFFER" as const, contextId: "offer", fileName: "Фото.png", contentBase64: "aW1hZ2U=" };
  await api.uploadConversationAttachment(upload);
  expect(String(fetcher.mock.calls[1][0])).toBe("http://localhost/api/conversations/attachments");
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual(upload);
  const input = { body: "", idempotencyKey: "same-key", attachments: [{ assetId: "file" }] };
  await api.sendConversationMessage("conversation", input); await api.sendConversationMessage("conversation", input);
  expect(fetcher.mock.calls[2][1]?.body).toBe(fetcher.mock.calls[3][1]?.body);
  fetcher.mockImplementationOnce(async () => new Response("%PDF-1.7", { headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename*=UTF-8''document.pdf" } }));
  const result = await api.downloadConversationAttachment("conversation", "message", "file");
  expect(String(fetcher.mock.calls[4][0])).toBe("http://localhost/api/conversations/conversation/messages/message/attachments/file");
  expect(new Headers(fetcher.mock.calls[4][1]?.headers).get("authorization")).toBe("Bearer synthetic-token");
  expect(result.fileName).toBe("document.pdf"); expect(await result.blob.text()).toBe("%PDF-1.7");
});

import { afterEach, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";
afterEach(() => vi.unstubAllGlobals());
it("uploads and downloads support attachments with authenticated requests", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(async () => Response.json({ assetId: "file" }))
    .mockImplementationOnce(async () => new Response("%PDF-1.7", { headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename*=UTF-8''document.pdf" } }));
  vi.stubGlobal("fetch", fetcher);
  const api = new MarketplaceApiClient("http://localhost/api", { accessToken: "synthetic-token" });
  await api.uploadSupportAttachment({ fileName: "document.pdf", contentBase64: "JVBERi0xLjc=" });
  expect(String(fetcher.mock.calls[0][0])).toBe("http://localhost/api/support/attachments");
  const result = await api.downloadSupportAttachment("ticket", "message", "file");
  expect(String(fetcher.mock.calls[1][0])).toBe("http://localhost/api/support/tickets/ticket/messages/message/attachments/file");
  expect(result.fileName).toBe("document.pdf"); expect(await result.blob.text()).toBe("%PDF-1.7");
  expect(new Headers(fetcher.mock.calls[1][1]?.headers).get("authorization")).toBe("Bearer synthetic-token");
});
it("encodes support search and preserves explicit reopening and retry keys", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json([])); vi.stubGlobal("fetch", fetcher);
  const api = new MarketplaceApiClient("http://localhost/api", {});
  await api.supportTickets("OPEN", 50, { q: "Заказ & SUP-1", sort: "recent" });
  expect(Object.fromEntries(new URL(String(fetcher.mock.calls[0][0])).searchParams)).toEqual({ status: "OPEN", offset: "50", q: "Заказ & SUP-1", sort: "recent" });
  const input = { idempotencyKey: "same-key", body: "Вопрос не решён", reopen: true, isInternal: false, attachments: [] };
  await api.addSupportMessage("ticket", input);
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual(input);
});

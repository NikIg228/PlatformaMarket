import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ConversationCounter } from "./conversation-workspace";

// Node's CJS entry avoids Tabster's ESM interop; browser tests cover Fluent runtime.
vi.mock("@fluentui/react-components", async () => {
  const { createRequire } = await import("node:module");
  return createRequire(import.meta.url)("@fluentui/react-components");
});

const api = { conversations: async () => { throw new Error("SSR must not request a counter"); } };
describe("conversation counter copy", () => {
  it("keeps the Russian default for existing consumers", () => {
    const html = renderToStaticMarkup(<ConversationCounter api={api} href="/clinic/messages" showLabel />);
    expect(html).toContain('aria-label="Сообщения"');
    expect(html).toContain('href="/clinic/messages"');
    expect(html).toContain(">Сообщения</a>");
  });
  it("uses supplied accessible and visible copy without changing link semantics", () => {
    const html = renderToStaticMarkup(<ConversationCounter api={api} href="/supplier/messages?lang=kk" showLabel current
      copy={{ label: "Хабарламалар", unavailable: "Есептегіш қолжетімсіз", unread: "Оқылмаған диалогтар" }} />);
    expect(html).toContain('aria-label="Хабарламалар"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain(">Хабарламалар</a>");
    expect(html).not.toContain("Сообщения");
  });
});

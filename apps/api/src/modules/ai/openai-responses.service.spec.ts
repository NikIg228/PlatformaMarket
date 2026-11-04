import { afterEach, describe, expect, it, vi } from "vitest";
import { AiSafetyService } from "./ai-safety.service";
import { OpenAiResponsesService } from "./openai-responses.service";

vi.mock("../../platform/config/environment", () => ({ environment: () => ({ OPENAI_API_KEY: "synthetic-provider-key", OPENAI_BASE_URL: "https://provider.invalid/v1", OPENAI_MODEL: "test" }) }));

afterEach(() => vi.unstubAllGlobals());

describe("AI provider boundary", () => {
  it("redacts raw callers and nested tool values before serialization to fetch", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: "Найдено 2 заказа" }) });
    vi.stubGlobal("fetch", fetch);
    const service = new OpenAiResponsesService(new AiSafetyService());
    await service.summarize({ role: "BUYER", question: 'Заказы token=SYNTHETIC_QUESTION_SECRET', toolName: "list_buyer_orders", toolOutput: { count: 2, amount: 100n, entries: [{ "api-key": "SYNTHETIC_NESTED_SECRET", message: 'Ошибка: "password": "SYNTHETIC_JSON_SECRET"' }] } });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(JSON.stringify(body)).not.toContain("SYNTHETIC_");
    const input = JSON.parse(body.input[0].content[0].text);
    expect(input.question).toBe("Заказы [REDACTED]");
    expect(input.authorizedResult.count).toBe(2);
    expect(input.authorizedResult.amount).toBe("100");
    expect(body.store).toBe(false);
  });

  it("preserves an ordinary question and authorized result", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: "Маски найдены" }) });
    vi.stubGlobal("fetch", fetch);
    const result = await new OpenAiResponsesService(new AiSafetyService()).summarize({ role: "BUYER", question: "Найди маски", toolName: "search_catalog", toolOutput: { products: [{ name: "Маски", count: 10 }] } });
    expect(result?.text).toBe("Маски найдены");
    expect(fetch.mock.calls[0][1].body).toContain("Маски");
  });
});

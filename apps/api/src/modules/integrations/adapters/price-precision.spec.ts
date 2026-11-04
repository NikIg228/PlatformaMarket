import { expect, it, vi } from "vitest";
import { CustomApiIntegrationAdapter } from "./custom-api.adapter";
import { MoySkladIntegrationAdapter } from "./moysklad.adapter";
import { MockIntegrationAdapter } from "./mock.adapter";
import { PermanentIntegrationError } from "./integration-adapter";

function adapters(value: unknown) {
  const context = { connectionId: "connection", credentials: { accessToken: "synthetic" }, configuration: { baseUrl: "https://synthetic.invalid", mockPrices: [{ externalId: "item", valueMinor: value }] } };
  const custom = new CustomApiIntegrationAdapter({ request: vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [{ externalId: "item", valueMinor: value }] }))) } as never);
  const moysklad = new MoySkladIntegrationAdapter({ request: vi.fn().mockResolvedValue(new Response(JSON.stringify({ rows: [{ id: "item", salePrices: [{ value }] }] }))) } as never);
  return [() => custom.pullPrices(context), () => moysklad.pullPrices(context), () => new MockIntegrationAdapter().pullPrices(context)];
}

it.each(["9007199254740993", 9007199254740992, "9007199254740990.1", "12.5", -1, "NaN", "", true, null])("rejects non-exact minor units %j at every adapter boundary", async value => {
  for (const run of adapters(value)) await expect(run()).rejects.toBeInstanceOf(PermanentIntegrationError);
});

it.each([0, "0", "125000.00", Number.MAX_SAFE_INTEGER, String(Number.MAX_SAFE_INTEGER)])("preserves exact admitted minor units %j", async value => {
  for (const run of adapters(value)) expect((await run()).items[0]?.valueMinor).toBe(Number(value));
});

import { afterEach, expect, it, vi } from "vitest";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });
it("uses the owned-order review contract and preserves the retry key and optional scores", async () => {
  vi.stubEnv("NEXT_PUBLIC_DEPLOYMENT_PROFILE", "go_live");
  const { MarketplaceApiClient } = await import("./index");
  const fetcher = vi.fn().mockImplementation(async () => Response.json({ orderId: "order", eligible: true, review: null }));
  vi.stubGlobal("fetch", fetcher);
  const api = new MarketplaceApiClient("http://localhost/api", {});
  await api.getOrderReviewState("order/one");
  const request = { overallRating: 5, dimensions: {}, comment: "Получено", idempotencyKey: "review-test" };
  await api.createOrderReview("order/one", request);
  expect(String(fetcher.mock.calls[0][0])).toBe("http://localhost/api/trust/orders/order%2Fone/review-state");
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual(request);
});

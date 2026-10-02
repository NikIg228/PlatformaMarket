import { afterEach, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";
afterEach(() => vi.unstubAllGlobals());

it("loads the authenticated server policy without a caller-selected tenant", async () => {
  const policy = { mode: "FULL_ACCESS", permissions: ["organization.members.manage"] };
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(policy));
  vi.stubGlobal("fetch", fetcher);
  const api = new MarketplaceApiClient("http://localhost/api", {});
  const controller = new AbortController();
  await expect(api.getAccessPolicy(controller.signal)).resolves.toEqual(policy);
  expect(String(fetcher.mock.calls[0][0])).toBe("http://localhost/api/access-control/policy");
  const signal = fetcher.mock.calls[0][1]?.signal;
  controller.abort();
  expect(signal?.aborted).toBe(true);
});

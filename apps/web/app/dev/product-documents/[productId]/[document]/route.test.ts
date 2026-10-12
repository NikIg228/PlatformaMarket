import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const productId = "fe626b9d-9e24-45cd-a0fe-31c720a10e93";
const request = new Request("http://localhost/dev/product-documents");
afterEach(() => vi.unstubAllEnvs());

it("does not expose local files in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  expect((await GET(request, { params: Promise.resolve({ productId, document: "specification" }) })).status).toBe(404);
});
it("only downloads an allowlisted product/document pair", async () => {
  vi.stubEnv("NODE_ENV", "development");
  for (const params of [{ productId, document: "../specification" }, { productId: "../data", document: "specification" }, { productId, document: "missing" }])
    expect((await GET(request, { params: Promise.resolve(params) })).status).toBe(404);
  const response = await GET(request, { params: Promise.resolve({ productId, document: "specification" }) });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/pdf");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
});

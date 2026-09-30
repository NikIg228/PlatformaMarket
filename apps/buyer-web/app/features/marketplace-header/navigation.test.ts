import { expect, it } from "vitest";
import { catalogContext, deliveryDestination, searchDestination } from "./navigation";
const city = "50c0440e-7ed2-4b28-870c-02d587c6f17b";
it("keeps filters through search and product return, resetting only pagination", () => {
  const back = `/catalog?q=old&sort=PRICE_ASC&inStock=true&count=48&deliveryCityId=${city}&inCity=true`;
  const context = catalogContext("/products/example", `?${new URLSearchParams({ returnTo: back })}`);
  const url = new URL(searchDestination(context, "GC"), "http://local.invalid");
  expect(url.searchParams.get("q")).toBe("GC"); expect(url.searchParams.get("sort")).toBe("PRICE_ASC");
  expect(url.searchParams.get("deliveryCityId")).toBe(city); expect(url.searchParams.get("inCity")).toBe("true"); expect(url.searchParams.has("count")).toBe(false);
});
it("distinguishes delivery context from explicit availability and rejects external return", () => {
  const url = new URL(deliveryDestination("/catalog", "?q=GC", city, false), "http://local.invalid");
  expect(url.searchParams.has("inCity")).toBe(false); expect(url.searchParams.has("cityId")).toBe(false);
  expect(url.searchParams.get("deliveryCityId")).toBe(city);
  expect(catalogContext("/products/example", "?returnTo=https://outside.invalid")).toBe("/");
});

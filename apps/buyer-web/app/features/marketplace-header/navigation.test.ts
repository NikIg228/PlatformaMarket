import { expect, it } from "vitest";
import { catalogContext, deliveryDestination, searchDestination } from "./navigation";
it("searches and changes delivery inside the supplier storefront, including a return from a product", () => {
  const path = "/catalog/suppliers/00000000-0000-4000-8000-000000000001";
  const context = catalogContext("/products/example", `?${new URLSearchParams({ returnTo: `${path}?sort=PRICE_ASC&lang=kk&count=48` })}`);
  expect(searchDestination(context, "A2")).toBe(`${path}?sort=PRICE_ASC&lang=kk&q=A2`);
  expect(deliveryDestination(path, "?lang=kk", "50c0440e-7ed2-4b28-870c-02d587c6f17b", true)).toContain(path);
});
const city = "50c0440e-7ed2-4b28-870c-02d587c6f17b";
it("preserves the selected variant and package when the product delivery city changes", () => {
  const search = new URLSearchParams({ returnTo: "/catalog?q=Filtek", variant: "A2", packaging: '["Шприц","4","г","KZT"]' });
  const target = new URL(deliveryDestination("/products/example", `?${search}`, city, false), "http://local.invalid");
  expect(target.searchParams.get("variant")).toBe("A2");
  expect(target.searchParams.get("packaging")).toBe(search.get("packaging"));
  expect(target.searchParams.get("returnTo")).toContain(city);
});
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

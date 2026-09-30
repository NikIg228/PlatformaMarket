import { expect, it } from "vitest";
import { publicCatalogQuery } from "./public-catalog-query";
import { readMarketplaceCatalog } from "./marketplace-url";

it("preserves URL filters and exact sale-unit prices without trusting an unvalidated city", () => {
  const state = readMarketplaceCatalog(new URLSearchParams("q=композит&sort=PRICE_ASC&brandId=brand&manufacturerId=maker&supplierOrganizationId=supplier&inStock=false&unit=ml&packaging=box&deliveryMethod=COURIER&minPrice=9007199254740993.01&maxPrice=9007199254740994.99&attributeFilters=%7B%22color%22%3A%22A1%22%7D&deliveryCityId=11111111-1111-4111-8111-111111111111&inCity=true"));
  const query = publicCatalogQuery(state);
  expect(query.get("minSalePriceMinor")).toBe("900719925474099301");
  expect(query.get("maxSalePriceMinor")).toBe("900719925474099499");
  expect(query.get("inStock")).toBe("false");
  expect(query.get("supplierOrganizationId")).toBe("supplier");
  expect(query.get("attributeFilters")).toBe('{"color":"A1"}');
  expect(query.get("priceBasis")).toBe("SALE_UNIT");
  expect(query.has("buyerOrganizationId")).toBe(false);
  expect(query.has("cityId")).toBe(false);
  expect(publicCatalogQuery(state, "validated-city").get("cityId")).toBe("validated-city");
});

it("keeps missing filters absent and bounds the transport page independently of restored count", () => {
  const query = publicCatalogQuery(readMarketplaceCatalog(new URLSearchParams("count=504&minPrice=Infinity")));
  expect(query.get("limit")).toBe("24");
  expect(query.has("minSalePriceMinor")).toBe(false);
  expect(query.has("inStock")).toBe(false);
  expect(query.has("count")).toBe(false);
});

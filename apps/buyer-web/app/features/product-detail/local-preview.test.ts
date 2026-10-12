import { expect, it } from "vitest";
import products from "../../data/product-page-preview.json";
import { localProductPreview, previewDocumentLinks } from "./local-preview";

it("keeps local descriptions/documents out of production and unrelated identities", () => {
  const item = products[0]!;
  const identity = { id: item.id, name: item.sourceName };
  expect(localProductPreview(identity, "production")).toBeNull();
  expect(localProductPreview(identity, "test")).toBeNull();
  expect(localProductPreview({ ...identity, name: "Another product" }, "development")).toBeNull();
  expect(localProductPreview({ ...identity, id: products[1]!.id }, "development")).toBeNull();
  expect(previewDocumentLinks(localProductPreview(identity, "development")!)).toHaveLength(2);
});

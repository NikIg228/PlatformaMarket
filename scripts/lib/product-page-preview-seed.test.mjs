import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPreviewTarget, previewProducts, previewUuid } from "./product-page-preview-seed.mjs";

test("preview requires the exact local dev database and never production/CI", () => {
  const local = "postgresql://user:password@127.0.0.1:5432/marketplace?schema=public";
  assert.doesNotThrow(() => assertPreviewTarget(local, {}));
  for (const url of [local.replace("127.0.0.1", "db.example.com"), local.replace("/marketplace", "/postgres"), local.replace("public", "other"), local.replace("5432", "5433")])
    assert.throws(() => assertPreviewTarget(url, {}));
  assert.throws(() => assertPreviewTarget(local, { NODE_ENV: "production" }));
  assert.throws(() => assertPreviewTarget(local, { CI: "true" }));
});
test("preview covers only screenshot identities with stable keys and positive exact money", () => {
  assert.equal(previewProducts.length, 5);
  assert.equal(new Set(previewProducts.map(p => p.id)).size, 5);
  assert.equal(previewProducts[3].title, "GC FujiCEM Evolve");
  for (const product of previewProducts) {
    assert.ok(product.variants.length >= 2);
    assert.equal(product.packages.length, 2);
    assert.equal(product.documents.length, 2);
    for (const v of product.variants) {
      assert.match(v.priceMinor, /^[1-9][0-9]*$/);
      assert.ok(Object.keys(v.attributes).length >= 5);
    }
  }
  assert.equal(previewUuid("same"), previewUuid("same"));
  assert.notEqual(previewUuid("same"), previewUuid("different"));
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const readJson = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), "utf8"));
const corpus = readJson("fixtures.json");
const anchors = readJson("source-anchors.json");
const { scenarios } = readJson("scenarios.json");
const byId = new Map(corpus.cases.map((fixture) => [fixture.id, fixture]));
const readAt = (value, path) => path.reduce((current, key) => current?.[key], value);
const scopeKeys = ["product", "environment", "userId", "organizationId", "generation"];
const sameScope = (left, right) => scopeKeys.every((key) => left[key] === right[key]);

test("corpus is synthetic, uniquely identified, and tied to the selected snapshot", () => {
  assert.equal(corpus.realCustomerData, false);
  assert.equal(corpus.sourceSnapshot, anchors.sourceSnapshot);
  assert.match(corpus.sourceSnapshot, /^[a-f0-9]{40}$/);
  assert.equal(byId.size, corpus.cases.length);
  assert.ok(corpus.cases.some((fixture) => fixture.expected === "accept"));
  assert.ok(corpus.cases.some((fixture) => fixture.expected === "reject"));
  for (const fixture of corpus.cases) {
    assert.ok(anchors.schemas[fixture.schema], fixture.id);
    assert.ok(["accept", "reject"].includes(fixture.expected), fixture.id);
    assert.ok(Object.hasOwn(fixture, "payload"), fixture.id);
    if (fixture.expected === "reject") assert.ok(fixture.issuePaths?.length, fixture.id);
  }
});

test("source anchors still identify the actual unchanged schema files and exports", () => {
  for (const [symbol, source] of Object.entries(anchors.schemas)) {
    assert.ok(source.path.startsWith("packages/schemas/src/"));
    assert.ok(!source.path.includes(".."));
    const url = new URL(`../../${source.path}`, import.meta.url);
    const bytes = readFileSync(url);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), source.sha256, source.path);
    const header = `blob ${bytes.length}\0`;
    assert.equal(createHash("sha1").update(header).update(bytes).digest("hex"), source.gitBlob);
    assert.ok(bytes.toString("utf8").split("\n")[source.line - 1].includes(`export const ${symbol}`));
    assert.ok(source.url.includes(`/blob/${anchors.sourceSnapshot}/${source.path}#L${source.line}`));
    assert.ok(fileURLToPath(url).endsWith(source.path));
  }
});

test("query consumer anchors identify the existing request schemas/types and client methods", () => {
  assert.equal(anchors.consumerSources.length, 9);
  for (const source of anchors.consumerSources) {
    assert.ok(["packages/schemas/src/index.ts", "packages/schemas/src/workspace-reads.ts", "packages/api-client/src/index.ts"].includes(source.path));
    const bytes = readFileSync(new URL(`../../${source.path}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), source.sha256, source.path);
    assert.equal(createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex"), source.gitBlob);
    assert.ok(bytes.toString("utf8").split("\n")[source.line - 1].includes(source.symbol));
    assert.ok(source.url.includes(`/blob/${anchors.sourceSnapshot}/${source.path}#L${source.line}`));
  }
});

test("fixture payloads preserve exact wire values, explicit null, and omitted fields", () => {
  for (const fixture of corpus.cases) {
    const wire = JSON.parse(JSON.stringify(fixture.payload));
    for (const { path, value } of fixture.preserve ?? []) {
      assert.deepEqual(readAt(wire, path), value, `${fixture.id}: ${path.join(".")}`);
    }
    for (const path of fixture.absent ?? []) {
      const parent = readAt(wire, path.slice(0, -1));
      assert.ok(parent !== null && typeof parent === "object", fixture.id);
      assert.equal(Object.hasOwn(parent, path.at(-1)), false, `${fixture.id}: ${path.join(".")}`);
    }
  }
  assert.equal(typeof byId.get("offer-exact-money").payload.priceMinor, "string");
  assert.equal(byId.get("offer-exact-money").payload.priceMinor, "9007199254740993");
  assert.equal(byId.get("offer-explicit-zero-wire").payload.priceMinor, "0");
  assert.equal(byId.get("catalog-null-price").payload.items[0].offers[0].priceMinor, null);
});

test("representative catalog, variant, offer, and order identities form one synthetic read journey", () => {
  const product = byId.get("product-null-description").payload;
  const comparison = byId.get("comparison-exact-offer").payload;
  const order = byId.get("order-current").payload;
  const workflow = byId.get("order-workflow-minimal").payload;
  assert.equal(product.id, comparison.product.id);
  assert.equal(product.variants[0].id, comparison.selectedVariantId);
  assert.equal(comparison.offers[0].variantId, comparison.selectedVariantId);
  assert.equal(order.items[0].offerId, comparison.offers[0].offerId);
  assert.equal(order.items[0].productVariantId, comparison.selectedVariantId);
  assert.equal(order.supplierOrganizationId, comparison.offers[0].supplier.organizationId);
  assert.equal(workflow.orderId, order.id);
  assert.deepEqual(workflow.order, order);
  assert.equal(workflow.version, order.version);
});

test("context scenarios distinguish organization, user, environment, and request generation", () => {
  assert.equal(new Set(scenarios.map((scenario) => scenario.id)).size, scenarios.length);
  for (const scenario of scenarios) {
    assert.ok(byId.has(scenario.fixture), scenario.id);
    assert.equal(scenario.status, "fixture_expectation_not_implemented_client_behavior");
    for (const key of scopeKeys) {
      assert.ok(Object.hasOwn(scenario.requestScope, key), `${scenario.id}: request ${key}`);
      assert.ok(Object.hasOwn(scenario.activeScope, key), `${scenario.id}: active ${key}`);
    }
    assert.equal(sameScope(scenario.requestScope, scenario.activeScope), scenario.expectedConsumer !== "discard-response", scenario.id);
  }
  const current = byId.get("order-current").payload;
  const matching = scenarios.find((scenario) => scenario.id === "current-order-response");
  assert.equal(matching.requestScope.organizationId, current.buyerOrganizationId);
  const sameOrg = scenarios.find((scenario) => scenario.id === "late-response-same-org-new-generation");
  assert.equal(sameOrg.requestScope.organizationId, sameOrg.activeScope.organizationId);
  assert.notEqual(sameOrg.requestScope.generation, sameOrg.activeScope.generation);
});

test("version scenarios compare the same entity only and preserve newer accepted reads", () => {
  const older = scenarios.find((scenario) => scenario.id === "older-order-version");
  const payload = byId.get(older.fixture).payload;
  assert.equal(older.acceptedRead.orderId, payload.id);
  assert.ok(payload.version < older.acceptedRead.version);
  const different = scenarios.find((scenario) => scenario.id === "different-order-version-not-comparable");
  assert.notEqual(different.acceptedRead.orderId, byId.get(different.fixture).payload.id);
});

test("error and enum scenarios retain the distinction between wire validity and consumer recovery", () => {
  assert.equal(byId.get("order-detail-future-status").expected, "accept");
  assert.equal(byId.get("workspace-unknown-enum").expected, "reject");
  assert.equal(byId.get("error-opaque-message").expected, "accept");
  for (const [id, code] of [["error-denied", "FORBIDDEN"], ["error-not-found", "NOT_FOUND"], ["error-throttled", "RATE_LIMIT_EXCEEDED"]]) {
    assert.equal(byId.get(id).payload.code, code);
  }
});

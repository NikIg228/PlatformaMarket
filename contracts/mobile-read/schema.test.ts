import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  catalogVariantSchema,
  catalogSearchOfferSchema,
  catalogSearchProductSchema,
  catalogSearchResponseSchema,
  offerComparisonResponseSchema,
  supplierOrderResponseSchema,
  errorResponseSchema,
} from "../../packages/schemas/src/core-api";
import { workspaceOrderPageSchema } from "../../packages/schemas/src/workspace-reads";
import { orderWorkflowResponseSchema } from "../../packages/schemas/src/order-workflow";

// Import the authoritative schemas. Do not restate a mobile DTO or loosen its decoder here.
const schemas = {
  catalogVariantSchema,
  catalogSearchOfferSchema,
  catalogSearchProductSchema,
  catalogSearchResponseSchema,
  offerComparisonResponseSchema,
  supplierOrderResponseSchema,
  errorResponseSchema,
  workspaceOrderPageSchema,
  orderWorkflowResponseSchema,
};

type Path = Array<string | number>;
type Fixture = {
  id: string;
  schema: keyof typeof schemas;
  expected: "accept" | "reject";
  payload: unknown;
  preserve?: Array<{ path: Path; value: unknown }>;
  absent?: Path[];
  issuePaths?: Path[];
};
const corpus = JSON.parse(readFileSync(new URL("fixtures.json", import.meta.url), "utf8")) as { cases: Fixture[] };

function readAt(value: unknown, path: Path): unknown {
  return path.reduce<unknown>((current, key) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string | number, unknown>)[key];
  }, value);
}

describe.each(corpus.cases)("mobile read fixture: $id", (fixture) => {
  it("conforms to the existing schema or rejects at the documented field", () => {
    const parsed = schemas[fixture.schema].safeParse(fixture.payload);
    expect(parsed.success).toBe(fixture.expected === "accept");
    if (!parsed.success) {
      for (const path of fixture.issuePaths ?? []) {
        expect(parsed.error.issues.some((issue) => path.every((part, index) => issue.path[index] === part))).toBe(true);
      }
      return;
    }
    for (const { path, value } of fixture.preserve ?? []) {
      expect(readAt(parsed.data, path)).toEqual(value);
    }
    for (const path of fixture.absent ?? []) {
      const parent = readAt(parsed.data, path.slice(0, -1));
      expect(parent).not.toBeNull();
      expect(typeof parent).toBe("object");
      expect(Object.hasOwn(parent as object, path[path.length - 1]!)).toBe(false);
    }
  });
});

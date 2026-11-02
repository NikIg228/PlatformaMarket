import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { offerComparisonResponseSchema } from "../../../../packages/schemas/src/core-api";
import type { ReadScope } from "../read-controller";
const corpus = JSON.parse(readFileSync(resolve(__dirname, "../../../../contracts/mobile-read/fixtures.json"), "utf8")) as { cases: { id: string; payload: unknown }[] };
export const listDraftId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const listDraftScope: ReadScope = { product: "market", environment: "synthetic-offline", userId: listDraftId(20), organizationId: listDraftId(4), generation: 1 };
export function listDraftComparison(two = false) {
  const value = offerComparisonResponseSchema.parse(JSON.parse(JSON.stringify(corpus.cases.find(row => row.id === "comparison-exact-offer")!.payload)));
  if (two) value.offers.push({ ...value.offers[0]!, offerId: listDraftId(903), supplier: { ...value.offers[0]!.supplier, name: "SYNTHETIC second supplier" } });
  return value;
}
export function listDraftPayload(id: string): unknown { return JSON.parse(JSON.stringify(corpus.cases.find(row => row.id === id)!.payload)); }

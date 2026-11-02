import { catalogSearchResponseSchema, catalogMediaSchema } from "../../../../packages/schemas/src/core-api";
import { listDraftPayload } from "./list-draft";
import { api, org, user } from "./market-session";
import type { ReadScope } from "../read-controller";
export const catalogMediaScope: ReadScope = { product: "market", environment: api, userId: user.id, organizationId: org, generation: 1 };
export const catalogMediaId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
// Synthetic shape only, not a valid server HMAC or a grant.
export const catalogMediaTicket = `4102444800.${"A".repeat(43)}`;
export function catalogMediaRow(n: number, overrides: object = {}) { const id = catalogMediaId(n); return catalogMediaSchema.parse({ id, sourceUrl: "https://untrusted-import.example.invalid/raw.jpg", securePath: `/catalog/media/${id}?ticket=${catalogMediaTicket}`, normalizedStorageKey: `SYNTHETIC-private-object-${n}`, altText: `SYNTHETIC source media caption ${n}`, width: 600, height: 400, metadata: null, ...overrides }); }
export function catalogMediaPage(two = false) { const page = catalogSearchResponseSchema.parse(listDraftPayload("catalog-null-price")); const first = page.items[0]!; first.name = "SYNTHETIC normalized product"; first.media = [catalogMediaRow(180001), catalogMediaRow(180002), catalogMediaRow(180003, { securePath: null, normalizedStorageKey: null })]; if (two) { const second = { ...first, id: catalogMediaId(180100), name: "SYNTHETIC second normalized product", variants: first.variants.map((variant, i) => ({ ...variant, id: catalogMediaId(180200 + i) })), media: [catalogMediaRow(180101)], offers: [] }; page.items.push(second); page.total = Math.max(page.total, page.items.length); } return catalogSearchResponseSchema.parse(page); }

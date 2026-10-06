import { expect, it } from "vitest";
import { supportTicketQuerySchema, supportMessageResponseSchema } from "./support-workflow";
import { addSupportMessageSchema } from "./commercial";

it("bounds support search and rejects invalid paging, sort and status", () => {
  expect(supportTicketQuerySchema.parse({ q: "  SUP-1  ", sort: "recent" })).toEqual({ q: "SUP-1", sort: "recent", offset: 0 });
  for (const query of [{ q: "x".repeat(201) }, { offset: -1 }, { sort: "unsafe" }, { status: "invalid" }]) expect(supportTicketQuerySchema.safeParse(query).success).toBe(false);
});
it("keeps legacy message inputs valid and makes reopening explicit", () => {
  const input = { idempotencyKey: "00000000-0000-4000-8000-000000000001", body: "Ответ" };
  expect(addSupportMessageSchema.parse(input).reopen).toBeUndefined();
  expect(addSupportMessageSchema.parse({ ...input, reopen: true }).reopen).toBe(true);
  expect(addSupportMessageSchema.safeParse({ ...input, reopen: "true" }).success).toBe(false);
  expect(addSupportMessageSchema.safeParse({ ...input, body: " " }).success).toBe(false);
  expect(supportMessageResponseSchema.shape.authorLabel.safeParse(undefined).success).toBe(true);
});

import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { orderConfirmationConflict } from "./order-confirmation-conflict";
const failure = (code: string, sql?: string) => new Prisma.PrismaClientKnownRequestError("Synthetic", { code, clientVersion: "test", meta: { code: sql } });
describe("confirmation retry classification", () => {
  it("retries serialization conflicts reported by ORM or row-lock SQL and deadlocks", () => {
    for (const error of [failure("P2034"), failure("P2010", "40001"), failure("P2010", "40P01")]) expect(orderConfirmationConflict(error)).toBe(true);
  });
  it("does not hide constraint, connectivity or business failures", () => {
    for (const error of [failure("P2002"), failure("P2010", "23514"), failure("P1001"), new Error("40001"), null]) expect(orderConfirmationConflict(error)).toBe(false);
  });
});

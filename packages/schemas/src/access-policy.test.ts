import { expect, it } from "vitest";
import { accessPolicySchema } from "./access-policy";

it("requires an explicit valid mode and permission list", () => {
  expect(accessPolicySchema.parse({ mode: "FULL_ACCESS", permissions: ["order.create"] }).mode).toBe("FULL_ACCESS");
  expect(accessPolicySchema.parse({ mode: "ROLE_BASED", permissions: [] }).permissions).toEqual([]);
  expect(accessPolicySchema.safeParse({ permissions: [] }).success).toBe(false);
  expect(accessPolicySchema.safeParse({ mode: "INVALID", permissions: [] }).success).toBe(false);
});

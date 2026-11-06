import { expect, it } from "vitest";
import { registrationEmailCorrectionSchema } from "./local-auth.js";

const input = { registrationToken: "synthetic-proof".repeat(4), password: "synthetic-password", email: "  Owner@Example.invalid " };
it("normalizes the corrected address and preserves a local return target", () => {
  expect(registrationEmailCorrectionSchema.parse({ ...input, returnTo: "/catalog" })).toMatchObject({ email: "owner@example.invalid", returnTo: "/catalog" });
});
it.each([
  { registrationToken: "short" }, { password: "short" }, { email: "invalid" },
  { returnTo: "https://external.invalid" }, { userId: "caller-controlled" },
])("rejects invalid proof/input and caller-supplied identity %j", patch => {
  expect(registrationEmailCorrectionSchema.safeParse({ ...input, ...patch }).success).toBe(false);
});

import { expect, it } from "vitest";
import { updatePersonalProfileSchema, requestProfileEmailSchema, uploadProfileAvatarSchema } from "./personal-profile";
it("accepts scalar profile updates, requires a real phone and rejects ownership/email injection", () => {
  expect(updatePersonalProfileSchema.parse({ expectedVersion: 1, displayName: " Person ", phone: "+7 700 000 00 00" }).displayName).toBe("Person");
  for (const patch of [{}, { phone: "" }, { phone: "-------" }, { displayName: " " }, { email: "wrong@example.invalid" }, { userId: "foreign" }]) expect(updatePersonalProfileSchema.safeParse({ expectedVersion: 1, ...patch }).success).toBe(false);
  expect(requestProfileEmailSchema.parse({ expectedVersion: 1, email: "NEW@example.invalid" }).email).toBe("new@example.invalid");
  expect(uploadProfileAvatarSchema.safeParse({ expectedVersion: 1, fileName: "photo.png", contentBase64: "a".repeat(2796205) }).success).toBe(false);
});

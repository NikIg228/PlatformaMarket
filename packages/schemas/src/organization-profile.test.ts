import { expect, it } from "vitest";
import { saveOrganizationProfileSchema } from "./organization-profile";
const address = { cityId: "00000000-0000-4000-8000-000000000001", line1: "Test street 1", postalCode: null };
const input = { contactName: "Test Person", phone: "+7 700 000 00 00", email: "TEST@example.invalid", legalAddress: address, deliveryAddress: address, expectedVersion: 1, idempotencyKey: "test-profile-key" };
it("requires both addresses, complete contact details and a version without caller-selected ownership", () => {
  expect(saveOrganizationProfileSchema.parse(input).email).toBe("test@example.invalid");
  for (const patch of [{ deliveryAddress: undefined }, { legalAddress: undefined }, { contactName: " " }, { phone: "-------" }, { organizationId: address.cityId }, { expectedVersion: 0 }, { deliveryAddress: { ...address, line1: " " } }]) {
    expect(saveOrganizationProfileSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  }
});

it("validates complete additional contacts and bounds the list without accepting ownership", () => {
  const contact = { contactName: "Other Person", phone: "+77000000001", email: "SECOND@example.invalid" };
  expect(saveOrganizationProfileSchema.parse({ ...input, additionalContacts: [contact] }).additionalContacts?.[0]?.email).toBe("second@example.invalid");
  for (const additionalContacts of [[{ ...contact, phone: "" }], [{ ...contact, userId: address.cityId }], Array(10).fill(contact)]) {
    expect(saveOrganizationProfileSchema.safeParse({ ...input, additionalContacts }).success).toBe(false);
  }
});

import { organizationContactSchema, supplierOrderContactsSchema } from "@marketplace/schemas";

/** Public queries select only these company fields, never reserve contacts. */
export const publicContactSelect = { contactName: true, phone: true, email: true } as const;

export function publicOrganizationContact(profile: unknown) {
  if (!profile || typeof profile !== "object") return null;
  const value = profile as Record<string, unknown>;
  const parsed = organizationContactSchema.safeParse({ contactName: value.contactName, phone: value.phone, email: value.email });
  return parsed.success ? parsed.data : null;
}

/** Call only after authorization of the order and its supplier has succeeded. */
export function supplierOrderContacts(profile: unknown) {
  const extra = profile && typeof profile === "object" && "additionalContacts" in profile ? profile.additionalContacts : [];
  const reserves = Array.isArray(extra) ? extra.slice(0, 9).flatMap(value => {
    const parsed = organizationContactSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  }) : [];
  return supplierOrderContactsSchema.parse({ official: publicOrganizationContact(profile), reserves });
}

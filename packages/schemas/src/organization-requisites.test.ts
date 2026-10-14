import { describe, expect, it } from "vitest";
import { confirmOrganizationRequisitesSchema, organizationBankAccountSchema, organizationRequisitesFieldsSchema, saveOrganizationRequisitesSchema } from "./organization-requisites";

const id = "10000000-0000-4000-8000-000000000001", second = "10000000-0000-4000-8000-000000000002";
const account = { id, bankName: "Fixture bank", iban: "KZ86125KZT5004100100", bic: "FAKEKZXX", kbe: "17", currency: "KZT" };
const period = { id, status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: null, reference: null };
const fields = { legalForm: "LEGAL_ENTITY", bankAccounts: [account], defaultBankAccountId: id, taxPeriods: [period] };
const command = { expectedVersion: 0, expectedOrganizationVersion: 1, idempotencyKey: "requisites-test-1" };

describe("requisites: complete records, partial overall draft and immutable command boundary", () => {
  it("accepts a draft without optional records and normalizes bank identifiers", () => {
    expect(saveOrganizationRequisitesSchema.parse({ ...command, fields: { legalForm: null, bankAccounts: [], defaultBankAccountId: null, taxPeriods: [] } }).fields.legalForm).toBeNull();
    expect(organizationBankAccountSchema.parse({ ...account, iban: account.iban.toLowerCase(), bic: "fakekzxx" })).toMatchObject(account);
    expect(organizationRequisitesFieldsSchema.safeParse(fields).success).toBe(true);
  });
  it.each([{ iban: "KZ00125KZT5004100100" }, { iban: "DE89370400440532013000" }, { bic: "bad" }, { kbe: "1" }, { currency: "USD" }, { beneficiary: "foreign" }])("rejects invalid bank data %j", patch => {
    expect(organizationBankAccountSchema.safeParse({ ...account, ...patch }).success).toBe(false);
  });
  it("rejects duplicate accounts and a default account outside the payload", () => {
    expect(organizationRequisitesFieldsSchema.safeParse({ ...fields, bankAccounts: [account, { ...account, id: second }] }).success).toBe(false);
    expect(organizationRequisitesFieldsSchema.safeParse({ ...fields, defaultBankAccountId: second }).success).toBe(false);
  });
  it("validates dates, non-overlapping periods and the distinction from an offer tax rate", () => {
    for (const patch of [{ effectiveFrom: "2026-02-30" }, { effectiveTo: "2025-12-31" }, { status: "EXEMPT" }, { rate: 16 }]) {
      expect(organizationRequisitesFieldsSchema.safeParse({ ...fields, taxPeriods: [{ ...period, ...patch }] }).success).toBe(false);
    }
    expect(organizationRequisitesFieldsSchema.safeParse({ ...fields, taxPeriods: [period, { ...period, id: second, effectiveFrom: "2027-01-01" }] }).success).toBe(false);
    expect(organizationRequisitesFieldsSchema.safeParse({ ...fields, taxPeriods: [{ ...period, effectiveTo: "2026-12-31" }, { ...period, id: second, status: "NOT_VAT_PAYER", effectiveFrom: "2027-01-01" }] }).success).toBe(true);
  });
  it("rejects caller-selected ownership, confirmation metadata and unacknowledged confirmation", () => {
    for (const patch of [{ organizationId: id }, { confirmedBy: id }, { expectedVersion: -1 }, { expectedOrganizationVersion: 0 }]) {
      expect(saveOrganizationRequisitesSchema.safeParse({ ...command, fields, ...patch }).success).toBe(false);
    }
    expect(confirmOrganizationRequisitesSchema.safeParse({ ...command, expectedVersion: 1, acknowledged: true }).success).toBe(true);
    for (const acknowledged of [undefined, false]) expect(confirmOrganizationRequisitesSchema.safeParse({ ...command, expectedVersion: 1, acknowledged }).success).toBe(false);
  });
});

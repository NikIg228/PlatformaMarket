import { z } from "zod";
import { organizationRequisitesRevisionSchema, organizationBankAccountSchema } from "./organization-requisites";
import { vatLineSnapshotSchema } from "./vat";

const minor = z.string().regex(/^(0|[1-9]\d{0,19})$/);
export const prepareOrderInvoiceSchema = z.object({
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(160),
  bankAccountId: z.uuid().optional(),
}).strict();
export const orderInvoiceSnapshotSchema = z.object({
  templateVersion: z.literal("PM_INVOICE_V1"),
  orderId: z.uuid(), orderNumber: z.string(), orderVersion: z.number().int().positive(),
  number: z.string(), version: z.number().int().positive(), date: z.iso.date(),
  supplier: organizationRequisitesRevisionSchema, buyer: organizationRequisitesRevisionSchema,
  bankAccount: organizationBankAccountSchema,
  lines: z.array(z.object({
    id: z.uuid(), name: z.string(), article: z.string(), unit: z.string(),
    quantity: z.string().regex(/^\d+(\.\d+)?$/), unitPriceMinor: minor, totalMinor: minor,
    tax: vatLineSnapshotSchema.nullable(), gift: z.boolean(),
  }).strict()).min(1),
  currency: z.literal("KZT"), totalMinor: minor, baseMinor: minor, vatMinor: minor,
}).strict();
export const orderInvoiceIssueSchema = z.object({
  party: z.enum(["SUPPLIER", "BUYER", "ORDER"]), code: z.string(), message: z.string(),
}).strict();
export const orderInvoiceViewSchema = z.object({
  documentId: z.uuid(), number: z.string(), version: z.number().int().positive(),
  status: z.enum(["GENERATING", "FAILED", "PREVIEW", "CONFIRMED", "SUPERSEDED"]),
  checksum: z.string().nullable(), snapshot: orderInvoiceSnapshotSchema,
  confirmedAt: z.iso.datetime().nullable(), confirmedByName: z.string().nullable(),
}).strict();
export const orderInvoicesResponseSchema = z.object({
  orderId: z.uuid(), orderVersion: z.number().int().positive(), currentDocumentId: z.uuid().nullable(),
  canPrepare: z.boolean(), issues: z.array(orderInvoiceIssueSchema),
  invoices: z.array(orderInvoiceViewSchema),
}).strict();
export type PrepareOrderInvoiceInput = z.infer<typeof prepareOrderInvoiceSchema>;
export type OrderInvoiceSnapshot = z.infer<typeof orderInvoiceSnapshotSchema>;
export type OrderInvoiceIssue = z.infer<typeof orderInvoiceIssueSchema>;
export type OrderInvoiceView = z.infer<typeof orderInvoiceViewSchema>;
export type OrderInvoicesResponse = z.infer<typeof orderInvoicesResponseSchema>;

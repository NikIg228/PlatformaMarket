import { z } from "zod";

const text = z.string().trim().min(1).max(160).regex(/^[^\u0000-\u001f\u007f]*$/);
const integer = (max: number, fallback: number, min = 0) => z.preprocess(value => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value, z.number().int().min(min).max(max).default(fallback));
export const operatorAuditQuerySchema = z.strictObject({
  organizationId: z.uuid().optional(), actorId: z.uuid().optional(), entityType: text.optional(), entityId: text.optional(), action: text.optional(),
  dateFrom: z.iso.date().optional(), dateTo: z.iso.date().optional(), offset: integer(1_000_000, 0), limit: integer(100, 25, 1),
}).refine(value => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, { message: "Invalid date range", path: ["dateTo"] });
const party = z.strictObject({ id: z.uuid(), name: z.string().nullable() });
export const operatorAuditEntrySchema = z.strictObject({
  id: z.uuid(), action: z.string(), entityType: z.string(), entityId: z.string(), createdAt: z.iso.datetime(),
  actor: party.nullable(), organization: party.nullable(),
  changes: z.array(z.strictObject({ field: z.string(), label: z.string(), before: z.string().nullable(), after: z.string().nullable() })),
  redacted: z.boolean(), href: z.string().startsWith("/admin?").nullable(),
});
export const operatorAuditPageSchema = z.strictObject({ items: z.array(operatorAuditEntrySchema), total: z.number().int().nonnegative(), offset: z.number().int().nonnegative(), limit: z.number().int().positive() });
export type OperatorAuditQuery = z.infer<typeof operatorAuditQuerySchema>;
export type OperatorAuditEntry = z.infer<typeof operatorAuditEntrySchema>;
export type OperatorAuditPage = z.infer<typeof operatorAuditPageSchema>;

import { z } from "zod";

export const approvalConditionsSchema = z.object({
  amountMinMinor: z.number().int().nonnegative().optional(),
  amountMaxMinor: z.number().int().nonnegative().optional(),
  currencies: z.array(z.string().trim().regex(/^[A-Z]{3}$/)).max(20).optional(),
  categoryIds: z.array(z.uuid()).max(100).optional(),
  regulatoryClasses: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  supplierIds: z.array(z.uuid()).max(100).optional(),
  branchIds: z.array(z.uuid()).max(100).optional(),
  urgent: z.boolean().optional(),
}).refine(
  (conditions) => conditions.amountMinMinor === undefined || conditions.amountMaxMinor === undefined || conditions.amountMinMinor <= conditions.amountMaxMinor,
  { message: "Minimum amount must not exceed maximum amount", path: ["amountMaxMinor"] },
);

export const approvalStepSchema = z.object({
  sequence: z.number().int().min(1).max(100),
  approverRoleCodes: z.array(z.string().trim().regex(/^[a-z][a-z0-9_]{2,62}$/)).min(1).max(20),
  minApprovals: z.number().int().min(1).max(20).default(1),
});

export const approvalStepsSchema = z.array(approvalStepSchema).min(1).max(20).superRefine((steps, context) => {
  const sequences = new Set<number>();
  for (const [index, step] of steps.entries()) {
    if (sequences.has(step.sequence)) {
      context.addIssue({ code: "custom", message: "Approval step sequences must be unique", path: [index, "sequence"] });
    }
    sequences.add(step.sequence);
    if (step.minApprovals > step.approverRoleCodes.length) {
      context.addIssue({ code: "custom", message: "Minimum approvals cannot exceed available approver roles", path: [index, "minApprovals"] });
    }
  }
});

export const createApprovalPolicySchema = z.object({
  name: z.string().trim().min(3).max(160),
  priority: z.number().int().min(1).max(10_000).default(100),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]).default("DRAFT"),
  conditions: approvalConditionsSchema,
  approvalSteps: approvalStepsSchema,
});

export const updateApprovalPolicySchema = z.object({
  version: z.number().int().min(1),
  name: z.string().trim().min(3).max(160).optional(),
  priority: z.number().int().min(1).max(10_000).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  conditions: approvalConditionsSchema.optional(),
  approvalSteps: approvalStepsSchema.optional(),
}).refine(
  ({ version: _version, ...changes }) => Object.values(changes).some((value) => value !== undefined),
  "At least one approval policy field must be changed",
);

export const evaluateApprovalSchema = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
  categoryIds: z.array(z.uuid()).max(100).default([]),
  regulatoryClass: z.string().trim().min(1).max(80).optional(),
  supplierId: z.uuid().optional(),
  branchId: z.uuid().optional(),
  urgent: z.boolean().default(false),
});

export type ApprovalConditionsInput = z.infer<typeof approvalConditionsSchema>;

export type ApprovalStepInput = z.infer<typeof approvalStepSchema>;

export type CreateApprovalPolicyInput = z.infer<typeof createApprovalPolicySchema>;

export type UpdateApprovalPolicyInput = z.infer<typeof updateApprovalPolicySchema>;

export type EvaluateApprovalInput = z.infer<typeof evaluateApprovalSchema>;

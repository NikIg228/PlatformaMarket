import { z } from "zod";

export const accessControlModeSchema = z.enum(["ROLE_BASED", "FULL_ACCESS"]);
export const accessPolicySchema = z.object({
  mode: accessControlModeSchema,
  permissions: z.array(z.string().min(1)),
});
export type AccessPolicy = z.infer<typeof accessPolicySchema>;

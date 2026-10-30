import { z } from "zod";

export const confirmSupplierOrderSchema = z.object({
  decisions: z.array(z.object({
    itemId: z.uuid(),
    acceptedQuantity: z.number().nonnegative().max(1_000_000),
    reasonCode: z.enum(["PRICE", "STOCK", "OTHER"]).optional(),
    reason: z.string().trim().min(3).max(500).optional(),
  })).min(1).max(500),
}).superRefine(({ decisions }, context) => {
  const seen = new Set<string>();
  for (const [index, decision] of decisions.entries()) {
    if (seen.has(decision.itemId)) context.addIssue({ code: "custom", message: "Order item decisions must be unique", path: ["decisions", index, "itemId"] });
    seen.add(decision.itemId);
  }
});

export type ConfirmSupplierOrderInput = z.infer<typeof confirmSupplierOrderSchema>;

export type ConfirmSupplierOrderRequest = z.input<typeof confirmSupplierOrderSchema>;

import { z } from "zod";
const count = z.number().int().nonnegative();
const source = <T extends z.ZodType>(data: T) => z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("AVAILABLE"), data }),
  z.strictObject({ status: z.enum(["UNAVAILABLE", "FORBIDDEN"]), data: z.null(), reason: z.enum(["SOURCE_UNAVAILABLE", "INSUFFICIENT_PERMISSIONS"]) }),
]);
export const operatorTechnicalSchema = z.strictObject({
  observedAt: z.iso.datetime(), scope: z.literal("PLATFORM_CURRENT_STATE"), canReplay: z.boolean(),
  search: source(z.strictObject({ products: count, indexed: count, missing: count, lastIndexedAt: z.iso.datetime().nullable() })),
  outbox: source(z.strictObject({ pending: count, processing: count, failed: count, deadLetter: count, published: count })),
  notifications: source(z.strictObject({ pending: count, processing: count, failed: count, dead: count, sent: count, cancelled: count })),
  background: source(z.strictObject({ scope: z.literal("CURRENT_PROCESS"), status: z.enum(["ok", "down"]), configured: z.boolean(),
    producer: z.enum(["disabled", "ready", "down"]), consumer: z.enum(["disabled", "ready", "down", "not_required"]),
    counts: z.strictObject({ waiting: count, active: count, failed: count, delayed: count }).nullable() })),
});
export type OperatorTechnical = z.infer<typeof operatorTechnicalSchema>;

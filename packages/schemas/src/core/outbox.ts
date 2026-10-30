import { z } from "zod";
import { dateTimeSchema, nullableDateTimeSchema } from "./primitives.js";

export const outboxDeadLetterQuerySchema = z.object({
  eventType: z.string().trim().min(1).max(120).optional(),
  eventId: z.uuid().optional(),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const outboxEventIdSchema = z.uuid();

export const outboxDeadLetterItemSchema = z.object({
  id: z.uuid(),
  aggregateType: z.string(),
  aggregateId: z.string(),
  eventType: z.string(),
  status: z.literal("DEAD_LETTER"),
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  availableAt: dateTimeSchema,
  lockedAt: nullableDateTimeSchema,
  publishedAt: nullableDateTimeSchema,
  lastError: z.string().nullable(),
  createdAt: dateTimeSchema,
});

export const outboxDeadLetterListResponseSchema = z.object({
  items: z.array(outboxDeadLetterItemSchema),
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  generatedAt: dateTimeSchema,
});

export const outboxReplaySchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  reason: z.string().trim().min(10).max(500),
  expectedAvailableAt: dateTimeSchema.optional(),
  expectedAttempts: z.number().int().nonnegative().optional(),
}).refine(value => (value.expectedAvailableAt === undefined) === (value.expectedAttempts === undefined), { message: "Both failure preconditions are required", path: ["expectedAvailableAt"] });

export const outboxReplayResponseSchema = z.object({
  eventId: z.uuid(),
  status: z.literal("PENDING"),
  attempts: z.literal(0),
  replayedAt: dateTimeSchema,
});

export type OutboxDeadLetterQuery = z.output<
  typeof outboxDeadLetterQuerySchema
>;

export type OutboxDeadLetterQueryInput = z.input<
  typeof outboxDeadLetterQuerySchema
>;

export type OutboxDeadLetterItem = z.infer<typeof outboxDeadLetterItemSchema>;

export type OutboxDeadLetterListResponse = z.infer<
  typeof outboxDeadLetterListResponseSchema
>;

export type OutboxReplayInput = z.infer<typeof outboxReplaySchema>;

export type OutboxReplayResponse = z.infer<typeof outboxReplayResponseSchema>;

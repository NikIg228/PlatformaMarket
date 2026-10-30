import { z } from "zod";
import { dateTimeSchema } from "./primitives.js";

export const errorResponseSchema = z
  .object({
    statusCode: z.number().int(),
    code: z.string(),
    message: z.unknown(),
    error: z.string().optional(),
    details: z.unknown().optional(),
    path: z.string(),
    requestId: z.string().optional(),
    timestamp: dateTimeSchema,
  })
  .passthrough();

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  environment: z.enum(["development", "test", "production"]),
  release: z.string(),
  role: z.enum(["api", "worker", "all"]),
  capabilities: z.object({
    http: z.boolean(),
    schedules: z.boolean(),
    queueProducer: z.boolean(),
    queueConsumer: z.boolean(),
  }),
});

export const dependencyHealthSchema = z
  .object({
    status: z.string(),
    error: z.string().optional(),
  })
  .passthrough();

export const readinessResponseSchema = z.object({
  status: z.literal("ready"),
  role: z.enum(["api", "worker", "all"]),
  capabilities: z.object({
    http: z.boolean(),
    schedules: z.boolean(),
    queueProducer: z.boolean(),
    queueConsumer: z.boolean(),
  }),
  requiredChecks: z.array(z.string()),
  checks: z.record(z.string(), dependencyHealthSchema),
});

import { z } from "zod";

export const notificationPreferenceSchema = z.object({
  userId: z.uuid().nullable().optional(),
  eventType: z.string().trim().min(1).max(160),
  channel: z.enum(["IN_APP", "EMAIL", "SMS", "WEBHOOK"]),
  enabled: z.boolean().default(true),
  destination: z.string().trim().max(1_000).nullable().optional(),
  quietHours: z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), timezone: z.string().trim().min(1).max(80) }).nullable().optional(),
});

export const createNotificationSchema = z.object({
  recipientOrganizationId: z.uuid(),
  recipientUserId: z.uuid().nullable().optional(),
  eventType: z.string().trim().min(1).max(160),
  channel: z.enum(["IN_APP", "EMAIL", "SMS", "WEBHOOK"]).default("IN_APP"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).default("NORMAL"),
  subject: z.string().trim().min(1).max(240),
  body: z.string().min(1).max(20_000),
  destination: z.string().trim().max(1_000).nullable().optional(),
  aggregateType: z.string().trim().max(120).nullable().optional(),
  aggregateId: z.string().trim().max(240).nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(240),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
  scheduledAt: z.iso.datetime().optional(),
});

export const notificationQuerySchema = z.object({
  channel: z.enum(["IN_APP", "EMAIL", "SMS", "WEBHOOK"]).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  status: z.enum(["PENDING", "PROCESSING", "SENT", "FAILED", "DEAD", "CANCELLED"]).optional(),
  unreadOnly: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceSchema>;

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>;

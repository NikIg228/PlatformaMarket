import { z } from "zod";

export const cdekCityQuerySchema = z.object({ city: z.string().trim().min(2).max(100) }).strict();
export const cdekCitiesSchema = z.array(z.object({ code: z.number().int().positive(), city: z.string(), region: z.string() }));
export const cdekSandboxQuoteInputSchema = z.object({
  fromCityCode: z.number().int().positive(),
  toCityCode: z.number().int().positive(),
  packages: z.array(z.object({
    weight: z.number().int().min(1).max(100000),
    length: z.number().int().min(1).max(300),
    width: z.number().int().min(1).max(300),
    height: z.number().int().min(1).max(300),
  }).strict()).min(1).max(20),
}).strict();
export const cdekSandboxQuoteSchema = z.object({
  mode: z.literal("sandbox"),
  payable: z.literal(false),
  calculatedAt: z.string().datetime(),
  currency: z.literal("KZT"),
  tariffs: z.array(z.object({
    code: z.number().int().positive(), name: z.string(),
    deliveryMode: z.number().int().min(1).max(4),
    amountMinor: z.string().regex(/^\d+$/),
    minDays: z.number().int().nonnegative(), maxDays: z.number().int().nonnegative(),
  })),
});
export const cdekSandboxStatusSchema = z.object({ enabled: z.boolean(), mode: z.literal("sandbox") });
export type CdekSandboxQuoteInput = z.infer<typeof cdekSandboxQuoteInputSchema>;
export type CdekSandboxQuote = z.infer<typeof cdekSandboxQuoteSchema>;
export type CdekCities = z.infer<typeof cdekCitiesSchema>;
export type CdekSandboxStatus = z.infer<typeof cdekSandboxStatusSchema>;

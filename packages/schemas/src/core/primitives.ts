import { z } from "zod";

export const decimalStringSchema = z.string().regex(/^-?\d+(?:\.\d+)?$/);

export const dateTimeSchema = z.iso.datetime();

export const nullableDateTimeSchema = dateTimeSchema.nullable();

export const currencySchema = z.string().regex(/^[A-Z]{3}$/);

export const organizationSummarySchema = z
  .object({
    id: z.uuid(),
    displayName: z.string(),
    legalName: z.string(),
    bin: z.string(),
  })
  .passthrough();

export const inventoryReservationResponseSchema = z
  .object({
    id: z.uuid(),
    quantity: decimalStringSchema,
    status: z.string(),
    expiresAt: dateTimeSchema,
  })
  .passthrough();

import { z } from "zod";

export const createSupplierProfileSchema = z.object({
  regulatoryDetails: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const createWarehouseSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9][A-Z0-9_-]{1,31}$/),
  name: z.string().trim().min(2).max(160),
  cityId: z.uuid().nullable().optional(),
  addressLine: z.string().trim().max(240).nullable().optional(),
  timezone: z.string().trim().min(3).max(80).default("Asia/Almaty"),
});

export const createSupplierDataSourceSchema = z.object({
  name: z.string().trim().min(2).max(160),
  type: z.enum(["MANUAL", "CSV", "EXCEL", "PDF", "API", "ERP"]),
  configuration: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type CreateSupplierProfileInput = z.infer<typeof createSupplierProfileSchema>;

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;

export type CreateSupplierDataSourceInput = z.infer<typeof createSupplierDataSourceSchema>;

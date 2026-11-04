import { Prisma } from "@prisma/client";
import { PermanentIntegrationError } from "./integration-adapter";

export function exactPriceMinor(value: unknown): number {
  if ((typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !/^[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value.trim()))) {
    throw new PermanentIntegrationError("Price must contain exact non-negative integer minor units");
  }
  const amount = new Prisma.Decimal(value);
  if (!amount.isFinite() || !amount.isInteger() || amount.isNegative() || amount.gt(Number.MAX_SAFE_INTEGER)) {
    throw new PermanentIntegrationError("Price is outside the exact integer range supported by the integration pipeline");
  }
  return amount.toNumber();
}

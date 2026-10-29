import { ConflictException } from "@nestjs/common";

/** Configuration must be enforced even when legacy MOCK records remain active. */
export function assertPaymentProviderAdmitted(code: string) {
  if (code === "MOCK" && (process.env.NODE_ENV === "production" || process.env.PAYMENT_PROVIDER_MODE === "external"))
    throw new ConflictException("MOCK payment provider is unavailable in production or external payment mode");
}

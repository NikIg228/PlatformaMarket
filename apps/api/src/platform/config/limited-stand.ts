import { ServiceUnavailableException } from "@nestjs/common";

export function isLimitedTestStand() {
  return ["1", "true", "yes", "on"].includes((process.env.LIMITED_TEST_STAND ?? "").toLowerCase());
}

export function requireExternalIntegrations() {
  if (isLimitedTestStand()) throw new ServiceUnavailableException({
    code: "TEST_STAND_INTEGRATION_DISABLED",
    message: "Внешние интеграции, платежи и отправки отключены на тестовом стенде.",
  });
}

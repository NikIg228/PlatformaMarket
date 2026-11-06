import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { environment, resetEnvironmentForTests } from "./environment";
import { requireExternalIntegrations } from "./limited-stand";

const config = {
  NODE_ENV: "production", DEPLOYMENT_PROFILE: "go_live", LIMITED_TEST_STAND: "true",
  DATABASE_URL: "postgresql://test:test@db/market_test?sslmode=verify-full",
  REDIS_URL: "rediss://default:test@redis:6379", AUTH_MODE: "jwt",
  ACCESS_CONTROL_MODE: "ROLE_BASED", JWT_SECRET: "s".repeat(64),
  JWT_ISSUER: "https://stand.example.kz", JWT_AUDIENCE: "market-test",
  JWT_REQUIRE_MFA: "true", TRUST_PROXY: "true", CORS_ORIGINS: "https://stand.example.kz",
  AUTH_EMAIL_BASE_URL: "https://stand.example.kz", SOCIAL_AUTH_ENABLED: "false",
  AUTH_LOCAL_MAIL_ENABLED: "false", LOCAL_OPERATOR_PASSWORD_LOGIN_ENABLED: "false",
  INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  APP_SECURITY_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString("base64"),
  MEDIA_SIGNING_SECRET: "m".repeat(48), METRICS_BEARER_TOKEN: "t".repeat(48),
  AV_SCAN_MODE: "required", OBJECT_STORAGE_DRIVER: "local", PAYMENT_PROVIDER_MODE: "disabled",
  LOCAL_STORAGE_PATH: "/data/market-files",
};

beforeEach(() => {
  resetEnvironmentForTests();
  for (const [key, value] of Object.entries(config)) vi.stubEnv(key, value);
});
afterEach(() => { vi.unstubAllEnvs(); resetEnvironmentForTests(); });

it("starts an explicit limited stand without external providers, retaining security settings", () => {
  expect(environment()).toMatchObject({ LIMITED_TEST_STAND: true, AUTH_MODE: "jwt", JWT_REQUIRE_MFA: true, ACCESS_CONTROL_MODE: "ROLE_BASED", AV_SCAN_MODE: "required", PAYMENT_PROVIDER_MODE: "disabled" });
});
it.each([
  { NODE_ENV: "development" }, { DEPLOYMENT_PROFILE: "pilot" }, { AUTH_MODE: "development" },
  { JWT_REQUIRE_MFA: "false" }, { ACCESS_CONTROL_MODE: "FULL_ACCESS" }, { TRUST_PROXY: "false" },
  { DATABASE_URL: "postgresql://test:test@db/market_test" }, { REDIS_URL: "redis://redis:6379" },
  { AV_SCAN_MODE: "disabled" }, { PAYMENT_PROVIDER_MODE: "mock" }, { PAYMENT_PROVIDER_MODE: "external" },
  { SOCIAL_AUTH_ENABLED: "true" }, { AUTH_LOCAL_MAIL_ENABLED: "true" },
  { APP_SECURITY_ENCRYPTION_KEY: "" }, { METRICS_BEARER_TOKEN: "" }, { OBJECT_STORAGE_DRIVER: "s3" },
  { LOCAL_STORAGE_PATH: "" }, { LOCAL_STORAGE_PATH: "/" }, { LOCAL_STORAGE_PATH: "public" },
])("rejects weakening the stand boundary: %j", override => {
  for (const [key, value] of Object.entries(override)) vi.stubEnv(key, value!);
  expect(() => environment()).toThrow("Invalid environment configuration");
});
it.each([
  ["PAYMENT_GATEWAY_URL", "https://payments.example.kz"], ["EMAIL_PROVIDER_TOKEN", "token".repeat(8)],
  ["SMS_PROVIDER_URL", "https://sms.example.kz"], ["SIGNATURE_GATEWAY_URL", "https://eds.example.kz"],
  ["OPENAI_API_KEY", "key".repeat(10)], ["SENTRY_DSN", "https://sentry.example.kz/1"],
  ["GOOGLE_CLIENT_IDS", "client"], ["EMAIL_PROVIDER_HEALTHCHECK_URL", "https://mail.example.kz/health"],
])("rejects external configuration %s", (key, value) => {
  vi.stubEnv(key, value);
  expect(() => environment()).toThrow("forbidden on the limited stand");
});
it("does not relax ordinary production requirements", () => {
  vi.stubEnv("LIMITED_TEST_STAND", "false");
  expect(() => environment()).toThrow("External payment gateway");
});
it("denies outbound operations for all accepted true encodings and preserves default behavior", () => {
  for (const value of ["true", "TRUE", "1", "yes", "on"]) {
    vi.stubEnv("LIMITED_TEST_STAND", value);
    expect(() => requireExternalIntegrations()).toThrow("отключены на тестовом стенде");
  }
  vi.stubEnv("LIMITED_TEST_STAND", "false");
  expect(() => requireExternalIntegrations()).not.toThrow();
});

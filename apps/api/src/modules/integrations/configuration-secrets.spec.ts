import { expect, it, vi } from "vitest";
import { IntegrationCryptoService } from "./integration-crypto.service";
import { IntegrationAdapterRegistry } from "./adapters/adapter-registry.service";
import { IntegrationsService } from "./integrations.service";
import { protectConfiguration, restoreConfiguration } from "./configuration-secrets";

const configuration = { endpoint: "https://synthetic.invalid", enabled: true, nested: { label: "public", accessToken: "SYNTHETIC_ACCESS" },
  items: [{ code: "public", credentials: { password: "SYNTHETIC_ARRAY" } }, [null, { refresh_token: "SYNTHETIC_REFRESH" }]] };

it("retains nested configuration exactly when the registry decrypts protected subtrees", () => {
  const crypto = new IntegrationCryptoService();
  const protectedValue = protectConfiguration(configuration);
  expect(JSON.stringify(protectedValue.publicValue)).not.toContain("SYNTHETIC_");
  const registry = new IntegrationAdapterRegistry(crypto, {} as never, {} as never, {} as never);
  const { context } = registry.resolve({ id: "connection", provider: "MOCK", configuration: protectedValue.publicValue,
    encryptedConfiguration: crypto.encryptJson(protectedValue.sensitiveValue), encryptedCredentials: null } as never);
  expect(context.configuration).toEqual(configuration);
});

it("redacts legacy connection lists and detail without mutating stored data", async () => {
  const connection = { id: "connection", configuration };
  const db = { integrationConnection: { findMany: vi.fn(async () => [connection]), findFirst: vi.fn(async () => connection) } };
  const service = new IntegrationsService(db as never, { assertCanManage: vi.fn() } as never, {} as never);
  const context = { organizationId: "supplier", actorId: "actor" };
  expect(JSON.stringify(await service.list("supplier", context))).not.toContain("SYNTHETIC_");
  expect(JSON.stringify(await service.get("supplier", "connection", context))).not.toContain("SYNTHETIC_");
  expect(connection.configuration).toEqual(configuration);
});

it("keeps updated public siblings and array shape when stored secrets are restored", () => {
  const protectedValue = protectConfiguration(configuration);
  const publicUpdate = { endpoint: configuration.endpoint, nested: { label: "updated" }, items: [{ code: "updated" }] };
  expect(restoreConfiguration(publicUpdate, protectedValue.sensitiveValue)).toEqual({
    endpoint: configuration.endpoint, nested: { label: "updated", accessToken: "SYNTHETIC_ACCESS" },
    items: [{ code: "updated", credentials: { password: "SYNTHETIC_ARRAY" } }],
  });
});

it.each(["accessToken", "refreshToken", "APIKey", "clientSecret", "private_key", "access-key", "Authorization", "credentials"])("protects key %s", key => {
  const result = protectConfiguration({ [key]: "SYNTHETIC_VALUE", priceTypeId: "public" });
  expect(result.publicValue).toEqual({ priceTypeId: "public" });
  expect(result.sensitiveValue).toEqual({ [key]: "SYNTHETIC_VALUE" });
});

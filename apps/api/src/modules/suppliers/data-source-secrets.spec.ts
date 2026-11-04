import { expect, it, vi } from "vitest";
import { SuppliersService } from "./suppliers.service";
import { IntegrationCryptoService } from "../integrations/integration-crypto.service";

const configuration = { endpoint: "https://synthetic.invalid", accessToken: "SYNTHETIC_ACCESS", nested: { label: "keep", refreshToken: "SYNTHETIC_REFRESH" },
  items: [{ name: "keep", token: "SYNTHETIC_ARRAY" }, [{ clientSecret: "SYNTHETIC_DEEP" }]], apiKey: "SYNTHETIC_KEY" };
function fixture() {
  let stored = { id: "source", configuration, encryptedConfiguration: null as string | null };
  const db = {
    supplierDataSource: { create: vi.fn(async ({ data }) => { stored = { ...stored, ...data }; return stored; }), findMany: vi.fn(async () => [{ id: stored.id, configuration: stored.configuration }]) },
    organizationCapability: { findUnique: vi.fn(async () => null) },
    supplierProfile: { findMany: vi.fn(async () => [{ dataSources: [{ id: stored.id, configuration: stored.configuration }] }]) },
    auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() }, $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(callback => callback(db));
  const crypto = new IntegrationCryptoService();
  const access = { assertCanManage: vi.fn(), requireProfile: vi.fn() };
  const service = new SuppliersService(db as never, access as never, crypto);
  return { db, service, crypto, stored: () => stored, access };
}
const context = { actorId: "actor", organizationId: "supplier" };
it("encrypts camelCase and array secrets while retaining public configuration", async () => {
  const f = fixture();
  const result = await f.service.createDataSource("supplier", { name: "synthetic", type: "API", configuration }, context);
  expect(JSON.stringify([result, f.db.auditLog.create.mock.calls, f.db.outboxEvent.create.mock.calls])).not.toContain("SYNTHETIC_");
  expect(JSON.stringify(f.stored().configuration)).not.toContain("SYNTHETIC_");
  expect(result.configuration).toMatchObject({ endpoint: configuration.endpoint, nested: { label: "keep" }, items: [{ name: "keep" }, [{}]] });
  expect(f.crypto.decryptJson(f.stored().encryptedConfiguration!)).toMatchObject({ accessToken: configuration.accessToken, nested: { refreshToken: configuration.nested.refreshToken }, items: [{ token: "SYNTHETIC_ARRAY" }, [{ clientSecret: "SYNTHETIC_DEEP" }]], apiKey: configuration.apiKey });
});
it("redacts legacy plaintext configuration on both read paths without rewriting it", async () => {
  const f = fixture();
  expect(JSON.stringify(await f.service.dataSources("supplier", context))).not.toContain("SYNTHETIC_");
  expect(JSON.stringify(await f.service.list(context))).not.toContain("SYNTHETIC_");
  expect(f.stored().configuration).toEqual(configuration);
  expect(f.db.supplierDataSource.create).not.toHaveBeenCalled();
});
it("denies unauthorized source creation and reads before accessing secrets", async () => {
  const f = fixture(); f.access.assertCanManage.mockRejectedValue(new Error("Denied"));
  await expect(f.service.createDataSource("supplier", { name: "synthetic", type: "API", configuration }, context)).rejects.toThrow("Denied");
  await expect(f.service.dataSources("supplier", context)).rejects.toThrow("Denied");
  expect(f.db.$transaction).not.toHaveBeenCalled(); expect(f.db.supplierDataSource.findMany).not.toHaveBeenCalled();
});

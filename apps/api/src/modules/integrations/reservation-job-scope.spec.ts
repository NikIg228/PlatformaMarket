import { describe, expect, it, vi } from "vitest";
import { MockIntegrationAdapter } from "./adapters/mock.adapter";
import { IntegrationAdapterRegistry } from "./adapters/adapter-registry.service";
import { PermanentIntegrationError, RetryableIntegrationError } from "./adapters/integration-adapter";
import { IntegrationExecutionService } from "./integration-execution.service";
import { ExternalReservationsService } from "./external-reservations.service";
import { IntegrationJobsService } from "./integration-jobs.service";
import { IntegrationWorkerService } from "./integration-worker.service";

const connectionId = "00000000-0000-4000-8000-000000000001";
const supplierId = "00000000-0000-4000-8000-000000000002";
const inventoryId = "00000000-0000-4000-8000-000000000003";
const recordId = "00000000-0000-4000-8000-00000000000a";
const otherId = "00000000-0000-4000-8000-00000000000b";
const jobTypes = ["RESERVATION_CREATE", "RESERVATION_RELEASE"] as const;
type JobType = typeof jobTypes[number];
type Scope = { id?: string; connectionId?: string; inventoryReservationId?: string; inventoryReservation?: { supplierOrganizationId?: string } };

function fixture(type: JobType, options: { foreignConnection?: boolean; foreignSupplier?: boolean; payload?: Record<string, unknown>; status?: string } = {}) {
  const connection = { id: connectionId, supplierOrganizationId: supplierId, provider: "MOCK", configuration: {}, encryptedCredentials: null, encryptedConfiguration: null };
  const row = { id: recordId, connectionId: options.foreignConnection ? otherId : connectionId, inventoryReservationId: inventoryId,
    inventoryReservation: { supplierOrganizationId: options.foreignSupplier ? otherId : supplierId }, status: options.status ?? "PENDING",
    externalReservationId: "original-local-id", responsePayload: { original: true }, lastError: "previous synthetic failure", lastAttemptAt: null };
  const job = { id: "00000000-0000-4000-8000-000000000004", type, connectionId, connection, status: "RUNNING", attempt: 1, maxAttempts: 5,
    availableAt: new Date(), lockedBy: `server:${process.pid}`, payload: options.payload ?? { externalReservationRecordId: recordId, inventoryReservationId: inventoryId, quantity: "2", externalReservationId: row.externalReservationId } };
  const equalId = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const matches = (where: Scope) =>
    (where.id === undefined || equalId(where.id, row.id)) &&
    (where.connectionId === undefined || equalId(where.connectionId, row.connectionId)) &&
    (where.inventoryReservationId === undefined || equalId(where.inventoryReservationId, row.inventoryReservationId)) &&
    (where.inventoryReservation?.supplierOrganizationId === undefined || equalId(where.inventoryReservation.supplierOrganizationId, row.inventoryReservation.supplierOrganizationId));
  const updateRecord = vi.fn(async ({ where, data }: { where: Scope; data: Record<string, unknown> }) => {
    if (!matches(where)) throw new Error("Scoped external reservation no longer matches");
    Object.assign(row, Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)));
    return { ...row };
  });
  const jobWrites = {
    integrationSyncJob: { update: vi.fn(async ({ data }: { data: object }) => { Object.assign(job, data); return job; }) },
    integrationConnection: { update: vi.fn(async () => connection) },
  };
  const prisma = {
    integrationConnection: { findUnique: vi.fn(async () => connection), ...jobWrites.integrationConnection },
    integrationSyncJob: { findUnique: vi.fn(async () => job), ...jobWrites.integrationSyncJob },
    externalReservation: { findFirst: vi.fn(async ({ where }: { where: Scope }) => matches(where) ? { id: row.id } : null), update: updateRecord },
    $transaction: vi.fn(async (callback: (tx: typeof jobWrites) => Promise<unknown>) => callback(jobWrites)),
    $executeRaw: vi.fn(async () => 0),
    $queryRaw: vi.fn().mockResolvedValueOnce([job]).mockResolvedValue([]),
  };
  const adapter = new MockIntegrationAdapter();
  const originalCreate = adapter.createReservation.bind(adapter);
  const originalRelease = adapter.releaseReservation.bind(adapter);
  const create = vi.spyOn(adapter, "createReservation");
  const release = vi.spyOn(adapter, "releaseReservation");
  const registry = new IntegrationAdapterRegistry({} as never, adapter, {} as never, {} as never);
  const jobs = new IntegrationJobsService(prisma as never);
  const execution = new IntegrationExecutionService(prisma as never, registry, jobs, {} as never, {} as never);
  const external = new ExternalReservationsService(prisma as never, registry, jobs);
  const worker = new IntegrationWorkerService(jobs, execution, {} as never);
  const snapshot = () => JSON.stringify(row);
  const expectNoRecordOrProviderEffects = () => {
    expect(updateRecord).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  };
  return { row, job, prisma, adapter, create, release, originalCreate, originalRelease, execution, external, jobs, worker, snapshot, expectNoRecordOrProviderEffects };
}

describe("job-driven external reservation isolation", () => {
  const invalidScopes = [
    { name: "another tenant and connection", foreignConnection: true, foreignSupplier: true },
    { name: "another connection of the same tenant", foreignConnection: true },
    { name: "foreign reservation attached to this connection", foreignSupplier: true },
    { name: "mismatched payload inventory reservation", payload: { externalReservationRecordId: recordId, inventoryReservationId: otherId } },
    { name: "unknown record UUID", payload: { externalReservationRecordId: otherId } },
  ];
  it.each(jobTypes.flatMap((type) => invalidScopes.map((scope) => ({ type, ...scope }))))("rejects $type targeting $name on every execution/retry", async ({ type, ...scope }) => {
    const f = fixture(type, scope);
    const before = f.snapshot();
    for (const attempt of [1, 2]) {
      f.job.attempt = attempt;
      await expect(f.execution.execute(f.job as never)).rejects.toBeInstanceOf(PermanentIntegrationError);
      expect(f.snapshot()).toBe(before);
      f.expectNoRecordOrProviderEffects();
    }
  });

  it.each(jobTypes.flatMap((type) => invalidScopes.map((scope) => ({ type, ...scope }))))("rejects equivalent agent $type completion targeting $name", async ({ type, ...scope }) => {
    const f = fixture(type, scope);
    const before = f.snapshot();
    await expect(f.external.finalizeAgentJob(f.job.id, { externalReservationId: "synthetic-agent-result" })).rejects.toBeInstanceOf(PermanentIntegrationError);
    expect(f.snapshot()).toBe(before);
    f.expectNoRecordOrProviderEffects();
  });

  it.each(jobTypes.flatMap((type) => [null, "", "   ", 123, [], {}].map((value) => ({ type, value }))))("rejects malformed tracked record references for $type (%j)", async ({ type, value }) => {
    const f = fixture(type, { payload: { externalReservationRecordId: value } });
    const before = f.snapshot();
    await expect(f.execution.execute(f.job as never)).rejects.toBeInstanceOf(PermanentIntegrationError);
    await expect(f.external.finalizeAgentJob(f.job.id, null)).rejects.toBeInstanceOf(PermanentIntegrationError);
    expect(f.snapshot()).toBe(before);
    f.expectNoRecordOrProviderEffects();
  });

  it.each(jobTypes)("does not broaden $type update if binding changes during the adapter call", async (type) => {
    const f = fixture(type);
    const businessState = () => JSON.stringify({ status: f.row.status, externalReservationId: f.row.externalReservationId, responsePayload: f.row.responsePayload, lastError: f.row.lastError, lastAttemptAt: f.row.lastAttemptAt });
    const before = businessState();
    if (type === "RESERVATION_CREATE") f.create.mockImplementationOnce(async (context, payload) => { f.row.connectionId = otherId; return f.originalCreate(context, payload); });
    else f.release.mockImplementationOnce(async (context, payload) => { f.row.connectionId = otherId; return f.originalRelease(context, payload); });
    await expect(f.execution.execute(f.job as never)).rejects.toThrow("no longer matches");
    expect(businessState()).toBe(before);
    f.create.mockClear(); f.release.mockClear();
    await expect(f.execution.execute(f.job as never)).rejects.toBeInstanceOf(PermanentIntegrationError);
    expect(f.create).not.toHaveBeenCalled(); expect(f.release).not.toHaveBeenCalled();
  });

  it.each(jobTypes)("marks a foreign $type worker job terminal without changing its victim record", async (type) => {
    const f = fixture(type, { foreignConnection: true, foreignSupplier: true });
    const before = f.snapshot();
    await f.worker.tick();
    expect(f.job.status).toBe("DEAD_LETTER");
    expect(f.job.lockedBy).toBeNull();
    expect(f.snapshot()).toBe(before);
    f.expectNoRecordOrProviderEffects();
  });

  it.each(jobTypes.flatMap((type) => ["PENDING", "ACTIVE", "FAILED", "RELEASED"].map((status) => ({ type, status }))))("preserves own $type from existing $status state and repeat behavior", async ({ type, status }) => {
    const f = fixture(type, { status });
    const first = await f.execution.execute(f.job as never);
    const second = await f.execution.execute(f.job as never);
    expect(second).toEqual(first);
    expect(f.row.status).toBe(type === "RESERVATION_CREATE" ? "ACTIVE" : "RELEASED");
    expect(f.row.connectionId).toBe(connectionId);
    expect(f.row.inventoryReservationId).toBe(inventoryId);
    expect(f.row.lastError).toBeNull();
    expect(f.row.lastAttemptAt).toBeInstanceOf(Date);
    expect(f.prisma.externalReservation.update).toHaveBeenCalledTimes(2);
  });

  it.each(jobTypes)("preserves untracked adapter-only $type jobs and agent no-op", async (type) => {
    const f = fixture(type, { payload: { quantity: "2" } });
    const before = f.snapshot();
    expect(await f.execution.execute(f.job as never)).toEqual(await f.execution.execute(f.job as never));
    await expect(f.external.finalizeAgentJob(f.job.id, undefined)).resolves.toBeUndefined();
    expect(f.snapshot()).toBe(before);
    expect(f.prisma.externalReservation.findFirst).not.toHaveBeenCalled();
    expect(f.prisma.externalReservation.update).not.toHaveBeenCalled();
  });

  it("preserves PostgreSQL UUID case semantics for an owned tracked record", async () => {
    const f = fixture("RESERVATION_CREATE", { payload: { externalReservationRecordId: recordId.toUpperCase() } });
    await f.execution.execute(f.job as never);
    expect(f.row.status).toBe("ACTIVE");
  });

  it.each([{ type: "RESERVATION_CREATE", remainingQuantity: 0, status: "ACTIVE" },
    { type: "RESERVATION_RELEASE", remainingQuantity: 0, status: "RELEASED" },
    { type: "RESERVATION_RELEASE", remainingQuantity: 1, status: "ACTIVE" }] as const)("preserves own agent $type remaining=$remainingQuantity -> $status", async ({ type, remainingQuantity, status }) => {
    const f = fixture(type, { payload: { externalReservationRecordId: recordId, inventoryReservationId: inventoryId, remainingQuantity } });
    await f.external.finalizeAgentJob(f.job.id, { externalReservationId: "synthetic-agent-result" });
    expect(f.row.status).toBe(status);
    expect(f.row.externalReservationId).toBe("synthetic-agent-result");
  });

  it("keeps a valid server partial release's existing local transition", async () => {
    const f = fixture("RESERVATION_RELEASE", { payload: { externalReservationRecordId: recordId, inventoryReservationId: inventoryId, remainingQuantity: 1 } });
    await f.execution.execute(f.job as never);
    expect(f.row.status).toBe("RELEASED");
  });

  it("preserves retryable adapter failures and a successful later retry", async () => {
    const f = fixture("RESERVATION_CREATE");
    const before = f.snapshot();
    f.create.mockRejectedValueOnce(new RetryableIntegrationError("synthetic transient failure", 1));
    await expect(f.execution.execute(f.job as never)).rejects.toBeInstanceOf(RetryableIntegrationError);
    expect(f.snapshot()).toBe(before);
    expect(f.prisma.externalReservation.update).not.toHaveBeenCalled();
    await f.execution.execute(f.job as never);
    expect(f.row.status).toBe("ACTIVE");
  });

  it("completes a valid own worker job", async () => {
    const f = fixture("RESERVATION_CREATE");
    await f.worker.tick();
    expect(f.job.status).toBe("SUCCEEDED");
    expect(f.row.status).toBe("ACTIVE");
    expect(f.prisma.integrationConnection.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: connectionId } }));
  });
});

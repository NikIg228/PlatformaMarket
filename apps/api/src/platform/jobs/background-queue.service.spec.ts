import "reflect-metadata";
import { Inject, Injectable, Module, type OnModuleInit } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackgroundQueueService } from "./background-queue.service";

const fixture = vi.hoisted(() => ({
  role: "worker" as "api" | "worker",
  enabled: true,
  production: false,
  connectionFailure: false,
  workers: 0,
  connections: 0,
  completion: Promise.resolve<unknown>(undefined),
  handle: vi.fn(),
  add: vi.fn(),
  quit: vi.fn(),
}));

vi.mock("../config/environment", () => ({ environment: () => ({
  PROCESS_ROLE: fixture.role,
  NODE_ENV: fixture.production ? "production" : "test",
  BACKGROUND_QUEUE_ENABLED: fixture.enabled,
  REDIS_URL: "redis://fixture-redis:6379",
  BACKGROUND_QUEUE_CONCURRENCY: 1,
}) }));
vi.mock("ioredis", () => ({ default: class RedisFixture {
  constructor() { fixture.connections++; }
  async connect() { if (fixture.connectionFailure) throw new Error("fixture connection denied"); }
  duplicate() { return new RedisFixture(); }
  async ping() { return "PONG"; }
  async quit() { fixture.quit(); }
} }));
vi.mock("bullmq", () => ({
  Queue: class {
    async add(...args: unknown[]) { fixture.add(...args); }
    async getJobCounts() { return { waiting: 0, active: 0, failed: 0, delayed: 0 }; }
    async close() {}
  },
  Worker: class {
    constructor(_name: string, process: (job: { name: string; data: Record<string, unknown>; id: string }) => Promise<unknown>) {
      fixture.workers++;
      // Persisted work can be delivered as soon as the consumer connects.
      fixture.completion = process({ name: "inventory.expiry", data: { persisted: true }, id: "queued-before-restart" })
        .catch(error => error);
    }
    on() { return this; }
    async close() {}
  },
}));

@Injectable()
class HandlerRegistration implements OnModuleInit {
  constructor(@Inject(BackgroundQueueService) private readonly queue: BackgroundQueueService) {}
  onModuleInit() { this.queue.register("inventory.expiry", fixture.handle); }
}
@Module({ providers: [BackgroundQueueService], exports: [BackgroundQueueService] })
class QueueModule {}
@Module({ imports: [QueueModule], providers: [HandlerRegistration] })
class HandlerModule {}
@Module({ imports: [QueueModule, HandlerModule] })
class RootModule {}
const start = () => NestFactory.createApplicationContext(RootModule, { logger: false, abortOnError: false });

beforeEach(() => {
  fixture.role = "worker";
  fixture.enabled = true;
  fixture.production = false;
  fixture.connectionFailure = false;
  fixture.workers = 0;
  fixture.connections = 0;
  fixture.completion = Promise.resolve(undefined);
  vi.clearAllMocks();
  fixture.handle.mockResolvedValue({ processed: true });
});

describe("background queue lifecycle", () => {
  it("handles a persisted job on its first delivery after every module registered its handler", async () => {
    const app = await start();
    try {
      expect(await fixture.completion).toEqual({ processed: true });
      expect(fixture.handle).toHaveBeenCalledExactlyOnceWith({ persisted: true }, "queued-before-restart");
      expect(await app.get(BackgroundQueueService).health()).toMatchObject({ status: "ok", consumer: "ready" });
    } finally { await app.close(); }
  });

  it("keeps API as producer only and closes its connection", async () => {
    fixture.role = "api";
    const app = await start();
    const queue = app.get(BackgroundQueueService);
    try {
      expect(fixture.workers).toBe(0);
      expect(await queue.enqueue("inventory.expiry")).toBe(true);
      expect(fixture.add).toHaveBeenCalledOnce();
      expect(await queue.health()).toMatchObject({ status: "ok", consumer: "not_required" });
    } finally { await app.close(); }
    expect(fixture.quit).toHaveBeenCalledOnce();
    expect(await queue.health()).toMatchObject({ status: "down" });
  });

  it("does not open Redis or consume when queues are disabled", async () => {
    fixture.enabled = false;
    const app = await start();
    try {
      expect(fixture.connections).toBe(0);
      expect(fixture.workers).toBe(0);
      expect(await app.get(BackgroundQueueService).enqueue("inventory.expiry")).toBe(false);
    } finally { await app.close(); }
  });

  it("fails production bootstrap and closes the failed connection", async () => {
    fixture.production = true;
    fixture.connectionFailure = true;
    await expect(start()).rejects.toThrow("fixture connection denied");
    expect(fixture.workers).toBe(0);
    expect(fixture.quit).toHaveBeenCalledOnce();
  });
});

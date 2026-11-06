import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { writeFileSync } from "node:fs";
assert.equal(process.env.LIMITED_TEST_STAND, "true");
assert.equal(new URL(process.env.DATABASE_URL).pathname, "/market_stand");
const prisma = new PrismaClient();
const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue("marketplace-background", { connection });
const key = "limited-stand-recovery-20261106";
try {
  if (process.argv[2] === "prepare") {
    const organization = await prisma.organization.findUniqueOrThrow({ where: { bin: "000000000001" } });
    await prisma.notification.create({ data: { recipientOrganizationId: organization.id, eventType: "stand.recovery.check", channel: "IN_APP", subject: "Тест восстановления стенда", body: "Синтетическая проверка: внутреннее уведомление после перезапуска обработчика.", idempotencyKey: key } });
    const job = await queue.add("notifications.tick", {}, { jobId: key, attempts: 3, removeOnComplete: false });
    assert.equal(await job.getState(), "waiting");
    console.log("PASS durable job waits while Market worker is stopped");
  } else if (process.argv[2] === "check") {
    const notification = await prisma.notification.findUniqueOrThrow({ where: { idempotencyKey: key }, include: { deliveryAttempts: true } });
    assert.equal(notification.status, "SENT");
    assert.equal(notification.attempts, 1);
    assert.equal(notification.deliveryAttempts.length, 1);
    assert.equal(await (await queue.getJob(key)).getState(), "completed");
    const result = { status: "PASS", durableJobRecovered: true, deliveryCount: 1, channel: "IN_APP", at: new Date().toISOString() };
    writeFileSync("/credentials/worker-recovery.json", JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
    console.log("PASS worker restart recovers queued job and delivers exactly one internal notification");
  } else throw new Error("Use prepare with worker stopped, then check after restart");
} finally { await queue.close(); connection.disconnect(); await prisma.$disconnect(); }

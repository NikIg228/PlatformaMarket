import { ConflictException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

/** Caller authorizes before entering this transaction; the scope includes tenant and actor. */
export async function workflowCommand<T>(tx: Prisma.TransactionClient, scope: string, key: string, input: unknown, execute: () => Promise<T>): Promise<T> {
  const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  // Updating the unchanged key obtains a row lock, including concurrent first attempts.
  const record = await tx.idempotencyRecord.upsert({ where: { scope_key: { scope, key } }, update: { key }, create: { scope, key, requestHash, expiresAt: new Date(Date.now() + 86_400_000) } });
  if (record.requestHash !== requestHash) throw new ConflictException("Idempotency key was already used for a different command");
  if (record.responseCode === 200) return record.responseBody as T;
  const result = await execute();
  await tx.idempotencyRecord.update({ where: { id: record.id }, data: { responseCode: 200, responseBody: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue } });
  return result;
}

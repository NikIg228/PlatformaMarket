import { ConflictException } from "@nestjs/common";
import { Prisma, type PaymentAttempt, type PaymentTransactionType } from "@prisma/client";
import { isDeepStrictEqual } from "node:util";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import type { PaymentAdapterResult } from "./adapters/payment-adapter";

export type PaymentOperation = {
  paymentIntentId: string;
  providerId: string;
  type: PaymentTransactionType;
  operationKey: string;
  clientIdempotencyKey: string;
  request: Record<string, unknown>;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function confirmedPaymentOperation(attempt: PaymentAttempt | null, operation: PaymentOperation) {
  const request = record(attempt?.requestPayload), response = record(attempt?.responsePayload);
  if (!attempt || attempt.status !== "SUCCEEDED" || response.status !== "SUCCEEDED" || !attempt.externalAttemptId
    || attempt.paymentIntentId !== operation.paymentIntentId || attempt.providerId !== operation.providerId
    || attempt.idempotencyKey !== operation.operationKey || request.operationKey !== operation.operationKey
    || request.operationType !== operation.type || request.clientIdempotencyKey !== operation.clientIdempotencyKey
    || !Object.entries(operation.request).every(([key, value]) => isDeepStrictEqual(request[key], value))) {
    throw new ConflictException("Payment operation requires reconciliation; no matching confirmed result is available");
  }
  return { attempt, operationKey: operation.operationKey, shouldCallProvider: false,
    result: { externalId: attempt.externalAttemptId, status: "SUCCEEDED", data: record(response.data) } as PaymentAdapterResult };
}

export async function recoverPaymentOperation(prisma: PrismaService, operation: PaymentOperation) {
  const attempt = await prisma.paymentAttempt.findUnique({ where: { paymentIntentId_idempotencyKey: {
    paymentIntentId: operation.paymentIntentId, idempotencyKey: operation.operationKey,
  } } });
  return confirmedPaymentOperation(attempt, operation);
}

export async function lockPaymentSettlement(tx: Prisma.TransactionClient, operation: PaymentOperation) {
  // The original finalizer and retries share this lock, including ledger and outbox writes.
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentIntent" WHERE "id" = ${operation.paymentIntentId}::uuid FOR UPDATE`);
  const completed = await tx.paymentTransaction.findFirst({ where: { paymentIntentId: operation.paymentIntentId, providerId: operation.providerId,
    type: operation.type, idempotencyKey: operation.clientIdempotencyKey } });
  if (completed) {
    const request = record(completed.requestPayload);
    if ((request.operationKey ?? request.idempotencyKey) !== operation.operationKey)
      throw new ConflictException("Payment key belongs to another operation");
  }
  return completed;
}

export async function assertPaymentSettlementPending(tx: Prisma.TransactionClient, paymentIntentId: string) {
  const current = await tx.paymentIntent.findUnique({ where: { id: paymentIntentId }, select: { status: true } });
  if (current?.status !== "PROCESSING") throw new ConflictException("Payment state changed before settlement; reconcile the operation");
}

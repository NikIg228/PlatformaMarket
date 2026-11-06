import { identitySessionRevokedSchema } from "@marketplace/schemas";

export function validateSessionRevocation(receipt: unknown, expectedSessionId: string) {
  const parsed = identitySessionRevokedSchema.safeParse(receipt);
  if (!parsed.success || parsed.data.id !== expectedSessionId)
    throw new Error("Сервер не подтвердил завершение выбранной сессии. Повторите попытку.");
  return parsed.data;
}

import { BadRequestException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { z } from "zod";

const cursorSchema = z.object({ scope: z.string(), asOf: z.iso.datetime(), at: z.iso.datetime(), id: z.uuid() }).strict();
/** Cursor data never supplies authorization. Every query keeps its own tenant predicate. */
export function workspacePage(scope: unknown[], cursor?: string) {
  const digest = createHash("sha256").update(JSON.stringify(scope)).digest("hex");
  let position: z.infer<typeof cursorSchema> | undefined;
  if (cursor) {
    try {
      position = cursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
      if (position.scope !== digest || position.at > position.asOf) throw new Error();
    } catch { throw new BadRequestException("Cursor does not match this workspace or filter. Refresh the list."); }
  }
  const asOf = position?.asOf ?? new Date().toISOString();
  return {
    where: { AND: [
      { createdAt: { lte: new Date(asOf) } },
      ...(position ? [{ OR: [{ createdAt: { lt: new Date(position.at) } }, { createdAt: new Date(position.at), id: { lt: position.id } }] }] : []),
    ] },
    finish<T extends { id: string; createdAt: Date }>(rows: T[], limit: number) {
      const items = rows.slice(0, limit), last = items.at(-1);
      return { items, nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ scope: digest, asOf, at: last.createdAt.toISOString(), id: last.id })).toString("base64url") : null };
    },
  };
}
export const workspaceOrderBy = [{ createdAt: "desc" }, { id: "desc" }] as const;

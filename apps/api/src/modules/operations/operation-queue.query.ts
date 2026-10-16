import { Prisma } from "@prisma/client";
import type { OperationWorkQueueQuery } from "@marketplace/schemas";
import type { AuthorityActorContext } from "../access-control/platform-authority.policy";
import { operationQueueSources } from "./operation-queue.sources";

export function operationQueueQuery(query: OperationWorkQueueQuery, context: AuthorityActorContext, now: Date, promotionsEnabled: boolean): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (query.kind !== "ALL") conditions.push(Prisma.sql`"queueType" = ${query.kind}`);
  if (query.priority) conditions.push(Prisma.sql`priority = ${query.priority}`);
  if (query.assignment === "MINE") conditions.push(Prisma.sql`"assigneeId" = ${context.actorId}::uuid`);
  if (query.assignment === "UNASSIGNED") conditions.push(Prisma.sql`"assigneeId" IS NULL`);
  if (query.assignment === "ASSIGNED") conditions.push(Prisma.sql`"assigneeId" IS NOT NULL`);
  if (query.due === "OVERDUE") conditions.push(Prisma.sql`"dueAt" < ${now}`);
  if (query.due === "SCHEDULED") conditions.push(Prisma.sql`"dueAt" IS NOT NULL`);
  if (query.due === "UNSCHEDULED") conditions.push(Prisma.sql`"dueAt" IS NULL`);
  if (query.q) {
    const pattern = `%${query.q.replace(/[\\%_]/g, char => `\\${char}`)}%`;
    conditions.push(Prisma.sql`"searchText" ILIKE ${pattern}`);
  }
  const where = conditions.length ? Prisma.join(conditions, " AND ") : Prisma.sql`TRUE`;
  const order = query.sort === "recent" ? Prisma.sql`"updatedAt" DESC, "queueType" ASC, id ASC`
    : query.sort === "oldest" ? Prisma.sql`"openedAt" ASC, "queueType" ASC, id ASC`
    : Prisma.sql`CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END ASC,
      "dueAt" ASC NULLS LAST, "openedAt" ASC, "queueType" ASC, id ASC`;
  // One PostgreSQL statement gives counts and page the same MVCC snapshot.
  // Assignments are joined by their unique tenant/type/entity key, never by entity alone.
  return Prisma.sql`WITH sources ("queueType", id, title, "organizationId", "relatedOrganizationId", "openedAt", "sourceUpdatedAt", "defaultPriority", reason, target, "searchRef") AS (
      ${operationQueueSources(promotionsEnabled)}
    ), cases AS (
      SELECT s.*, o."displayName" AS "organizationName", related."displayName" AS "relatedOrganizationName",
        COALESCE(a.priority, s."defaultPriority") AS priority, a."dueAt", a."assigneeId", u."displayName" AS "assigneeName",
        a.id AS "assignmentId", a.version AS "assignmentVersion", a.reason AS "assignmentReason", a."updatedAt" AS "assignmentUpdatedAt",
        GREATEST(s."sourceUpdatedAt", a."updatedAt") AS "updatedAt",
        concat_ws(' ', s.title, s.id::text, s.reason, s."searchRef", o."displayName", o."legalName", o.bin,
          related."displayName", related."legalName", related.bin) AS "searchText"
      FROM sources s JOIN "Organization" o ON o.id = s."organizationId"
      LEFT JOIN "Organization" related ON related.id = s."relatedOrganizationId"
      LEFT JOIN "OperationAssignment" a ON a."operatorOrganizationId" = ${context.organizationId}::uuid AND a."queueType" = s."queueType" AND a."entityId" = s.id
      LEFT JOIN "User" u ON u.id = a."assigneeId"
    ), filtered AS (SELECT * FROM cases WHERE ${where}),
    page AS (SELECT *, row_number() OVER (ORDER BY ${order}) AS position FROM filtered ORDER BY ${order} LIMIT ${query.limit} OFFSET ${query.offset})
    SELECT totals.*, page.* FROM (SELECT (SELECT count(*)::integer FROM cases) AS "totalOpenItems", (SELECT count(*)::integer FROM filtered) AS total) totals
    LEFT JOIN page ON TRUE ORDER BY page.position`;
}

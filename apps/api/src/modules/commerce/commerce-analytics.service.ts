import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { commerceAnalyticsResponseSchema, type CommerceAnalyticsQuery, type CommerceMetricTotals } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { AccessControlService } from "../access-control/access-control.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";

type Aggregate = { kind: string; orders: bigint; goods: Prisma.Decimal; commission: Prisma.Decimal; organizationId?: string; name?: string; side?: "BUYER" | "SUPPLIER" };
export function metricTotals(rows: Aggregate[]): CommerceMetricTotals {
  const row = (kind: string) => rows.find(value => value.kind === kind);
  const count = (kind: string) => Number(row(kind)?.orders ?? 0);
  const amount = (kind: string) => row(kind)?.goods.toFixed(0) ?? "0";
  const fee = (kind: string) => BigInt(row(kind)?.commission.toFixed(0) ?? "0");
  return { createdOrders: count("CREATED"), confirmedOrders: count("CONFIRMED"), receivedOrders: count("RECEIVED"),
    fulfilledOrders: count("FULFILLED"), cancelledOrders: count("CANCELLED"), refusedPriceOrders: count("REFUSED_PRICE"),
    refusedStockOrders: count("REFUSED_STOCK"), refusedOtherOrders: count("REFUSED_OTHER"),
    createdGoodsMinor: amount("CREATED"), confirmedGoodsMinor: amount("CONFIRMED"), receivedGoodsMinor: amount("RECEIVED"), returnedGoodsMinor: amount("RETURNED"),
    netReceivedGoodsMinor: (BigInt(amount("RECEIVED")) - BigInt(amount("RETURNED"))).toString(),
    preliminaryCommissionMinor: fee("CREATED").toString(), accruedCommissionMinor: (fee("RECEIVED") + fee("RETURNED")).toString(),
    collectedCommissionMinor: null, commissionDebtMinor: null };
}

@Injectable()
export class CommerceAnalyticsService {
  constructor(private readonly db: PrismaService, private readonly access: AccessControlService) {}
  async report(query: CommerceAnalyticsQuery, context: SupplierActorContext) {
    if (!context.actorId) throw new UnauthorizedException("Требуется вход в систему");
    if (!context.organizationId) throw new ForbiddenException("Требуется активная организация");
    const capabilities = await this.db.organizationCapability.findMany({ where: { organizationId: context.organizationId }, select: { capability: true } });
    const has = (value: string) => capabilities.some(row => row.capability === value);
    const operator = has("MARKETPLACE_OPERATOR") && await this.access.hasAll(context.actorId, context.organizationId, ["organization.view"]);
    const buyer = has("BUYER") && await this.access.hasAll(context.actorId, context.organizationId, ["order.create"]);
    const supplier = has("SUPPLIER") && await this.access.hasAll(context.actorId, context.organizationId, ["order.confirm"]);
    if (!operator && !buyer && !supplier) throw new ForbiddenException("Недостаточно прав для аналитики");
    if (!operator && query.organizationId && query.organizationId !== context.organizationId) throw new ForbiddenException("Доступны только заказы своей организации");
    const selected = operator ? query.organizationId : context.organizationId;
    const tenant = !selected ? Prisma.sql`TRUE` : operator ? Prisma.sql`(o."buyerOrganizationId" = ${selected}::uuid OR o."supplierOrganizationId" = ${selected}::uuid)` : Prisma.sql`(${buyer} AND o."buyerOrganizationId" = ${selected}::uuid OR ${supplier} AND o."supplierOrganizationId" = ${selected}::uuid)`;
    const orderScope = Prisma.sql`${tenant} AND o."commerceDataset" = ${query.dataset} AND o.currency = ${query.currency}`;
    const from = new Date(query.from), to = new Date(query.to), generatedAt = new Date();
    const eventScope = Prisma.sql`${orderScope} AND e."occurredAt" >= ${from} AND e."occurredAt" < ${to}`;
    return this.db.$transaction(async tx => {
      // Prisma stores DateTime as UTC timestamp without a zone; Date parameters
      // are timestamptz. Keep comparisons independent of the server/session zone.
      await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
      const totals = await tx.$queryRaw<Aggregate[]>(Prisma.sql`SELECT e.kind, COUNT(DISTINCT e."supplierOrderId") AS orders, SUM(e."goodsAmountMinor") AS goods, SUM(e."commissionAmountMinor") AS commission FROM "CommerceMetricEvent" e JOIN "SupplierOrder" o ON o.id = e."supplierOrderId" WHERE ${eventScope} GROUP BY e.kind`);
      // Bound the number of organizations before loading their per-kind aggregates.
      const groups = await tx.$queryRaw<Aggregate[]>(Prisma.sql`
        WITH scoped AS (SELECT e.*, o."buyerOrganizationId", o."supplierOrganizationId" FROM "CommerceMetricEvent" e JOIN "SupplierOrder" o ON o.id = e."supplierOrderId" WHERE ${eventScope}),
        sides AS (SELECT s.*, v.id AS "organizationId", v.side FROM scoped s CROSS JOIN LATERAL (VALUES(s."buyerOrganizationId", 'BUYER'), (s."supplierOrganizationId", 'SUPPLIER')) v(id,side)),
        chosen AS (SELECT DISTINCT "organizationId", side FROM sides ORDER BY "organizationId", side LIMIT 201)
        SELECT s."organizationId", s.side, org."displayName" AS name, s.kind, COUNT(DISTINCT s."supplierOrderId") AS orders, SUM(s."goodsAmountMinor") AS goods, SUM(s."commissionAmountMinor") AS commission
        FROM sides s JOIN chosen c USING ("organizationId", side) JOIN "Organization" org ON org.id = s."organizationId"
        GROUP BY s."organizationId", s.side, org."displayName", s.kind ORDER BY s."organizationId", s.side, s.kind`);
      const organizations = new Map<string, { organizationId: string; name: string; side: "BUYER" | "SUPPLIER"; rows: Aggregate[] }>();
      for (const row of groups) {
        const key = `${row.organizationId}:${row.side}`;
        const group = organizations.get(key) ?? { organizationId: row.organizationId!, name: row.name!, side: row.side!, rows: [] };
        group.rows.push(row); organizations.set(key, group);
      }
      const events = await tx.$queryRaw<Array<{ id: string; orderId: string; orderNumber: string; kind: string; occurredAt: Date; buyerOrganizationId: string; supplierOrganizationId: string; goodsAmountMinor: Prisma.Decimal; commissionAmountMinor: Prisma.Decimal }>>(Prisma.sql`
        SELECT e.id, o.id AS "orderId", o."orderNumber", e.kind, e."occurredAt", o."buyerOrganizationId", o."supplierOrganizationId", e."goodsAmountMinor", e."commissionAmountMinor"
        FROM "CommerceMetricEvent" e JOIN "SupplierOrder" o ON o.id = e."supplierOrderId" WHERE ${eventScope}
        ORDER BY e."occurredAt" DESC, e.id DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
      const [eventCount] = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*) AS count FROM "CommerceMetricEvent" e JOIN "SupplierOrder" o ON o.id = e."supplierOrderId" WHERE ${eventScope}`);
      const [coverage] = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*) AS count FROM "SupplierOrder" o JOIN "Checkout" c ON c.id = o."checkoutId" WHERE ${orderScope} AND c.status = 'COMPLETED' AND o."createdAt" >= ${from} AND o."createdAt" < ${to} AND NOT EXISTS (SELECT 1 FROM "CommerceMetricEvent" e WHERE e."supplierOrderId" = o.id AND e.kind = 'CREATED')`);
      const [repeat] = await tx.$queryRaw<Array<{ days30: bigint; days60: bigint }>>(Prisma.sql`
        SELECT COUNT(DISTINCT o."buyerOrganizationId") FILTER (WHERE EXISTS (SELECT 1 FROM "CommerceMetricEvent" p JOIN "SupplierOrder" po ON po.id = p."supplierOrderId" WHERE p.kind = 'FULFILLED' AND po."buyerOrganizationId" = o."buyerOrganizationId" AND po."commerceDataset" = o."commerceDataset" AND po.currency = o.currency AND p."occurredAt" < e."occurredAt" AND p."occurredAt" >= e."occurredAt" - INTERVAL '30 days' ${!operator ? Prisma.sql`AND (${buyer} AND po."buyerOrganizationId" = ${context.organizationId}::uuid OR ${supplier} AND po."supplierOrganizationId" = ${context.organizationId}::uuid)` : Prisma.empty})) AS days30,
        COUNT(DISTINCT o."buyerOrganizationId") FILTER (WHERE EXISTS (SELECT 1 FROM "CommerceMetricEvent" p JOIN "SupplierOrder" po ON po.id = p."supplierOrderId" WHERE p.kind = 'FULFILLED' AND po."buyerOrganizationId" = o."buyerOrganizationId" AND po."commerceDataset" = o."commerceDataset" AND po.currency = o.currency AND p."occurredAt" < e."occurredAt" AND p."occurredAt" >= e."occurredAt" - INTERVAL '60 days' ${!operator ? Prisma.sql`AND (${buyer} AND po."buyerOrganizationId" = ${context.organizationId}::uuid OR ${supplier} AND po."supplierOrganizationId" = ${context.organizationId}::uuid)` : Prisma.empty})) AS days60
        FROM "CommerceMetricEvent" e JOIN "SupplierOrder" o ON o.id = e."supplierOrderId" WHERE ${eventScope} AND e.kind = 'CREATED'`);
      const [overdue] = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*) AS count FROM "Shipment" s JOIN "SupplierOrder" o ON o.id = s."supplierOrderId" WHERE ${orderScope} AND s."deliveryWindowEnd" < ${generatedAt} AND s."dispatchedAt" IS NOT NULL AND s."deliveredAt" IS NULL AND s.status NOT IN ('CANCELLED','RETURNED')`);
      return commerceAnalyticsResponseSchema.parse({
        period: { from: from.toISOString(), to: to.toISOString(), timezone: query.timezone, boundary: "FROM_INCLUSIVE_TO_EXCLUSIVE" }, dataset: query.dataset, currency: query.currency, generatedAt: generatedAt.toISOString(),
        commissionRateBps: 1000, commissionRuleVersion: "GOODS_RECEIPT_V1", totals: metricTotals(totals),
        repeatBuyers30Days: Number(repeat.days30), repeatBuyers60Days: Number(repeat.days60), overdueShipmentsAsOfNow: Number(overdue.count),
        coverage: { untrackedOrdersInPeriod: Number(coverage.count), historyComplete: false, note: "История до включения учёта не восстановлена. Повторные покупки учитывают только известные события исполнения. Задержки — отправленные, не полученные поставки с истёкшим сроком доставки на момент отчёта. Поступление комиссии и задолженность пока не учитываются." },
        organizations: [...organizations.values()].slice(0, 200).map(({ rows, ...value }) => ({ ...value, totals: metricTotals(rows) })), organizationsTruncated: organizations.size > 200,
        events: events.map(row => ({ ...row, occurredAt: row.occurredAt.toISOString(), goodsAmountMinor: row.goodsAmountMinor.toFixed(0), commissionAmountMinor: row.commissionAmountMinor.toFixed(0), currency: query.currency, dataset: query.dataset })),
        totalEvents: Number(eventCount.count), page: query.page, pageSize: query.pageSize,
      });
    }, { isolationLevel: "RepeatableRead", timeout: 15000 });
  }
}

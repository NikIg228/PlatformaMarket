import { randomUUID } from "node:crypto";
import { operatorOrdersFixture } from "./operator-orders";
import { workspaceFixture } from "./workspace-session";

export async function operatorDocumentExceptionsFixture() {
  const f = await operatorOrdersFixture();
  let supplierUserId: string | undefined, supplierRoleId: string | undefined;
  const dispose = async () => {
    try {
      const claims = await f.db.orderDiscrepancy.findMany({ where: { supplierOrderId: { in: f.orderIds } }, select: { id: true } });
      const ids = claims.map(row => row.id);
      await f.db.orderDiscrepancyEvent.deleteMany({ where: { supplierOrderId: { in: f.orderIds } } });
      await f.db.operationAssignment.deleteMany({ where: { entityId: { in: ids } } });
      await f.db.outboxEvent.deleteMany({ where: { aggregateId: { in: f.orderIds } } });
      await f.db.auditLog.deleteMany({ where: { OR: [{ entityId: { in: ids } }, { organizationId: f.operator.org.id }, { organizationId: f.restricted.org.id }] } });
      await f.db.idempotencyRecord.deleteMany({ where: { OR: [{ scope: { contains: f.operator.user.id } }, { scope: { contains: f.restricted.user.id } }] } });
      if (supplierUserId) {
        await f.db.authSession.deleteMany({ where: { userId: supplierUserId } });
        await f.db.organizationMembership.deleteMany({ where: { userId: supplierUserId } });
        if (supplierRoleId) await f.db.role.delete({ where: { id: supplierRoleId } });
        await f.db.user.delete({ where: { id: supplierUserId } });
      }
    } finally { await f.dispose(); }
  };
  try {
    const permission = await f.db.permission.findUniqueOrThrow({ where: { code: "support.ticket.manage" } });
    await f.db.rolePermission.create({ data: { roleId: f.operator.role.id, permissionId: permission.id } });
    const key = randomUUID();
    const user = await f.db.user.create({ data: { email: `exception-${key}@example.invalid`, displayName: "Поставщик проверки", emailVerifiedAt: new Date() } }); supplierUserId = user.id;
    const role = await f.db.role.create({ data: { organizationId: f.supplier.id, code: `exception-${key}`, name: "Exception fixture", permissions: { create: [{ permission: { connect: { code: "order.confirm" } } }] } } }); supplierRoleId = role.id;
    await f.db.organizationMembership.create({ data: { userId: user.id, organizationId: f.supplier.id, status: "ACTIVE", roles: { create: { roleId: role.id } } } });
    const session = await workspaceFixture(f.db, "SUPPLIER", { userId: user.id, organizationId: f.supplier.id, displayName: user.displayName });
    const claim = await f.db.orderDiscrepancy.findFirstOrThrow({ where: { supplierOrderId: f.orderId, status: "SUBMITTED" } });
    const draft = await f.db.orderDiscrepancy.findFirstOrThrow({ where: { supplierOrderId: f.orderId, status: "DRAFT" } });
    return { ...f, claim, draft, supplierActor: { user, role, headers: { authorization: `Bearer ${session.accessToken}` } }, dispose };
  } catch (error) { await dispose(); throw error; }
}

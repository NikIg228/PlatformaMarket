import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { commerce } from "./verify-checkout-snapshot.mjs";
const require = createRequire(import.meta.url);
const domain = (path, name) => require(`../../apps/api/dist/src/modules/${path}`)[name];

export async function verifyManualPayments({ prisma, offers, supplierId, createBuyer, createCartWithItem, runId, assert, request }) {
  const Workflow = domain("commerce/order-workflow.service.js", "OrderWorkflowService");
  const Permissions = domain("access-control/access-control.service.js", "AccessControlService");
  const Reviews = domain("commerce/payment-review.service.js", "PaymentReviewService");
  const Policy = domain("commerce/supplier-payment-policy.service.js", "SupplierPaymentPolicyService");
  const workflow = new Workflow(prisma, new Permissions(prisma));
  const [buyer, primary, backup] = await Promise.all([61, 62, 63].map(index => createBuyer(index)));
  const buyerContext = { actorId: buyer.userId, organizationId: buyer.organizationId };
  const supplierContext = { actorId: primary.userId, organizationId: supplierId };
  const buyerRole = await prisma.role.findFirstOrThrow({ where: { organizationId: buyer.organizationId } });
  await prisma.rolePermission.create({ data: { roleId: buyerRole.id, permissionId: (await prisma.permission.findUniqueOrThrow({ where: { code: "order.approve" } })).id } });
  const supplierRole = await prisma.role.create({ data: { organizationId: supplierId, code: `${runId}-payment`, name: "Synthetic payment review",
    permissions: { create: ["order.confirm", "payment.transfer.confirm", "supplier.profile.manage"].map(code => ({ permission: { connect: { code } } })) } } });
  for (const person of [primary, backup]) await prisma.organizationMembership.create({ data: { organizationId: supplierId, userId: person.userId, status: "ACTIVE", roles: { create: { roleId: supplierRole.id } } } });
  const policyService = new Policy(prisma);
  const policy = { primaryUserId: primary.userId, backupUserId: backup.userId, timezone: "Asia/Almaty", workingWindows: [1, 2, 3, 4, 5, 6, 7].map(day => ({ day, fromMinute: 0, toMinute: 1440 })) };
  const policyInput = { ...policy, expectedVersion: 0, idempotencyKey: randomUUID() };
  assert((await policyService.save(policyInput, supplierContext)).version === 1, "Payment policy not saved");
  assert((await policyService.save(policyInput, supplierContext)).version === 1, "Payment policy replay changed version");
  const deniedPolicy = await request("/suppliers/current/payment-review-policy", { identity: buyer });
  assert(deniedPolicy.status === 403, "Buyer could read supplier payment staff");
  const policyResponse = await request("/suppliers/current/payment-review-policy", { identity: { userId: primary.userId, organizationId: supplierId } });
  assert(policyResponse.status === 200 && policyResponse.body.policy.primaryUserId === primary.userId, "Policy HTTP contract unavailable");
  const reject = async (operation, status, label) => { let caught; try { await operation(); } catch (error) { caught = error; } assert(caught?.getStatus?.() === status, `${label}: expected ${status}, got ${caught?.message ?? "success"}`); };
  await reject(() => policyService.save({ ...policyInput, idempotencyKey: randomUUID() }, supplierContext), 409, "Stale policy");
  await reject(() => policyService.save({ ...policyInput, expectedVersion: 1, backupUserId: buyer.userId, idempotencyKey: randomUUID() }, supplierContext), 409, "Foreign reviewer");
  const cases = [];
  for (const [index, offer] of offers.entries()) {
    // Integer totals deliberately exceed JavaScript's exact Number range.
    await prisma.offerPrice.updateMany({ where: { offerId: offer.offerId }, data: { amountMinor: "4503599627370497" } });
    const cart = await createCartWithItem(buyer, offer.offerId, 2);
    const checkout = await commerce(prisma).checkout(cart.id, { idempotencyKey: `${runId}-payment-${index}` }, buyerContext);
    const order = checkout.supplierOrders[0], item = order.items[0];
    await prisma.supplierOrderItem.update({ where: { id: item.id }, data: { acceptedQuantity: 2, status: "CONFIRMED" } });
    const invoiceId = randomUUID();
    await prisma.supplierOrder.update({ where: { id: order.id }, data: { status: "AWAITING_PAYMENT", manualInvoiceDocumentId: invoiceId } });
    cases.push({ ...offer, order, item, invoiceId });
  }
  const execute = async (value, action, context = supplierContext, service = workflow) => {
    const state = await prisma.supplierOrder.findUniqueOrThrow({ where: { id: value.order.id } });
    return service.execute(value.order.id, { ...action, expectedVersion: state.version, idempotencyKey: randomUUID() }, context);
  };
  const proof = async (value, amount) => {
    const storageKey = `${runId}/${randomUUID()}.pdf`, checksumSha256 = "a".repeat(64);
    await prisma.uploadAsset.create({ data: { organizationId: buyer.organizationId, purpose: "DOCUMENT", storageKey, originalName: "synthetic.pdf", safeName: "synthetic.pdf", declaredMime: "application/pdf", detectedMime: "application/pdf", sizeBytes: 1, checksumSha256, status: "CLEAN" } });
    return prisma.document.create({ data: { ownerOrganizationId: buyer.organizationId, supplierOrderId: value.order.id, kind: "PAYMENT_PROOF", format: "PDF", source: "UPLOADED", status: "GENERATED", title: "Synthetic payment proof", documentNumber: randomUUID(), amountMinor: amount, currency: "KZT", storageKey, checksumSha256, immutableAt: new Date() } });
  };
  const report = async (value, amount) => {
    const document = await proof(value, amount);
    await execute(value, { action: "REPORT_TRANSFER", documentId: document.id, invoiceDocumentId: value.invoiceId, amountMinor: amount, paidAt: new Date().toISOString(), comment: "Synthetic transfer" }, buyerContext);
    return prisma.orderTransferClaim.findFirstOrThrow({ where: { documentId: document.id } });
  };
  const summary = async value => (await workflow.get(value.order.id, buyerContext)).paymentSummary;
  const balance = value => prisma.inventoryBalance.findUniqueOrThrow({ where: { id: value.balanceId } });
  const [partial, reduction, disputed, timed, rollback, racing] = cases;
  const partialClaim = await report(partial, "9007199254740993");
  assert((await summary(partial)).confirmedAmountMinor === "0", "Receipt counted as received money");
  await execute(partial, { action: "CONFIRM_TRANSFER", claimId: partialClaim.id, receivedAmountMinor: "9007199254740993" });
  assert((await summary(partial)).remainingAmountMinor === "1" && (await balance(partial)).quantityReserved.eq(2), "One-tiyn shortage lost precision or released stock");
  const extra = await report(partial, "2");
  const paid = await execute(partial, { action: "CONFIRM_TRANSFER", claimId: extra.id, receivedAmountMinor: "2" });
  assert(paid.paymentStatus === "PAID" && (await summary(partial)).overpaidAmountMinor === "1", "Overpayment not separately accounted");
  assert((await balance(partial)).quantityOnHand.eq(8) && (await balance(partial)).quantityReserved.eq(0), "Payment did not consume exactly once");
  const later = await report(partial, "1");
  await execute(partial, { action: "CONFIRM_TRANSFER", claimId: later.id, receivedAmountMinor: "1" });
  assert((await summary(partial)).overpaidAmountMinor === "2" && (await balance(partial)).quantityOnHand.eq(8), "Later transfer consumed stock twice");
  await reject(() => execute(partial, { action: "CONFIRM_TRANSFER", claimId: later.id }, buyerContext), 403, "Buyer confirms money");

  const reductionClaim = await report(reduction, "4503599627370497");
  await execute(reduction, { action: "CONFIRM_TRANSFER", claimId: reductionClaim.id, receivedAmountMinor: "4503599627370497" });
  await execute(reduction, { action: "PROPOSE_PAYMENT_REDUCTION", reason: "Synthetic underpayment", items: [{ itemId: reduction.item.id, acceptedQuantity: "1" }] }, buyerContext);
  const proposal = await prisma.orderPaymentReduction.findFirstOrThrow({ where: { supplierOrderId: reduction.order.id, status: "PENDING" } });
  await reject(() => execute(reduction, { action: "DECIDE_PAYMENT_REDUCTION", reductionId: proposal.id, accepted: true }, buyerContext), 403, "Unilateral reduction");
  assert((await balance(reduction)).quantityReserved.eq(2), "Proposal changed stock before consent");
  await execute(reduction, { action: "DECIDE_PAYMENT_REDUCTION", reductionId: proposal.id, accepted: true });
  const reduced = await workflow.get(reduction.order.id, buyerContext);
  assert(reduced.paymentStatus === "PAID" && reduced.invoiceDocumentId === null && reduced.paymentSummary.remainingAmountMinor === "0", "Bilateral reduction did not re-evaluate covered total");
  assert(reduced.order.subtotalAmountMinor.toString() === "4503599627370497" && reduced.reductions[0].previousAmountMinor.toString() === "9007199254740994", "Reduction destroyed old amount evidence");
  assert((await balance(reduction)).quantityOnHand.eq(9) && (await balance(reduction)).quantityAvailable.eq(9), "Reduction released or consumed wrong quantity");

  const disputedClaim = await report(disputed, "1");
  await execute(disputed, { action: "RECORD_TRANSFER_CHECK", claimId: disputedClaim.id, comment: "Synthetic bank not received", nextCheckAt: new Date(Date.now() + 600000).toISOString() });
  assert((await summary(disputed)).confirmedAmountMinor === "0", "Not-received check counted as payment");
  await execute(disputed, { action: "OPEN_PAYMENT_DISPUTE", claimId: disputedClaim.id, reason: "Synthetic disputed transfer" }, buyerContext);
  await execute(disputed, { action: "OPEN_PAYMENT_DISPUTE", claimId: disputedClaim.id, reason: "Synthetic supplier clarification" });
  assert(await prisma.supportTicket.count({ where: { number: `PAY-${disputedClaim.id}` } }) === 1, "Dispute duplicated support case");
  assert((await summary(disputed)).status === "DISPUTED" && (await balance(disputed)).quantityReserved.eq(2), "Dispute lost stock hold");

  const timedClaim = await report(timed, "1");
  const start = timedClaim.reviewStartedAt;
  const tickAt = minutes => new Reviews(prisma).tick(new Date(start.getTime() + minutes * 60000));
  const notices = () => prisma.notification.findMany({ where: { aggregateId: timed.order.id, eventType: "ManualPaymentReviewRequired" } });
  await tickAt(14);
  assert((await notices()).length === 1, "Reminder before 15 minutes");
  await Promise.all([tickAt(15), tickAt(15)]);
  assert((await notices()).length === 2, "Concurrent 15-minute reminder duplicated");
  await tickAt(30);
  assert((await notices()).some(notice => notice.recipientUserId === backup.userId), "Backup not notified");
  await Promise.all([tickAt(60), tickAt(60)]);
  assert(await prisma.supportTicket.count({ where: { number: `PAY-${timedClaim.id}` } }) === 1, "60-minute escalation not exactly once");
  assert((await summary(timed)).confirmedAmountMinor === "0", "Escalation fabricated paid money");

  const rollbackClaim = await report(rollback, "9007199254740994");
  const failing = new Proxy(prisma, { get(target, key) {
    if (key !== "$transaction") return Reflect.get(target, key);
    return (callback, options) => target.$transaction(tx => callback(new Proxy(tx, { get(client, property) {
      if (property !== "outboxEvent") return Reflect.get(client, property);
      return new Proxy(client.outboxEvent, { get(model, operation) {
        if (operation !== "create") return Reflect.get(model, operation);
        return () => { throw new Error("Synthetic payment failure before commit"); };
      } });
    } })), options);
  } });
  let failure;
  try { await execute(rollback, { action: "CONFIRM_TRANSFER", claimId: rollbackClaim.id }, supplierContext, new Workflow(failing, new Permissions(prisma))); } catch (error) { failure = error; }
  assert(failure?.message === "Synthetic payment failure before commit", "Rollback barrier not reached");
  assert((await summary(rollback)).confirmedAmountMinor === "0" && (await balance(rollback)).quantityReserved.eq(2) && (await balance(rollback)).quantityOnHand.eq(10), "Failed payment partially committed");
  await execute(rollback, { action: "CONFIRM_TRANSFER", claimId: rollbackClaim.id });

  const racingClaim = await report(racing, "9007199254740994");
  const raceOrder = await prisma.supplierOrder.findUniqueOrThrow({ where: { id: racing.order.id } });
  const command = { action: "CONFIRM_TRANSFER", claimId: racingClaim.id, expectedVersion: raceOrder.version, idempotencyKey: randomUUID() };
  const results = await Promise.all([workflow.execute(racing.order.id, command, supplierContext), workflow.execute(racing.order.id, command, supplierContext)]);
  assert(results[0].eventId === results[1].eventId && (await balance(racing)).quantityOnHand.eq(8), "Confirmation replay duplicated money or inventory");
  const foreign = await request(`/supplier-orders/${racing.order.id}/workflow`, { identity: backup });
  assert(foreign.status === 404, "Foreign tenant read another order's ledger");
  console.log("Manual payments: policy permissions/CAS/replay, exact partial/extra amounts, bilateral reduction/history, dispute/hold, 15/30/60 dedup, rollback and concurrent confirmation PASS");
}

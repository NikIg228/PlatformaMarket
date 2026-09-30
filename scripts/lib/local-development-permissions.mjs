// Permissions for newly created internal-demo employees. This is deliberately
// narrower than onboarding owners: no external connector, merchant or role admin.
export const localDevelopmentPermissions = {
  clinic: ["organization.view", "catalog.product.view", "order.create", "order.approve", "document.view", "document.upload", "document.sign", "document.accounting.review", "notification.view", "geo.view"],
  supplier: ["organization.view", "supplier.profile.manage", "supplier.warehouse.manage", "catalog.product.view", "catalog.offer.edit", "catalog.offer.publish", "pricing.manage", "import.manage", "matching.manage", "inventory.view", "inventory.adjust", "inventory.freshness.manage", "order.confirm", "payment.transfer.confirm", "document.view", "document.upload", "document.issue", "document.sign", "document.accounting.review", "compliance.view", "compliance.credential.manage", "shipment.manage", "delivery.view", "delivery.manage"],
};

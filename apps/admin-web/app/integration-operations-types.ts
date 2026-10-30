export type Supplier = {
  organizationId: string;
  organization: { displayName: string };
};

export type Binding = {
  id: string;
  dataType: string;
  warehouseId?: string | null;
  offerId?: string | null;
  priority: number;
  status: string;
};

export type Mapping = {
  id: string;
  entityType: string;
  externalId: string;
  internalId?: string | null;
  status: string;
};

export type Agent = {
  agentId: string;
  status: string;
  version?: string | null;
  lastHeartbeatAt?: string | null;
};

export type Connection = {
  id: string;
  provider: string;
  mode: string;
  status: string;
  displayName: string;
  version: number;
  lastSuccessAt?: string | null;
  lastError?: string | null;
  bindings: Binding[];
  mappings: Mapping[];
  agent?: Agent | null;
  _count: {
    jobs: number;
    webhookEvents: number;
    reconciliationEntries: number;
    externalReservations: number;
  };
};

export type Job = {
  id: string;
  type: string;
  status: string;
  trigger: string;
  attempt: number;
  maxAttempts: number;
  lastError?: string | null;
  createdAt: string;
};

export type Reconciliation = {
  id: string;
  kind: string;
  status: string;
  externalRef?: string | null;
  resolution?: string | null;
  detectedAt: string;
};

export type CreateResult = {
  connection: Connection;
  enrollment?: { agentId: string; enrollmentToken: string; expiresAt: string };
  webhook?: { endpointPath: string; signingSecret: string };
};

export type Warehouse = { id: string; code: string; name: string };

export type Offer = {
  id: string;
  productVariantId: string;
  supplierSku?: string | null;
  productVariant: { product: { canonicalName: string } };
};

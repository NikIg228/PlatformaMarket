import { z } from "zod";
import { searchCatalogSchema, compareOffersSchema } from "../../../../packages/schemas/src/index";
import { workspaceOrderQuerySchema, workspacePageQuerySchema } from "../../../../packages/schemas/src/workspace-reads";
import { supportTicketQuerySchema, supportMessageQuerySchema } from "../../../../packages/schemas/src/support-workflow";
import { type MobileReadQuery } from "../../../../contracts/mobile-read/read-queries";
import { createScopedCoreReadQueries as createMobileReadQueries } from "../scoped-core-read-queries";
import type { ReadScope } from "../../../../contracts/mobile-read/read-adapter";
import { bindMarketReads, MarketHttpError } from "../market-transport";
import { createMarketOperationScope } from "../market-operation-scope";

const kinds = ["catalog", "comparison", "workspace-orders", "organization-profile", "workflow", "cart", "checkout", "workspace-carts", "support-tickets", "support-ticket"] as const;
type Kind = typeof kinds[number];
type Queries = ReturnType<typeof createMobileReadQueries>;
type Phase = ReturnType<Queries["getState"]>["phase"] | "not-run";
export type CoreReadCaptureReport = Readonly<{
  status: "INPUT_INVALID" | "CONSISTENT_READ" | "UNSUPPORTED_READ" | "CONSUMER_REJECTED";
  stage: "input" | "query" | "capture" | "consumer";
  queryKind?: Kind; consumerPhase: Phase; matchedRecords: number;
  serverAccepted: false; productionAuthorizationVerified: false; networkRequests: 0; mutations: 0; credentialStoreAccessed: false;
}>;
class CaptureInputError extends Error { constructor() { super("Invalid offline core read capture"); } }
function decode<T>(schema: z.ZodType<T>, input: unknown): T {
  try { const parsed = schema.safeParse(input); if (parsed.success) return parsed.data; } catch { /* No private input/getter errors in reports. */ }
  throw new CaptureInputError();
}
function object(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new CaptureInputError();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) throw new CaptureInputError();
  for (const key of Reflect.ownKeys(input)) if (typeof key !== "string" || !allowed.includes(key)) throw new CaptureInputError();
  return input as Record<string, unknown>;
}
function scalars(input: unknown, allowed: readonly string[]) {
  const raw = object(input, allowed), result: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    const value = raw[key];
    if (value !== null && value !== undefined && !["string", "number", "boolean"].includes(typeof value)) throw new CaptureInputError();
    result[key] = value;
  }
  return Object.freeze(result);
}
function snapshotQuery(input: unknown, organizationId: string): MobileReadQuery {
  const header = decode(z.object({ kind: z.enum(kinds) }).strip(), input), kind = header.kind;
  if (["catalog", "comparison", "workspace-orders", "workspace-carts", "support-tickets"].includes(kind)) {
    const raw = object(input, ["kind", "input"]);
    if (raw.kind !== kind) throw new CaptureInputError();
    const schema = kind === "catalog" ? searchCatalogSchema : kind === "comparison" ? compareOffersSchema : kind === "workspace-orders" ? workspaceOrderQuerySchema : kind === "workspace-carts" ? workspacePageQuerySchema : supportTicketQuerySchema;
    const fields = scalars(raw.input, Object.keys(schema.shape).filter(key => key !== "buyerOrganizationId"));
    decode<unknown>(schema.strict(), kind === "catalog" || kind === "comparison" ? { ...fields, buyerOrganizationId: organizationId } : fields);
    // Keep z.input scalars. The real dispatcher decides defaults/coercion/encoding, including exact quantity text.
    return Object.freeze({ kind, input: fields }) as MobileReadQuery;
  }
  const schemas = {
    "organization-profile": z.object({ kind: z.literal("organization-profile") }).strict(),
    workflow: z.object({ kind: z.literal("workflow"), orderId: z.uuid() }).strict(),
    cart: z.object({ kind: z.literal("cart"), cartId: z.uuid() }).strict(),
    checkout: z.object({ kind: z.literal("checkout"), checkoutId: z.uuid(), cartId: z.uuid() }).strict(),
    "support-ticket": z.object({ kind: z.literal("support-ticket"), ticketId: z.uuid(), beforeMessageId: z.string().optional() }).strict(),
  };
  const selected = kind as keyof typeof schemas, raw = scalars(input, Object.keys(schemas[selected].shape));
  const parsed = decode<MobileReadQuery>(schemas[selected], raw);
  if (parsed.kind === "support-ticket") decode(supportMessageQuerySchema.strict(), { beforeMessageId: parsed.beforeMessageId });
  return Object.freeze(parsed);
}

/** Standalone saved-JSON compatibility replay; never auth admission, a network client or a command executor. */
export async function replayCoreReadCapture(input: unknown): Promise<CoreReadCaptureReport> {
  let stage: CoreReadCaptureReport["stage"] = "input", kind: Kind | undefined, matched = 0, invalidCapture = false;
  let lifetime: ReturnType<typeof createMarketOperationScope> | undefined, queries: Queries | undefined;
  let client: ReturnType<typeof bindMarketReads> | undefined, scope: ReadScope | undefined;
  const report = (status: CoreReadCaptureReport["status"], consumerPhase: Phase = "not-run"): CoreReadCaptureReport => Object.freeze({ status, stage, ...(kind === undefined ? {} : { queryKind: kind }), consumerPhase, matchedRecords: matched, serverAccepted: false, productionAuthorizationVerified: false, networkRequests: 0, mutations: 0, credentialStoreAccessed: false });
  try {
    const envelope = object(input, ["formatVersion", "scope", "query", "records"]);
    if (envelope.formatVersion !== 1) throw new CaptureInputError();
    const owner = scalars(envelope.scope, ["product", "environment", "userId", "organizationId", "generation"]);
    lifetime = createMarketOperationScope(owner as ReadScope, () => true, () => new CaptureInputError()); scope = lifetime.owner;
    stage = "query"; const query = snapshotQuery(envelope.query, scope.organizationId); kind = query.kind;
    stage = "capture";
    const records = envelope.records;
    if (!Array.isArray(records) || records.length !== 1) throw new CaptureInputError();
    const record = object(records[0], ["method", "path", "httpStatus", "body"]);
    const header = decode(z.object({ method: z.literal("GET"), path: z.string().min(1), httpStatus: z.number().int().min(200).max(599) }).strict(), { method: record.method, path: record.path, httpStatus: record.httpStatus });
    if (!Object.hasOwn(record, "body")) throw new CaptureInputError();
    client = bindMarketReads(async path => {
      try {
        lifetime!.assert(scope!);
        if (matched !== 0 || path !== header.path) throw new CaptureInputError();
        matched++;
        let body: unknown;
        try { body = record.body; } catch { throw new CaptureInputError(); }
        if (header.httpStatus < 300) return body;
        throw new MarketHttpError(header.httpStatus, body);
      } catch (error) {
        if (!(error instanceof MarketHttpError)) { invalidCapture = true; throw new CaptureInputError(); }
        throw error;
      }
    }, scope.organizationId);
    queries = createMobileReadQueries(scope, client);
    stage = "consumer"; await queries.load(query); const state = queries.getState();
    if (invalidCapture || matched !== 1) { stage = "capture"; return report("INPUT_INVALID"); }
    return report(state.phase === "ready" || state.phase === "empty" ? "CONSISTENT_READ" : state.phase === "unsupported" ? "UNSUPPORTED_READ" : "CONSUMER_REJECTED", state.phase);
  } catch { return report(stage === "consumer" ? "CONSUMER_REJECTED" : "INPUT_INVALID", stage === "consumer" ? "error" : "not-run"); }
  finally { lifetime?.close(); if (queries && scope && client) queries.reset(scope, client); }
}

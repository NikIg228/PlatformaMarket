import { createMarketOperationScope } from "./market-operation-scope";
import type { ReadScope } from "./read-controller";

export type NativeUuidProvider = Readonly<{ randomUUID?: () => unknown }>;
export class NativeUuidSourceError extends Error {
  constructor(readonly code: "scope" | "unavailable" | "entropy" | "invalid" | "duplicate") {
    super(code === "scope" ? "UUID context is unavailable" : "Native UUID source is unavailable");
    this.name = "NativeUuidSourceError";
  }
}
const randomUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Explicit native crypto capability only. Function presence never grants an action or attests a device. */
export function createNativeUuidSource(scope: ReadScope, provider: NativeUuidProvider | undefined, isCurrent: () => boolean) {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new NativeUuidSourceError("scope"));
  let generate: (() => unknown) | undefined;
  try {
    const method = provider?.randomUUID;
    if (typeof method === "function") generate = () => method.call(provider);
  } catch { /* Missing native capability; never expose provider/getter details. */ }
  const issued = new Set<string>();
  let issuing = false;
  return Object.freeze({
    canIssue(candidate: ReadScope) {
      try { lifetime.assert(candidate); return generate !== undefined && !issuing; }
      catch { return false; }
    },
    next(candidate: ReadScope): string {
      lifetime.assert(candidate);
      if (!generate || issuing) throw new NativeUuidSourceError("unavailable");
      issuing = true;
      try {
        let value: unknown;
        try { value = generate(); }
        catch { lifetime.assert(candidate); throw new NativeUuidSourceError("entropy"); }
        lifetime.assert(candidate);
        if (typeof value !== "string" || value.length !== 36 || !randomUuid.test(value)) throw new NativeUuidSourceError("invalid");
        if (issued.has(value)) throw new NativeUuidSourceError("duplicate");
        issued.add(value);
        return value;
      } finally { issuing = false; }
    },
    close() { lifetime.close(); generate = undefined; issued.clear(); },
  });
}
export type NativeUuidSource = ReturnType<typeof createNativeUuidSource>;

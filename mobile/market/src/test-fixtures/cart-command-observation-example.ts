import type { CartQuantityInput, CartVersionInput } from "../cart-command-fixture";
import { MarketHttpError } from "../market-transport";
import { createCartObservationKernel, submitCartObservationInitial, applyCartObservationAction, type CartObservationKind, type CartObservationAction } from "./cart-command-observation-kernel";
import { cartCommandScope, commandCart, recoveredCartResult, cartCommandError } from "./cart-commands";
import { savedPage } from "./carts";

export const cartObservationCases = ["quantity-review", "quantity-close", "quantity-prepare", "quantity-workspace-none", "quantity-workspace-other", "remove-review", "remove-close", "remove-prepare", "remove-workspace-none", "remove-workspace-other"] as const;
export type CartObservationCase = typeof cartObservationCases[number];
type Record = { method: "GET" | "PATCH" | "DELETE"; path: string; httpStatus: number; body: unknown; requestBody?: unknown };
export type CartObservationExample = { formatVersion: 1; kind: CartObservationKind; action: CartObservationAction; scope: typeof cartCommandScope; expected: { cartId: string; cartVersion: number; itemId: string }; query: { kind: "workspace-carts"; input: { limit: number; q: string } }; parent: Record; operation: Record; observation: Record };
/** Original CAS attempt is unknown; fresh data is an observation, never attribution of the earlier operation. */
export async function cartCommandObservationExample(caseId: CartObservationCase = "quantity-review"): Promise<CartObservationExample> {
  if (!cartObservationCases.includes(caseId)) throw Error("Unknown synthetic cart observation case");
  const kind = caseId.startsWith("quantity") ? "quantity" : "remove", action = caseId.endsWith("close") ? "close-read" : caseId.endsWith("prepare") ? "prepare" : caseId.includes("workspace") ? "observe-workspace" : "review";
  const scope = Object.freeze({ ...cartCommandScope, environment: "https://market.example.invalid/api" }), original = commandCart(3), parentBody = savedPage(original, []), observedBody = savedPage(caseId.endsWith("workspace-none") ? null : caseId.endsWith("workspace-other") ? recoveredCartResult() : commandCart(4, "7.000001"), []);
  const query = { kind: "workspace-carts" as const, input: { limit: 1, q: "" } }, expected = { cartId: original.id, cartVersion: original.version, itemId: original.items[0]!.id };
  let parent: Record | undefined, operation: Record | undefined, observation: Record | undefined;
  const kernel = createCartObservationKernel(scope, query, async path => {
    if (!parent) { parent = { method: "GET", path, httpStatus: 200, body: parentBody }; return parentBody; }
    if (observation) throw Error("Repeated synthetic cart observation"); observation = { method: "GET", path, httpStatus: 200, body: observedBody }; return observedBody;
  }, async (method, path, requestBody) => {
    if (operation || method !== "PATCH" && method !== "DELETE") throw Error("Unexpected repeated synthetic cart command"); const body = { ...cartCommandError(500).payload, path }; operation = { method, path, httpStatus: 500, requestBody, body }; throw new MarketHttpError(500, body);
  });
  try {
    await kernel.load(); if (!await submitCartObservationInitial(kernel, kind, expected.itemId, 3.500001) || kernel.model.stateFor(expected.cartId).phase !== "unknown" || !kernel.model.canRead(expected.cartId, expected.itemId)) throw Error("Synthetic cart unknown attempt rejected");
    await kernel.model.readCurrent(expected.cartId, expected.itemId); if (!applyCartObservationAction(kernel, expected.cartId, expected.itemId, action)) throw Error("Synthetic cart source observation unavailable");
    if (!parent || !operation || !observation) throw Error("Incomplete synthetic cart observation");
    const requestBody = operation.requestBody as CartQuantityInput | CartVersionInput; if (requestBody.expectedVersion !== expected.cartVersion) throw Error("Synthetic cart source version drift");
    return { formatVersion: 1, kind, action, scope, expected, query, parent, operation, observation };
  } finally { kernel.close(); }
}

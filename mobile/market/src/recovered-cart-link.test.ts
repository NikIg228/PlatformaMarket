import { recoveredCartTarget } from "./recovered-cart-link";
import { cartId, failedCartId, savedCart } from "./test-fixtures/carts";

it("uses the supplied relationship without deriving a new cart ID or changing the source", () => {
  const source = savedCart(failedCartId, 8, true);
  source.recoveredCartId = cartId;
  const before = JSON.stringify(source);
  expect(recoveredCartTarget(source)).toBe(cartId);
  expect(JSON.stringify(source)).toBe(before);
});

it.each(["missing", "null", "self", "active", "no-checkout", "nonfailed", "future"] as const)("has no recovery read target for %s", kind => {
  const source = savedCart(failedCartId, 8, true);
  source.recoveredCartId = cartId;
  if (kind === "missing") delete source.recoveredCartId;
  if (kind === "null") source.recoveredCartId = null;
  if (kind === "self") source.recoveredCartId = failedCartId;
  if (kind === "active") source.status = "ACTIVE";
  if (kind === "no-checkout") source.checkout = null;
  if (kind === "nonfailed") source.checkout!.status = "COMPLETED";
  if (kind === "future") source.status = "FUTURE_STATE";
  expect(recoveredCartTarget(source)).toBeNull();
});

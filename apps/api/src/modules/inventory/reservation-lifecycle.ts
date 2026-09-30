export const expirableOrderStatuses = ["AWAITING_CONFIRMATION", "PARTIALLY_CONFIRMED", "CONFIRMED", "AWAITING_PAYMENT", "CANCELLED", "REJECTED"] as const;
type Reservation = { status: string; expiresAt: Date; externalReservation?: unknown };
type OrderHolds = { status: string; paymentStatus: string; paymentAllocation?: unknown; transferClaims: unknown[];
  items: Array<{ reservation: Reservation | null }>; shipments?: unknown[] };

export function orderReservationState(order: OrderHolds, now = new Date()) {
  const reservations = order.items.flatMap(item => item.reservation ? [item.reservation] : []);
  const active = reservations.filter(reservation => reservation.status === "ACTIVE");
  const deadline = active.length ? new Date(Math.min(...active.map(reservation => reservation.expiresAt.getTime()))) : null;
  if (order.paymentStatus !== "UNPAID" || reservations.some(reservation => reservation.status === "CONSUMED")) return { status: "SETTLED" as const, expiresAt: null };
  if (order.transferClaims.length) return { status: "HELD_TRANSFER" as const, expiresAt: null };
  if (order.paymentAllocation || active.some(reservation => reservation.externalReservation)) return { status: "HELD_EXTERNAL" as const, expiresAt: null };
  if (reservations.some(reservation => reservation.status === "EXPIRED")) return { status: "EXPIRED" as const, expiresAt: null };
  if (!active.length) return { status: "NONE" as const, expiresAt: null };
  return { status: deadline! <= now ? "DUE" as const : "ACTIVE" as const, expiresAt: deadline!.toISOString() };
}

export function orderCanExpire(order: OrderHolds, now: Date) {
  return expirableOrderStatuses.some(status => status === order.status) && !order.shipments?.length && orderReservationState(order, now).status === "DUE";
}

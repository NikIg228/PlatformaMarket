import type { PaymentSummary, SupplierPaymentPolicyFields } from "@marketplace/schemas";

type Money = { toString(): string };
type Claim = { status: string; amountMinor: Money; receivedAmountMinor?: Money | null };
export const maxMinorAmount = BigInt("99999999999999999999");

export function manualPaymentSummary(total: Money, claims: readonly Claim[]): PaymentSummary {
  const expected = BigInt(total.toString());
  const confirmed = claims.filter(claim => claim.status === "CONFIRMED")
    .reduce((sum, claim) => sum + BigInt((claim.receivedAmountMinor ?? claim.amountMinor).toString()), BigInt(0));
  const remaining = expected > confirmed ? expected - confirmed : BigInt(0);
  const overpaid = confirmed > expected ? confirmed - expected : BigInt(0);
  return {
    confirmedAmountMinor: confirmed.toString(), remainingAmountMinor: remaining.toString(), overpaidAmountMinor: overpaid.toString(),
    status: claims.some(claim => claim.status === "DISPUTED") ? "DISPUTED" : overpaid > 0 ? "OVERPAID"
      : remaining === BigInt(0) ? "PAID" : confirmed > 0 ? "PARTIALLY_RECEIVED" : claims.length ? "PENDING" : "UNREPORTED",
  };
}

// Count real elapsed minutes falling inside local working windows. The threshold
// cap avoids scanning a long outage once the final escalation is already due.
export function workingMinutesElapsed(start: Date, end: Date, policy: SupplierPaymentPolicyFields, cap = 60) {
  if (end <= start) return 0;
  const format = new Intl.DateTimeFormat("en-GB", { timeZone: policy.timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const weekdays: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  let elapsed = 0;
  for (let cursor = start.getTime(); cursor < end.getTime() && elapsed < cap;) {
    const next = Math.min(end.getTime(), Math.floor(cursor / 60_000) * 60_000 + 60_000);
    const parts = Object.fromEntries(format.formatToParts(new Date(cursor)).map(part => [part.type, part.value]));
    const minute = Number(parts.hour) * 60 + Number(parts.minute);
    if (policy.workingWindows.some(window => window.day === weekdays[parts.weekday!] && minute >= window.fromMinute && minute < window.toMinute))
      elapsed += (next - cursor) / 60_000;
    cursor = next;
  }
  return Math.min(cap, elapsed);
}

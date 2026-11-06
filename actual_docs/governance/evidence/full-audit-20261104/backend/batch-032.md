# Backend audit batch032

Remaining eight inventory files fully read. setBalance preserves reserved count and uses
version CAS inside Serializable transaction; initial offer rejects reassignment and retains
safetyStock. Reserve conditionally decrements balance/lot with atomic reservation/audit/outbox,
P2002 replay verifies quantity/balance and order item. Release locks balance before lot and
avoids restoring quarantined/expired lot availability. Recall uses balance->lot lock ordering,
blocks shipping via shared helper and emits affected reservation IDs.

createLot72–75 aggregates quantities before transaction with no balance lock; concurrent
lot creations may exceed warehouse onHand. Candidate only, not probed. releaseReservation
has no own tenant assertion, currently internal service callers require trace (not HTTP exposed).

B-CAND021 follow-up: expiry scheduler checks30s; includes AWAITING_CONFIRMATION,
PARTIALLY_CONFIRMED and CONFIRMED. No SLA-aware extension here. Orders with any transfer
claim, payment allocation, external reservation or shipment never expire locally. Deadline
comes from reservation.ttlMinutes. Confirm commerce/service renewal before final finding.
Expiry retry handles transaction/deadlock on next tick; other errors abort batch and can
starve later rows. Lifecycle tests cover boundary, transfer/external/paid/shipment holds.
No tests executed.

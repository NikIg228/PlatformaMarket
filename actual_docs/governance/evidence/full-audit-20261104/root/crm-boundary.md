# CRM boundary review — 2026-11-04

Read-only contract review, not an audit or acceptance of the CRM application.
CRM observed HEAD: `d27044b1f923fff6a4a02d4834b4731dc8eabce5`.
Market observed HEAD: `af7149699aac16c0127df6852b231fb66f00b08b`.
No CRM files, data, services or schedules changed; no messages to its audit chat.

Market PROJECT_OVERVIEW lines 123–130 and functional map retain optional,
tenant-verified exchange of orders, statuses, documents and payment/refund facts.
Imported facts must not create duplicate income, execute signatures or refunds;
the Market financial panel stays in Market. This is a requirement, not a transport.

CRM `docs/current/integrations.md:303–339` explicitly records the owner's
02 November exclusion of CRM-D02 exchange and CRM-C21 campaigns from the current
CRM pilot. Both remain future work requiring separate resumption. This is a
delivery dependency for Market, not proof of an implemented cross-product flow
and not authorization to resume CRM work during this audit.

The same CRM section requires verified legal-entity/Business linkage,
object/direction/source/purpose/version/actor/idempotency/correlation, revocation,
replay and reconciliation without synchronization loops. Signed originals stay
in Market; delegated CRM document access needs protected reauthorization.
Proposed event fields are explicitly not an agreed endpoint.

Bounded source searches of Market apps/packages and CRM apps/frontend found no
named PlatformaMarket exchange implementation. CRM providerCatalog.ts (full file
read) lists website, messaging, file, ERP and marketplace providers but no Market
connector. CRM public_api.py (full file read) authenticates scoped API tokens tied
to Business; this generic capability does not establish entity linkage, signed
document delegation or financial-event deduplication. Search absence alone is not
proof that no possible custom integration exists.

Acceptance remains NOT_RUN: both directions, roles/foreign tenants, revocation,
duplicate and out-of-order events, outage/recovery, version negotiation and
document/payment provenance. No cross-product requests or campaign deliveries
were attempted. Requirements are retained; no implementation backlog was started.

Source hashes and exact reviewed ranges are in crm-inputs.json. Other CRM source
files found by search were not exhaustively read and carry no coverage claim.

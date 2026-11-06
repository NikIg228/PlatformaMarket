# Backend audit batch041

Seven exception test/service and operator order files fully read. Recommendation locks order,
replays actor-bound discrepancy event, compares order/shipment/discrepancy versions, increments
only discrepancy revision and atomically emits public recommendation/audit/outbox. Does not
change payment/receipt/party resolution. Tests source includes rollback and parallel replay,
not executed. Order list uses RepeatableRead same filters/count, exact decimal strings.
Detail delegates existing workflow and disables writes; checks document/support permissions.

Potential projection inconsistency: exception-specific get sanitizes event details, while
OperatorOrdersService.detail returns raw non-CREATE/SAVE event.details (line58), even when
canViewDocuments false. Need schema/event details content trace before privacy finding;
submitted discrepancy events may hold document snapshot, attachments, tax. No confirmed issue.

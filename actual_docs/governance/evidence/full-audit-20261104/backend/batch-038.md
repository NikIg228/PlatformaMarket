# Backend audit batch038

Seven operation queue/workflow files fully read. Unified SQL union emits one row/source PK,
parameterizes query, joins assignments by operator org/type/entity, returns page/count from
same snapshot. Operator capability+active permission before query; promotion only go_live.
Assignment uses shared workflow command receipt, expected-version CAS/createMany skipDuplicate,
active assignee permission and audit. Object view exposes selected fields and action permission
separately (imports process only MAPPED, rollback completed states; reconciliation resolved guard).
Tests cover denied source lookup, filters, cursor/count, context payload secrecy and stale writes.
No confirmed new issue. Shared workflowCommand implementation not yet read (support later).

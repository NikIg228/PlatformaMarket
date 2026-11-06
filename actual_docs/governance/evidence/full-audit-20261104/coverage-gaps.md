# Remaining dynamic coverage gaps

Source accounting is complete:4371 main entries by explicit review depth and891 native own text files. Process/route runtime coverage remains partial. File ledgers and coverage-progress.json are authoritative; successful selected tests do not certify every route or process.

1. Deep Security plugin blocked before start. Exact MCP error:
   `Deep Scan cannot safely start a read-only worker: the parent must provide a managed filesystem permission profile.`
   No retry/replacement scan, permission-profile edits or completion call. Manual
   source/security/dependency checks continue independently under owner scope.
2. Old standard scan e1f14291-11be-4753-a972-52b58f43988e belongs to4543fd22;
   no sealed report/current coverage. Not current acceptance.
3. Prior dynamic MFA probe was rejected by automatic safety review. No alternate
   tool used to bypass this. Static review remains possible; replay dynamic unproven.
4. Restore/load prior dedicated DB role lacks CREATEDB. No grant/new cluster/working
   DB clone authorized; inspect available environment before any changed-premise run.
5. Linux/native/real device/live provider infrastructure not yet established.
   Source inventory and static review are independent and must finish regardless.
6. Wave1 immutable-ledger profile requires a separately owned disposable PostgreSQL
   cluster on a non5432 port and its verified data_directory. Attempt1 selected the
   ordinary test DB and failed reading data_directory (42501) before its domain
   cases; the profile's distinct-cluster prerequisite also remains unmet. Common
   fixtures were cleaned and owned API stopped. No grant, bypass or new cluster.
7. Canonical full build and production-browser checks await the pending owner
   choice about temporary dev stop/restore. Current API dist was independently
   proven equivalent to full-program emission for545files, enabling isolated PG
   diagnostics without stopping dev. This is not a canonical build PASS.

See audit-report.md, process-verification.md and root/route-execution-matrix.json for the merged results and limits. Extra B037/B046/028 diagnostics were blocked by automatic cybersecurity-risk review before a result; no bypass or retry.

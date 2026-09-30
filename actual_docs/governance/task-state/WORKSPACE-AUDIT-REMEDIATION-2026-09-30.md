# Аудит кабинетов клиники и поставщика и план исправлений

## Актуальный итог исполнения — 30.09.2026

**A01–A18: LOCAL_PASS для canonical `apps/web` и локального API/worker.**
Единственный исполнитель — primary `01a0c957-1f23-7b70-9dc9-226afbb5c0b1`.
Ниже сохранены исходный аудит и последовательность попыток; их OPEN/ACTIVE и
docs-only формулировки исторические и не отменяют этот итог.

| Пункты | Проверенный результат |
| --- | --- |
| A01–A02 | Согласованная цена при checkout/reprice; повторная проверка пригодности партии и конкурирующего recall в транзакции |
| A03–A04 | Ошибки действий не стираются фоновым чтением; выбор склада и отгрузка проверены через живой API |
| A05–A06, A17 | Атомарное изменение предложения, независимые складские черновики, конфликт версии и повтор команды после потери ответа |
| A07–A09 | Возвращены маршруты заявок/исправлений/партий/источников; обновление сохраняет ввод; действия учитывают разрешения и отзыв доступа |
| A10, A16 | Освобождение просроченных незащищённых резервов и отдельная восстанавливаемая корзина после компенсации checkout |
| A11–A12 | Календарные границы документов Asia/Almaty; ограниченные tenant-scoped страницы, стабильные курсоры и компактная сводка |
| A13–A15 | Цена за единицу, упаковка, резерв и свежесть; клавиатурное меню; единый лимит PDF 10 000 000 декодированных байт |
| A18 | Исправлена загрузка Fluent/Tabster в Vitest без no-op mock; полный unit gate и live API/UI/PG evidence получены |

Финальная проверка A13–A15: WEB1 24/25 PASS, обнаружена отсутствующая связь
подписи с native file input. Исправлена через React useId и htmlFor в label slot.
Build2 FAIL на ошибочном размещении htmlFor, build3 PASS (4 задачи, 53.3с).
Focused WEB2 PASS1/1 (17.3с); предыдущие24 сценария сохранены как REUSED_PASS.
Проверены max-1/max/max+1, пустой файл, поддельное PDF-содержимое, повтор upload
и workflow с прежним idempotency key. Desktop1440/mobile390 снимки A13 просмотрены;
широкая таблица на мобильном прокручивается внутри блока.

Последние команды и результаты:

- `npm run typecheck` — PASS13/13 (58.8с).
- `npm exec -- turbo run test --concurrency=1` — тот же полный unit graph,
  PASS12/12 (1м26с), последовательность устраняет конкуренцию тяжёлых suites.
- `npm exec -- turbo run build --filter=@marketplace/web` — PASS; API build PASS
  ранее в этом же A13–A15, его входы после этого не менялись.
- `npm run db:test -- exec --workspace=@marketplace/e2e -- playwright test --config playwright.workspace-volume.config.ts`
  — PASS1/1 (18.3с), после изменения представления строк A13.
- `npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only`
  — PASS:114 схем,38 проверенных core operations, response/error validation.
- Последние PG и runtime-split из A12 — PASS; A13/A14 не меняют эти входы,
  A15 сохраняет серверный предел и отдельно проверяет его unit/contract тестами.
- `git diff --check` — PASS; index пуст, чужой WIP сохранён.

Повторная synthetic выборка1000: offers68 425Б/p95 26мс, orders22 025Б/p95
22мс supplier и15мс buyer, current cart318Б/23мс, summary49Б/15мс.
Рендер49–160мс. Все исходные бюджеты (1MiB/750мс/1500мс) соблюдены;
до оптимизации payload составлял3.1–7.7MB. Доступность полного набора,
фильтры, курсоры, tenant/permission отказы и сохранность черновика проверены.
Логи `outputs/workspace-audit-a13-*`, `workspace-audit-a15-*`,
`workspace-audit-a13-15-*`; финальные хэши `workspace-audit-a13-15-verified-inputs.json`.
Предшествующие evidence и попытки каждого пункта сохранены ниже.

Применены прочитанные Agency Backend Architect, Frontend Developer, UX Architect
и Code Reviewer, repository UI standard и ранее fix-finding: транзакционные
инварианты, доступность/async state, минимальный scope и регрессии. Делегирования нет.

Ограничения: отдельный legacy buyer build превышает bundle budget
(25 файлов/1 732 101 raw/481 473 gzip против24/1 500 000/450 000).
Это не принято и не исправлялось расширением scope; canonical build PASS.
Не заявляется готовность всех отложенных правил оплаты, release/production или
внешних интеграций. Production/release suites и CI NOT_RUN: локальный scope,
публикация отложена. Новых commit/push нет; `main@646dab585eda96bb21c994b92c611fbf13e56179`
плюс локальный WIP. Рабочий каталог не reseed; отдельно согласованная обработка
30 просроченных заказов описана в A10. Финальное восстановление dev проверяется
в заключительной записи ниже. Следующую фазу автоматически не начинать.

Дата: 30.09.2026. Задача: WORKSPACE-AUDIT-REMEDIATION-2026-09-30.
Владелец документа: текущая side conversation, по явному поручению пользователя
подробно задокументировать результаты аудита перед исправлением логики.

Документ предназначен владельцу продукта и исполнителю исправлений. Он содержит
выявленные нарушения, причины, безопасный порядок ремонта и проверяемые критерии
готовности. Главный вывод: основные сценарии существуют, но два нарушения
серверных инвариантов и несколько ошибок состояния интерфейса не позволяют
считать сквозной сценарий закупки принятым.

## Граница документа и статус

### Исполнение по поручению владельца 30.09.2026

A08 ACTIVE brief: focus/online refresh for workspace resources, visible-only
30s polling for orders/dashboard, 60s cart validation; other lists on events/manual.
Keep successful data and separate background failure/loading from initial load;
deduplicate same loader, invalidate late responses after identity/unmount change.
Preserve filters/editor drafts/action errors. Documents retain pagination until
explicit refresh; focus reloads the first page with applied filters. G0/build/WEB
with synthetic tenants, no working data writes. Max3 attempts per gate, existing
budgets; Agency Frontend Developer/Code Reviewer applied for state/race/access review.

A08 progress: resources retain data on background errors and expose lastSuccessAt,
initialLoading/refreshing/offline/stale; focus/online dedup; orders/dashboard30s.
Product URL selection initializes once per selection, preserves draft on refresh.
Documents focus/online keeps applied filters and action errors; archive keeps rows.
Cart reuses existing60s scheduler, adds online and offline skip, preserves action
errors on background reload. Order detail5s reuses pending read and adds online.
Clinic profile auto-refresh deliberately disabled: updating expectedVersion under
an existing editable draft would defeat conflict protection. User saves explicitly.
WEB focused1 PASS2/2, final matrix1 PASS14/14 (1.7m) incl old-page response/draft.
Typecheck initial1 PASS13/13; final1 PASS13/13. Unit1 command orchestration FAIL
(duplicate turbo concurrency option, no tests ran); unit2 serial PASS12/12.
Later workflow/UI edits need final unit validation. Build1 RUNNING; own verified
dev launcher23448 stopped for build, restore canonical npm run dev afterwards.
No API/data changes; no CONTRACT/PG. No commit/push per existing restriction.

A08 final gates PASS: final unit1 12/12, build1 PASS, diff check PASS.
Source hashes: outputs/workspace-audit-a08-verified-inputs.json. A08 LOCAL_PASS;
canonical dev restart session64186 in progress, API building. Existing server
tenant checks unchanged; provider keyed role/org/session and late-page browser
test protects response ownership. No publication.

A09 brief: explicit scoped development fixture permission sets for new accounts;
existing accounts unchanged. Unified workspace reads current permissions once
per session and on focus; supplier price/import/publication/compliance/warehouse/
delivery and document/order actions respect capabilities, server guards retained.
Revocation disables commands while retaining drafts; actual403 still recoverable.
Shared components preserve legacy callers outside unified permission provider.
G0/build/WEB and disposable PG fixture guard matrix (minimal/full/foreign/revoked).
No working-account reconciliation, reseed, auth contract/schema migration or
external activation. Agency Frontend Developer/Code Reviewer, same max3 budgets.

A09 implementation: one permission provider per unified tenant/session; forms
remain mounted on revoked permissions. Native forms use disabled fields, portal
dialogs also check/disable their own submit buttons. Price+stock requires both
pricing.manage/inventory.adjust; publication catalog.offer.publish; imports
import.manage; credentials compliance.credential.manage; warehouse
supplier.warehouse.manage; delivery delivery.manage (read delivery.view).
Invoice/payment/order commands use the existing action-specific server mapping;
upload document.upload, accounting document.accounting.review, terms document.sign.
Minimal employee gets only explicitly assigned read capabilities. New local demo
profiles use scripts/lib/local-development-permissions.mjs; no external connector,
merchant or role administration grants. Existing users/roles are not reconciled:
creation aborts if a reused role differs, rather than changing existing members.
Onboarding-owner role remains unchanged. No preparation command ran on working DB.
A09 typecheck1 PASS13/13, WEB1 focused PASS2/2 minimal/revocation/403 retained draft.
Full browser regression1 and PG1 active. A08 dev restored: own launcher26460,
session64186, canonical JWT/go_live/marketplace; readiness API/frontend PASS.

A09 verification update: full WEB1 14/16PASS; two A08 offline tests had strict
locator ambiguity because permission status repeated the resource message.
Permission-specific text now distinguishes access freshness; focused WEB2 PASS2/2,
other14 unchanged PASS retained. New portal upload revocation test pending.
PG1 readiness timeout60s before assertions (no API output); hypothesis concurrent
dev/browser pressure. Stopped only verified own26460; serial PG2 PASS including
full/minimal/read-write/foreign/revoked permission matrix and all existing PG
checks. Same API timeout and assertions. PG used already built unchanged API/
schemas prerequisites via db:test exec underlying script. Full role guard probes
use invalid bodies (400 after authorization); minimal403, foreign403, revoked403.
No business writes beyond disposable setup. Typecheck final1 PASS13/13; unit1 active.
Dev currently stopped; restore after production build and remaining checks.

A09 final acceptance: portal/recovery WEB1 PASS3/3 (11.1s), including selected
file + title retained after revoked upload permission in Fluent portal, and
explicit permission-read503 retry without losing proposal input/action error.
Added that retry action after review; final typecheck2 PASS13/13 and unit2
PASS12/12 (6.8s,11 cached) cover it. First unit/build also passed; build2 finalizing.
Final source hashes outputs/workspace-audit-a09-verified-inputs.json.
Own restarted dev11268 was stopped for final build; all fixture/test processes
finished. Restore canonical dev after build. No working account grants changed.
A09 LOCAL_PASS: final build2 exit0, diff check PASS; canonical dev restart begun.

A11 brief: document filter calendar zone is the existing supplier/business zone
Asia/Almaty, explicitly labelled in unified archive. Convert each calendar
midnight through Intl timezone rules; inclusive API upper bound is next local
day start minus1ms, no API semantic change. Empty bounds supported; invalid/reversed
range stays in form with feedback and cannot replace the applied filter. Date
display in this archive uses the same zone. G0/build/WEB + pure boundary tests
(day/month/year/historical offset, host-zone independence). Same scoped budgets.
A11 progress: shared pure date boundary helper implemented; timezone-labelled
unified archive applies the same zone to displayed document/signature dates.
Unit focused1 PASS7/7; WEB1 PASS2/2 (6.7s)1440/390 in UTC browser, inclusive first/
last millisecond, adjacent days excluded, reversed range feedback and reset.
Canonical own dev15436 stopped for G0/build; sequential checks active, no API/
contract change, no PG required. Source draft/action errors remain independent.
A11 LOCAL_PASS: typecheck1 PASS13/13; full serial unit1 PASS12/12 (1m27s),
production build1 PASS; diff check PASS. Hashes outputs/workspace-audit-a11-verified-inputs.json.
Dev remains stopped for the next disposable production-server measurement.

A12 measurement brief (before measuring): owned synthetic tenant with1000 offers,
1000 historical one-line orders/carts and one active cart; no working data or new
database. Budgets per list: response<=1MiB, warm sequential API p95<=750ms
(existing load-profile read budget), response-to-table render<=1500ms; record
HTTP request count and ORM query count separately. One warmup +5 reads per route,
production web/isolated pilot API,1440px; report cold observation separately.
Measure offers, buyer/supplier orders, cart history and dashboard. Measurement
may confirm a defect; do not claim acceptance merely because harness succeeds.
If confirmed, implement bounded typed reads/cursors and appropriate aggregates,
then G0/CONTRACT/PG/RUNTIME/build/WEB. Preserve legacy clients and complete access
to filtered results; no silent truncation. Same max3/time budgets and cleanup.

A12 measurement1 failed: browser observer matched direct4012 instead of same-origin
/api proxy; no application failure. Timeout also closed page before cleanup;
removed exact owned fixture user/org/product with identity-guarded cleanup.
Measurement2 PASS harness22.1s, confirmed payload budget breach: offers3,797,781B,
supplier orders3,906,671B,buyer orders3,876,671B,carts3,133,972B; dashboard7,704,673B.
Warm APIp95 respectively316/285/293/622ms; ORM11/13/14/10; render659/523/1096/353ms,
dashboard428ms. Evidence outputs/workspace-audit-a12-before.json. Only payload
breached; no unsupported latency incident claim.
A12 implementation ACTIVE: typed workspace reads (current session tenant only),
50/max100 cursor pages, createdAt/id ordering plus traversal cutoff and scoped
filter digest; compact orders/offers, direct offer/cart reads, separate summary
counts. Legacy endpoints retained. UI server search + page navigation; current
cart separate from failed checkout pages. No migration/index justified yet.
Typecheck1 PASS13/13 before final harness updates. Unit1 FAIL new client mock
reused consumed Response object; mock now creates response per call, unit2 active.
G0/build/CONTRACT/PG/RUNTIME/WEB and after-measurement still pending.
Canonical dev remains stopped; restore after required checks. No commit/push.
A12 update: unit2 PASS12/12 (2m7s). API build PASS. Optional legacy buyer build
compiled successfully but its homepage bundle gate FAIL1:25files/1,732,101 raw/
481,473gzip versus24/1,500,000/450,000. No baseline attribution or budget change.
ADR015 says source adapters in old apps do not require four frontend artifacts;
canonical build is apps/web. Legacy fallback performance is NOT accepted; keep
this separate limitation for any requested fallback/release work, no broad cleanup.
Canonical web build1 PASS50.3s, includes cart draft retention on history pagination
and direct-offer identity guard. WEB1 running22 tests with owned disposable API/
production web; includes existing checkout1440/390, regression matrix and post-
optimization volume/cursor/foreign-tenant/permission/filter/draft tests.
Agency Backend Architect/Frontend Developer/Code Reviewer checklists applied to
API compatibility, bounded queries, tenant predicates and async draft ownership.
A12 WEB1:21/22PASS; volume observer stopped on real workspace-context429 after
login-heavy preceding tests. No rate/auth overrides. Focused WEB2 measured all
budgets PASS and passed API traversal/filter/foreign/permission assertions;
failed only textContent versus innerText oracle on previous-page equality.
UseInnerText fixes that oracle; WEB3 focused PASS16.6s, same120s timeout.
Final offers68,425B/APIp95 86ms/11ORM; supplier orders22,025B/62ms/4ORM;
buyer orders22,025B/28ms/4ORM; current cart318B/45ms/6ORM; summary49B/29ms/7ORM
(includes transaction statements). Render259/188/115/119/81ms. Dashboard browser
3HTTP/270B including context+permissions. Budgets unchanged; all PASS.
Proven: full1000 traversal, timestamp ties, deleted cursor anchor/newer insert,
status/search, malformed/foreign cursor, foreign offer404, revoked permission403,
60failed-cart pagination/recovered marker,1440/390 back/search navigation,
current quantity draft survives recovery-page navigation. Fixtures cleaned.
Split volume and workspace-acceptance configs preserve real auth rate limits;
retain21 regression passes (identical code/config other than test selection).
PG1 and CONTRACT1 PASS using unchanged built API/schemas via db:test exec scripts;
RUNTIME/final G0 still in progress. No blind rebuilds of accepted API artifacts.
A12 LOCAL_PASS for canonical unified runtime: final typecheck1 PASS13/13,
final unit1 PASS12/12, RUNTIME1 PASS; PG/CONTRACT and canonical build PASS.
Hashes outputs/workspace-audit-a12-verified-inputs.json. Legacy bundle limitation
above is retained, not a claim that all deployment variants pass. No publication.
A13–A15 brief: finish existing read-information (price freshness/source, sale unit,
pack size/minimum/increment, available/reserved), verify then fix nonmodal mobile
menu focus/Escape, share unchanged10,000,000-byte document upload limit across
API/archive/order form. No redesign or new business eligibility logic, no working
DB changes. G0/API+canonical build/WEB; A15 file boundary/magic/retry tests and
CONTRACT for shared upload boundary. A14 reproduction before production edits.
Same max3 attempts/budgets. Frontend Developer/Code Reviewer applied.
A13–A15 progress: A14 repro1 confirmed immediate Enter→Escape leaves aria-expanded
true. Root Escape plus first-navigation focus/return and760px resize handling
implemented for existing nonmodal navigation. A13 typed fields now show exact
money per sale unit, packaging/minimum/step, available/reserved with unit, source,
confirmation timestamps and expired/unknown confirmation; no canSell calculation.
A15 shared DOCUMENT_UPLOAD_MAX_BYTES=10,000,000 used by API decode/quarantine,
archive validation and workflow form; exact label, empty/extension validation.
Server content/MIME/quarantine/scanner unchanged. Typecheck1 PASS13/13; unit1
PASS12/12, including actual decoded max-1/max/max+1 and fake-PDF rejection before
storage. API/canonical build1 active. New browser fixtures cover prices/packaging
1440/390, menu keyboard/selection/resize, decoded upload boundaries and document/
workflow retry identity. No working DB changes or publication.
A07 brief: restore focused supplier routes under products (proposal history/
details/retry, corrections, inventory/lot/reserve visibility) and settings
(existing sources). Reuse current APIs and feature components, retain canonical
commercial editor for stock/publication; do not revive stale balance write or
activate external connectors. New route reads/actions check existing permissions;
server remains authoritative. G0+WEB1440/390 incl direct/back/error/limited role,
synthetic tenant fixtures only; no working account permission changes. Same
max3 attempts and budgets. Agency Frontend Developer/Code Reviewer and UI standard.
Function map: ProductProposals→/supplier/products/proposals (catalog.offer.edit);
ProductCorrectionsPanel→/supplier/products/corrections (catalog.product.view,
catalog.offer.edit for write); SupplierInventory data→/supplier/products/inventory
(inventory.view; safe commercial edit uses existing products route); publication
→existing commercial editor (catalog.offer.publish); supplier data sources
→/supplier/settings/sources (import.manage). External activation stays excluded.

A07 progress: focused routes and permission boundary implemented; old components
reused, rejection details/retry preserves old history, inventory route links to
safe editor and shows lots/reserves/overrides; freshness recompute preserved,
sources link to existing import. WEB1 exact-text locator failed because adjacent
retry button is inside same table cell; corrected semantic locator. WEB2 PASS3/3
(14.9s,1440/390), mobile screenshot reviewed. Existing regression1:7/8PASS;
unmounting the open confirmation modal hid background from accessibility tree.
Regression2 FAIL after focus-only repair. Corrected lifecycle: unified route keeps
OrderConfirmationPanel mounted, only availability of trigger changes; Fluent
closes modal normally and restores focus to surviving order container.
Regression3 PASS1/1 (2.6s); previous7PASS reused. Final typecheck PASS13/13,
final serial unit PASS12/12; git diff --check PASS. A07 LOCAL_PASS. No API/schema/working data
changes in A07, CONTRACT/PG not required. No publish per unified WIP constraint.

A10 latest checkpoint: unit2 PASS12/12 (API427), final typecheck2 PASS13/13.
A10 LOCAL_PASS: CONTRACT1 PASS, RUNTIME2 PASS, web build PASS;
WEB1 PASS2/2 (55.2s)1440/390, expiry mobile screenshot visually reviewed.
git diff --check PASS. Canonical npm run dev restored (launcher23448,
go_live/all, JWT, marketplace DB, frontend3000/API4012). Approved worker receipt:
30 order expiry audits,30 CANCELLED/UNPAID orders,30 EXPIRED reservations;
0 remaining unprotected overdue reservations. Worker processed25+5 across ticks.
No schema migration/reseed; scoped source hashes outputs/workspace-audit-a10-verified-inputs.json.
Read-only working DB inspection found30 expired unpaid orders without claims,
allocation, shipment or external reserve; standalone0. Owner explicitly approved
processing those overdue orders on dev restoration (30.09 async reply).
PG1 FAIL in synthetic role setup (mixed scalar roleId + nested permission);
fixed fixture to use role.connect, PG2 PASS full matrix. Runtime1 unavailable
because contract build temporarily removed dist; retry after build completion.
CONTRACT/WEB active, dev still stopped. No application failure inferred from
fixture/build orchestration failures.

A10 brief ACTIVE: use existing scheduled worker/runtime, batch25 each30s,
order lock→sorted balance locks→reread→single transaction release/cancel/audit/
outbox. Exact deadline expiresAt<=now. States: unpaid/no transfer/no payment
allocation/no external reserve => expiry allowed; PENDING/NEEDS_INFORMATION
transfer => held until explicit resolution; PAID/CONSUMED => no expiry; external
reserve or payment allocation => owned by that lifecycle, skip automatic release;
standalone local active reserve => expiry; recalled lot => release reserved but
never restore available. Cancelled/rejected unpaid leftovers may be released.
Do not modify checkout compensation or enable external integrations/reminders.
Expiry and manual report/confirm/cancel share order lock; late first transfer
report cannot revive an expired reserve. G0/PG/RUNTIME/CONTRACT/WEB; same fixture
DB and budgets, attempts0 for new gates. Before restoring dev inspect potential
working-data effect of the newly introduced scheduler, no blanket cancellation.
A10 typecheck1 PASS13/13. Unit1 FAIL: existing document-renderer multilingual
PDF test exceeded5s (6319ms) while Vitest ran many API files in parallel;
remaining426 API assertions passed. Retry2 will constrain Vitest maxWorkers=1
as well as turbo concurrency1; same full tests/assertions/timeout, no skip.
Subsequent code adds explicit expiry audit and internal supplier-scoped batch
argument for isolated PG fixtures (scheduler still covers its configured DB).
PG matrix prepared; PG0/WEB0/RUNTIME0/CONTRACT0. Dev remains stopped.
A10 implementation checkpoint: ReservationExpiryService registered in inventory,
existing queue/30s Cron (API role has no scheduler). Serializable order→balance
locks, real release helper accepts null system actor, EXPIRED status/audit/outbox,
bounded batch with optional internal supplier filter for isolated verification.
Workflow response adds reservationState; UI explains deadline/transfer/external
hold/expiry. First late transfer/invoice/composition and late supplier confirmation
cannot revive an expired reserve. PG helper prepared with boundary, parallel
worker, pending/clarification, confirm/cancel, recall, crash rollback and retry,
external/standalone cases. Browser helper will invoke real compiled expiry on
own recovered checkout; existing pending transfer fixture now has old expiresAt.
Unit2 ACTIVE (API passed, buyer95 passed); all tests run with maxWorkers1.
Final typecheck needed for later helper/audit/supplier-confirm inputs. No A10
PG/build/contract/runtime/browser execution yet. Do not begin next phase until
these pass. Prior A16 local acceptance remains recorded above.

Продолжение30.09: владелец явно поручил оставшиеся A16→A10, A07–A09,
A11–A15, A18. Primary/checkout unchanged main646dab5, existing WIP preserved.
A16 ACTIVE brief: source failed checkout remains immutable; separate recovered
cart with deterministic UUIDv5 per source is permanent idempotency identity,
no expiring recovery token or schema migration. Tenant/profile/order.create
checks precede data access; unresolved local/external holds block recovery.
Copy every line including unavailable offers with historical comparison values;
normal validation/explicit changed-terms consent precedes new checkout. Existing
nonempty active cart is preserved; empty active cart can be retired atomically.
G0/CONTRACT/PG/WEB, same isolated audit DB, synthetic fixtures + cleanup;
max3 per gate, diagnostic15min/command20min/full45min. Dev2028 currently running,
stop only verified owned tree before builds; restore after checks. Agency Backend
Architect/Frontend Developer/Code Reviewer and UI standard remain applicable.

Текущий итог первой части (30.09): A01–A06 и A17 — LOCAL_PASS;
A16 progress: typecheck1 PASS13/13, serial unit1 PASS12/12 (API416),
PG1 PASS including real partial reserve failure/compensation, stale/tenant/live
hold guards, current-cart preservation, concurrent recovery replay, unavailable
row + price consent and subsequent checkout. E2E typecheck PASS. No migration;
source→target UUIDv5 retained by target cart PK, audit/outbox once. Contract/web
pending; source/input hashes to update after final checks. Dev2028 stopped after
verified ancestry for build/tests; restore canonical dev when checks conclude.
A16 LOCAL_PASS: CONTRACT1 PASS (107 schemas,38 required core operations),
web build PASS, WEB1 PASS2/2 (52.4s),1440/390. Real recovery endpoint commits then
response is dropped, exact repeat returns same cart; unavailable row retained,
reload hides already-recovered source, restored availability + changed price
requires explicit acceptance. Source FAILED history unchanged. Mobile screenshot
outputs/workspace-audit-a16-unavailable-390.png reviewed. No migration/working DB
writes; no commit/push per existing unified WIP publication constraint.
A18 — устранён Vitest blocker, общая приёмка остаётся OPEN. A16 только
проанализирован; A07–A16 ещё не реализованы этим поручением. Полный план
не закрыт. Следующий связный scope: A16 восстановление корзины, затем A10
lifecycle резервов по Product§23.6. Последующие пункты не считать принятыми
на основании тестов первой части. Набор проверенных исходников зафиксирован
в outputs/workspace-audit-verified-inputs.json (SHA256, без секретов).

Новый запрос «сделай анализ и приступай к выполнению» разрешает начать ремонт
по этому плану; прежний docs-only scope ниже сохранён как история аудита.
Единственный writer: primary01a0c957-1f23-7b70-9dc9-226afbb5c0b1;
другая задача PlatformaMarket UI при preflight idle. Canonical main646dab5,
существующий tracked/untracked WIP сохранён, новых worktrees нет.

Первый prerequisite A18: исправить загрузку реальных Fluent/Tabster модулей
в Vitest без mock, удаления тестов, обновления зависимостей и смены runtime.
Scope: apps/buyer-web/vitest.config.ts и этот checkpoint. Прочитана и применена
Agency Code Reviewer: воспроизводимая причина, минимальный diff, regression.
Исходные три неуспешные попытки сохранены. Новая предпосылка: native ESM import
tabster даёт createTabster=undefined, default.createTabster=function; пакет
указывает CJS main и ESM module, Fluent импортирует именованный ESM export.
Исправление: преобразовывать эту цепочку в Vitest через Vite module resolution.
Gates: исходный compact-catalog regression, npm run typecheck, npm test,
git diff --check. Budget диагностики15min/команды20min/общего suite45min;
новые повторы только при обоснованных изменениях, до3, история не обнуляется.
При PASS продолжить A01 с отдельным brief/PG проверкой; при обязательном
BLOCKED остановить затронутую фазу. Рабочая БД и dev не изменяются.
Публикация прежнего общего WIP не разрешается этим исправлением.

A18 prerequisite PASS: focused compact-catalog2/2 (38.63s), typecheck13/13
(12cached), полный npm test12/12 задач (1cached,58.176s), buyer92/92.
Логи outputs/workspace-audit-a18-{focused,typecheck,unit}.log. Новый запуск
после исправления конфигурации —1; старые3 неудачи остаются в истории.
Vite обрабатывает CJS interop; package sourcemap warning остаётся предупреждением,
не runtime failure. git diff --check PASS. A18 целиком остаётся OPEN: реальный
purchase flow проверяется вместе с A01/A02. Dev/рабочая БД не изменялись.

A01 анализ ACTIVE: подтверждены два чтения commercial state (validateCart,
затем resolveOffer) вне транзакции записи checkout. Цена из второго чтения
записывается без сравнения с принятым cart snapshot. Отдельный анализ также
нашёл, что snapshot пока не включает НДС/упаковку; compare проверяет только
price/currency/minimum/increment. Требуется согласованный snapshot внутри
Serializable transaction и проверка того же snapshot перед записью строк.
Public error CART_REVALIDATION_REQUIRED и idempotency/tenant сохраняются.
Анализ по fix-finding + Agency Backend Architect/Code Reviewer; отдельных
агентов нет согласно AGENTS.
Brief A01: schemas cart commercial terms (additive response), commerce rules/service,
ближайшие unit regressions, PostgreSQL regression harness и UI отображение diff.
OpenAPI/client используют общий schema/type, проверить контрактным gate.
Транзакция читает commercial snapshot один раз, сравнивает с принятой корзиной,
записывает ровно эти строки; допустима сериализация заказа до конкурентного
изменения цены, недопустима запись новой непринятой цены. Старые cart snapshots
без terms требуют однократного явного reprice. Миграция не требуется.
PG только existing dentmarket_audit_20260914 по localDatabaseProfile, clean
synthetic fixtures, рабочая marketplace не используется. Gates G0/CONTRACT/PG/WEB;
бюджеты Workflow, max3 на gate с фиксированной причиной повтора. ACTIVE.

A01 progress: focused unit14/14 PASS; typecheck1 FAIL только новое поле
saleUnit.name, исправлено на schema nameRu. PG1 PASS: новый deterministic
two-connection race, неизменная принятая цена, VAT/packaging conflict,
idempotency + прежний полный PostgreSQL gate (tenant/rollback/stock/cart race).
Лог outputs/workspace-audit-a01-postgres.log. Preflight current_database и
последние3 migrations подтвердили audit DB. Рабочая marketplace не изменялась.
Dev launcher12648 с подтверждёнными потомками3000/4012 остановлен для сборок;
после проверок восстановить npm run dev на рабочем профиле.

Challenge review обнаружил тот же consent gap в reprice: показанная B могла
стать C при нажатии «Принять». A01 расширен только на этот прямой путь:
optional acceptedItems в существующем запросе, текущий snapshot сравнивается
в Serializable tx перед записью. Без acceptedItems допустим лишь неизменный
commercial snapshot, иначе тот же CART_REVALIDATION_REQUIRED. Оба frontend
caller и verification callers обновлены. OpenAPI берёт schema автоматически,
api-client использует RepriceCartRequest. Следующий PG запуск оправдан этими
изменёнными входами, прежний PASS сохранён, не объявлен финальным.

Последующие gates: typecheck2 PASS13/13; E2E typecheck PASS после live-test.
Unit1 на A01 FAIL: document-renderer Cyrillic PDF превысил5s при одновременном
typecheck; остальные402 API assertions PASS. Unit2 выполнен эквивалентным
`npm exec -- turbo test --concurrency=1` (npm test = тот же turbo test с2):
PASS12/12 задач,4cached,78.956s, таймаут и assertions неизменны. Логи
outputs/workspace-audit-a01-{typecheck-2,e2e-typecheck,unit,unit-serial}.log.
PG2 начат после изменения consent/reprice. WEB будет через verify:web с
playwright.checkout-snapshot.config.ts: реальный JWT/API/PostgreSQL, новый
synthetic buyer/offer,1440/390px, keyboard acceptance, stale reprice→409,
новое согласие→заказ с точной ценой/одним резервом, cleanup только своих fixtures.
Test config запрещает reuse server, требует audit DB; обычный E2E этот opt-in
тест пропускает. User dev временно остановлен, восстановление остаётся обязательным.

A01 LOCAL_PASS: PG2 exit0, CONTRACT exit0 (35 core operations,104 schemas;
underlying verify-pilot-backend --contract-only через db:test, prerequisites
schemas/API build переиспользованы из PG2). Unified web production build PASS.
WEB1 FAIL только strict locator (app alert + Next route announcer), WEB2 PASS2/2
за9.7s после уточнения selector, оба настоящих JWT/API/DB сценария1440/390.
Просмотрен mobile screenshot; цена/НДС/кратность и запрет checkout видны.
Логи outputs/workspace-audit-a01-{postgres-2,contract,web-build,web,web-2}.log;
screenshots workspace-audit-a01-consent-{1440,390}.png. Миграции не менялись.
Публикация остаётся отложенной по UNIFIED-APPLICATION-2026-09-28: изменения
зависят от существующего неопубликованного unified WIP; не включать весь WIP
в коммит автоматически. Local PASS не равен remote/CI/production PASS.
Следующий разрешённый пункт A02: атомарная пригодность партии при consume и shipment.

A02 brief ACTIVE: inventory lot eligibility helper, InventoryService recall/release,
OrderWorkflowService consume/cancel, LogisticsService create/dispatch; sibling
PaymentSettlementService.captureAllocation использует тот же guarded consume.
Никаких новых статусов/PSP/worker/миграций. Минимальная политика из A02: опасный
переход атомарно отклоняется с409, прежняя pending payment claim сохраняется;
реально полученные деньги не объявляются отсутствующими. Recall после полного
расхода должен сохранять запрет отгрузки (DEPLETED не отменяет отзыв).
Порядок блокировок order→отсортированные balances→lots; recall balance→lot.
G0 + PG с reserve→recall/expiry/confirm, конкурентным recall/consume и
recall после оплаты до shipment; WEB для видимой ошибки действия. Existing
audit DB/cleanup, прежние budgets, max3, один primary writer. Без делегирования.

A02 implementation in progress: guarded ACTIVE+expiration consume в manual и
payment settlement; DEPLETED не перетирает recall; balance locks + перечитывание
при recall/cancel/release; recall допускается после полного расхода; shipment
planning/forward-to-dispatch проверяет пригодность под balance/lot locks.
Focused14/14 PASS (8 lot eligibility +6 workflow), typecheck1 PASS13/13,
git diff --check PASS. После этих checks challenge выявил lotless bypass:
все известные партии могли быть отфильтрованы по expiry/recall и ошибочно
считаться отсутствием партионного учёта. Добавлены _count.lots при resolution
и transaction guard против reserve без партии при существующих lots.
Эта последняя правка ещё не проверена. A02 PG/WEB/full unit ещё NOT_RUN.
Следующий шаг: добавить PostgreSQL сценарии reserve→recall→confirm/expiry,
детерминированную гонку recall/consume, paid/depleted recall→shipment rejection,
release/cancel без возврата непродаваемого остатка и lotless regression.
Использовать scripts/verify-postgres-integration.mjs и отдельный lib helper,
реальные сервисы (как scripts/lib/verify-checkout-snapshot.mjs), synthetic fixture.
Не забыть cleanup новых transferClaims/workflowEvents до удаления order.

A02 PG1 FAIL на новой synthetic fixture: отсутствовал обязательный comment
в OrderTransferClaim, до проверки consume. Schema/API build PASS, cleanup без
ошибки. Исправлены fixture fields по Prisma schema (comment, recipientName,
DRAFT→PLANNED→PACKING); production code после build не менялся.
Helper использует реальные services/permissions/DB; barrier commits recall
между первым чтением order и balance lock. PG2 переиспользует build и запускает
тот же integration script через db:test; счётчик сохранён (1/3).

A02 LOCAL_PASS: PG2 exit0 включая реальную гонку recall после чтения ACTIVE,
expiry без status change, rollback payment/claim/reserve, release без возврата
непригодного stock, paid/depleted recall, createShipment/READY→DISPATCHED deny,
replay и lotless bypass. Лог outputs/workspace-audit-a02-postgres-2.log.
Typecheck2 PASS13/13; serial full unit PASS12/12 (26.389s), logs a02-typecheck/unit.
WEB1 FAIL selector: DmFeedback по умолчанию role=status, не alert; исправлен
только locator. WEB2 PASS2/2 (10.9s),1440/390, реальный409 при expiry после
резерва, видимая русская ошибка, pending claim/UNPAID сохранены. Mobile PNG
визуально проверен: outputs/workspace-audit-a02-expiry-390.png. Не считается
проверкой invoice upload: consume fixture имеет synthetic document references.
Публикация/CI отложены как выше. Dev ещё остановлен; восстановить после gates.

A03 brief ACTIVE: packages/ui OrderWorkflowWorkspace state + небольшой helper
для pending command/request lifecycle, regression tests и существующий browser
scenario. Отделить read/action errors; conflict требует актуального GET и
явного повтора после показа условий, неизвестный network outcome сохраняет key.
Смена orderId/organization/unmount не применяет старые ответы. API не меняется,
PG evidence A02 переиспользуется; G0 + production web build + WEB, те же budgets.
Один primary writer, без новых агентов/данных рабочей БД.

A03 LOCAL_PASS: отдельные read/action errors, keyed session для order/org,
sequence guard для старых GET, unmount guard для async writes/uploads;
WorkflowCommandTracker сохраняет точную команду при network/5xx/408 и блокирует
другое действие до разрешения неизвестного исхода. Transactional4xx сбрасывает
команду,409 обновляет видимые данные; повтор — только явный click пользователя.
Применены Agency Frontend Developer/UX Architect: async feedback, устойчивое
состояние формы, keyboard/mobile в существующей Fluent-системе.
Focused5/5; typecheck13/13; serial unit12/12 (61.41s); pilot web build PASS;
final E2E typecheck PASS; WEB1 PASS2/2 (1440/390). Browser доказал409→GET→новая
версия при повторе, сохранность action error после focus и fake-clock polling,
потерю ответа ПОСЛЕ реального commit→GET→replay с тем же key/version и одним
workflow event;503 GET отдельно и восстановление без стирания success.
Логи outputs/workspace-audit-a03-{focused,typecheck,unit,build,e2e-typecheck,web}.log.
Diff check PASS. Backend/PG A02 inputs неизменны, повтор не требовался.

A04 brief ACTIVE: ShipmentPanel + pure remaining-stock view model/tests.
Доступные склады вычисляются независимо от выбранного; исчерпанный склад
переключается на следующий, все распределённые позиции дают явное завершённое
состояние. Поля получателя/адреса/перевозчика сохраняются при refresh. Backend
warehouse/quantity guards неизменны. G0 + web build + WEB (два склада, частичный
остаток, конкурентное планирование, keyboard/mobile). Те же fixtures/budgets.

A04 focused6/6, typecheck13/13, serial unit12/12, web build PASS. WEB1 FAIL
на precondition: SupplierOrderItem.cartItemId unique, новая fixture ошибочно
использовала существующий cartItem. Исправлена отдельным synthetic cartItem;
реальные API shipment create/quantity conflict остаются предметом WEB2.
Production code/build неизменны, не повторять build/unit. Попытки WEB1/3.

A04 WEB2 FAIL: fixture предполагала порядок order.items, но Prisma relation
без orderBy вернул второй склад первым. Это не ошибка выбора доступного склада.
Тест теперь явно выбирает исходный склад и проверяет keyboard переход с учётом
реального DOM порядка. WEB3 последняя разрешённая попытка этого gate; при FAIL
остановить фазу/план, сохранить evidence и восстановить dev. Assertions о двух
складах, concurrent409, сохранности ввода и отсутствии overship не ослаблены.

A04 LOCAL_PASS: WEB3 exit0,2/2 (16.8s), реальный API/DB: keyboard выбор обоих
складов, первый полностью распределён→второй доступен, другая сессия распределяет
часть второго→409→refresh сохраняет адрес/получателя→оставшееся количество
создаётся без overship. Все позиции распределены: явное сообщение вместо формы.
Mobile screenshot outputs/workspace-audit-a04-warehouses-390.png просмотрен.
Final E2E typecheck PASS; source typecheck/unit/build переиспользованы, только
test fixture/selector менялись после них. Все3 попытки сохранены. Цена/партия и
A03 повторно прошли в том же live journey. No commit/push/CI как оговорено выше.

A05/A06/A17 brief ACTIVE: выбирается предусмотренная планом атомарная операция
commercial terms вместо двух независимых PUT. Одна транзакция price+выбранный
balance+audit/outbox, expectedOfferVersion + expectedBalanceVersion (null для
нового склада), idempotency key. Публикация остаётся отдельной и не снимается
молча. При конфликте UI сохраняет введённые данные и показывает новые серверные;
черновики quantity/version по warehouseId, не переносить stock другого склада.
Schemas→OpenAPI/client→server→UI, новые feature файлы; миграция не нужна.
Реиспользовать существующие ценовые/складские инварианты; external integrations
не включать. Один writer primary; G0/CONTRACT/PG/WEB. Та же audit DB, synthetic
fixtures с cleanup, budgets/attempts Workflow. Existing unified WIP сохраняется.

A05/A06/A17 progress: schemas/client/OpenAPI, новый OfferCommercialService,
existing OffersService.setPrice/InventoryService.setBalance принимают внутренний
transaction client; legacy команды сохраняются и увеличивают те же версии.
Guard pricing.manage+inventory.adjust (реальные permission codes); amountMinor
строка, без потери точности. Цена без изменений не увеличивает offerVersion,
чтобы независимые склады могли сохраняться отдельно. Draft/publication сохраняются.
ManualOffer теперь явно создаёт черновик/назначает упаковку; отдельный commercial
editor хранит stock+baseline по складам, единый price snapshot и pending command.
Неизвестный write outcome блокирует изменение полей до повтора прежнего key.
Typecheck1 FAIL только конструктор нового api-client теста (нужен второй args),
исправлено; typecheck2 PASS13/13. PG1: build PASS; A01/A02 regressions PASS;
commercial rollback/permissions прошли, затем сравнение replay FAIL из-за
JSON.stringify ключей JSONB. Заменено на isDeepStrictEqual с отдельной проверкой
HTTP200. Production code не менялся после build. Следующий PG2 через db:test.
E2E fixture расширяется отдельно для A=10/B=3, конфликт/повтор/новый склад.

A05 PG2 FAIL на реальной гонке200/500: SELECT FOR UPDATE при Serializable
выдал raw SQLSTATE40001 (PrismaP2010), который не попадал в прежний catchP2034.
Исправление: новая операция использует ReadCommitted + существующий offer row
lock + обязательные offer/balance expected-version checks/CAS; ожидающий writer
читает предыдущий commit и receipt. Legacy setBalance сохраняет Serializable.
Дополнительно raw40001/40P01 переводятся в409, включая безопасный replay receipt.
Это сохраняет атомарность/rollback и позволяет независимым складам с неизменной
ценой работать без ненужной сериализационной ошибки. PG3 будет последней
попыткой; при FAIL остановить scope, сохранить checkpoint и восстановить dev.

A05/A06/A17 PG3 PASS exit0: вся новая матрица rollback/tenant/permissions,
replay, stale/racing editors, независимые склады, legacy price/stock writer
версии и draft/published status плюс прежние A01/A02 и общий PG suite.
CONTRACT PASS37 операций/106 схем (build из PG3); final typecheck PASS13/13.
Полный serial unit PASS12/12 (107.095s), API414 assertions; новые schema7,
client1 и API raw-conflict/permission3 входят. RUNTIME script PASS (API build
переиспользован PG3) — module composition OffersModule→InventoryModule изменён.
Логи outputs/workspace-audit-a05-{postgres-3,contract,typecheck-final,unit,runtime}.log.
После unit маленький UI review: ошибка обновления списка после успешного commit
теперь прямо говорит «сохранено, но список не обновлён»; conflict показывает НДС.
Эти последние UI inputs войдут в web build/WEB и targeted checks; PG не повторять.
Web build ACTIVE, WEB ещё NOT_RUN. Test helper fixtures/offer-commercial-editor.ts
добавляет живой сценарий A=10/B=3, складские черновики, stale409 без потери ввода,
конфликт→явное согласие, inactive/new warehouse, потерю ответа после commit→replay,
закрытие без сохранения и draft/published feedback. Main live test cleanup
расширен на собственные packaging/balances/warehouses/idempotency receipts.
Dev не запущен; восстановить canonical npm run dev после завершения проверок.

A05 WEB1 FAIL: fixture supplier role lacked inventory.view, GET warehouses403
prevented editor initialization. Added only that existing permission to synthetic
role; production guards unchanged. Web build PASS; latest supplier typecheck and
unit55/55 PASS. WEB2 justified by corrected fixture; max3 remains. No backend
inputs changed, PG/CONTRACT/RUNTIME results reused.

A05/A06/A17 LOCAL_PASS: WEB2 exit0,2/2 (43s),1440/390px. Real JWT/API/DB
conflict preserves price/stock, explicit baseline acceptance, independent warehouse
drafts, inactive/new warehouse, committed-response loss and same-command replay,
close/reopen discards unsaved draft, draft/publication feedback. Mobile form
visually inspected (cropped top of full-page evidence); fields/conflict readable.
Latest supplier typecheck/unit55/55 PASS. Build/PG3/contract/runtime/root G0 above
are valid for final production inputs. Final E2E typecheck/diff check recorded
in outputs/workspace-audit-a05-e2e-typecheck.log. No commit/push/CI as above.

A16 analysis: current compensation preserves failed cart/items but unified Cart
selects only ACTIVE without checkout. Safe recovery needs a new cart identity,
durable source→target mapping, refusal while compensation leaves live reserves,
and current revalidation preserving unavailable rows. Simple ABANDONED→ACTIVE
or a client-only copy would lose these guarantees. No A16 product edits yet.

End of first implementation slice: canonical npm run dev restored (session51960,
launcher2028; API20556:4012, web21844:3000). Default local go_live profile,
working marketplace DB; no migrations/seeds/data edits. API readiness and public
/catalog HTTP200. Log outputs/workspace-audit-dev-restored.log. Final diff check
PASS; main646dab5 unchanged, no commit/push/CI. Production/release gates NOT_RUN:
local remediation scope only. Applied Agency Backend Architect, Frontend Developer,
UX Architect and Code Reviewer practices for transactions, accessible state and
regression evidence, plus fix-finding and repository UI standard. First slice
verified; full audit plan remains OPEN, next A16 then A10. Existing WIP preserved.

### Исторический scope исходного аудита


Разрешённый на момент аудита scope — документация. Изменения реализации, API, схем,
данных, зависимостей, процессов и глобального реестра сессий не выполняются.
Один документ объединяет результаты аудита и checkpoint; это не новая независимая
продуктовая очередь. Продуктовые решения остаются в Product, последовательность
реализации — в Foundation, evidence принятия — в Acceptance Matrix.
Предложенный ниже порядок ремонта не означает, что все пункты уже поручены исполнителю.

Статус документа: подготовлен локальный план исправлений. Статус всех исправлений:
OPEN, кроме отдельно обозначенных NEEDS_VALIDATION и DECISION_REQUIRED.
Ни один пункт не считается исправленным или прошедшим runtime-приёмку.

Исходный снимок: единственная папка
`C:\Users\user\Desktop\dentmarket-kz-main`, ветка `main`,
HEAD `646dab585eda96bb21c994b92c611fbf13e56179` плюс существующий dirty WIP,
включая новые `apps/web` и manual order workflow. Один HEAD не описывает
проверенный код. Snapshot digest security-аудита:
`codex-security-snapshot/v1:sha256:79b2eb76b705ed93e28da2f26be415dd4bbe84eb506c1829403cb19645c9e2c3`.
При старте исправлений нужно сопоставить исходники со снимком; номера строк
ориентировочные, имена методов и сценарии — основные якоря.

Первичный security-аудит завершён с двумя MEDIUM findings; это оценка
эксплуатируемости, а не разрешение отложить устранение нарушения цены или отзыва.
Локальные полные материалы находятся в
`C:/Users/user/.codex/state/plugins/codex-security/scans/dentmarket-kz-main/646dab585eda96bb21c994b92c611fbf13e56179_20260930T085550Z_p57uqi7r/`:
`report.md`, `artifacts/workspace-audit-ru.md`,
`artifacts/in-memory-proof.cjs`. Эти материалы не являются файлами репозитория;
на другом компьютере путь может быть недоступен. Настоящий документ содержит
необходимое описание независимо от них.

Источники требований:

- [AGENTS](../../../AGENTS.md) и [Workflow](../DEVELOPMENT_WORKFLOW.md).
- [Product V2](../../product/DENTMARKET_PRODUCT_V2.md), особенно §22 и §23.6.
- [Backend Foundation](../../backend/DENTMARKET_BACKEND_FOUNDATION_V2.md).
- [UI UX standard](../../ui-ux/UI_UX_IMPLEMENTATION_STANDARD.md).
- [Текущее состояние кабинетов](WORKSPACE-REBUILD-2026-09-30.md).
- [Acceptance Matrix](../PROJECT_ACCEPTANCE_MATRIX.md).

Применены прочитанная роль Agency Code Reviewer (корректность, безопасность,
конкуренция, тесты), проектный UI UX standard, Codex Security для исходного аудита
и pages:write-page для структуры/проверки документа. Делегирование не применялось.

## Достоверность и ограничения

CONFIRMED_IN_MEMORY означает выполнение реальных транспилированных методов
сервиса с подменённой Prisma и зависимостями; это не HTTP/PostgreSQL E2E.
CONFIRMED_STATIC означает воспроизводимую последовательность по исходникам,
но без динамической проверки интерфейса. NEEDS_VALIDATION — обоснованный риск,
которому ещё нужна целевая проверка. DECISION_REQUIRED — технический пробел
есть, а окончательная политика должна быть взята из требований или уточнена.

Живой frontend `http://127.0.0.1:3000/supplier` при аудите вернул
`ERR_CONNECTION_REFUSED`, одна попытка. Серверы и рабочая БД не изменялись.
Нет свежей визуальной/клавиатурной/mobile-приёмки, нагрузочного теста,
полного аудита зависимостей, инфраструктуры и всех tenant-маршрутов.
Нельзя называть этот список исчерпывающим перечнем всех уязвимостей.

В ранее проведённых browser checks кабинетов применялись API route fixtures.
Они подтверждают отдельные UI-сценарии, но не целостность настоящего backend.
Полный unit gate ранее остановлен на Tabster/createTabster после трёх попыток.
Документация не сбрасывает счётчик и не превращает BLOCKED в PASS.

## Реестр результатов

Приоритет P1 — до приёмки затронутого критического сценария; P2 — следующий
ремонт поведения/полноты; P3 — улучшение после подтверждения риска.
Ни один приоритет не является автоматическим разрешением реализации.

| ID | Нарушение или пробел | Приоритет | Доказательство |
| --- | --- | --- | --- |
| A01 | Несогласованная цена при checkout | P1 | CONFIRMED_IN_MEMORY |
| A02 | Списание резерва отозванной или просроченной партии | P1 | CONFIRMED_IN_MEMORY |
| A03 | Повтор старой версии команды и исчезновение ошибки | P1 | CONFIRMED_STATIC |
| A04 | Недоступен второй склад при планировании отгрузки | P1 | CONFIRMED_STATIC |
| A05 | Частичное сохранение цены и остатка, неверный статус публикации | P1 | CONFIRMED_STATIC |
| A06 | Перенос количества между складами в редакторе | P1 | CONFIRMED_STATIC |
| A07 | Потеря функций при миграции кабинета поставщика | P2 | CONFIRMED_STATIC |
| A08 | Несогласованное обновление списков и деталей | P2 | CONFIRMED_STATIC |
| A09 | Права dev-профилей расходятся с действиями UI | P2 | STATIC_CONFIGURATION |
| A10 | Неполный жизненный цикл TTL резервов | P1 для затронутого inventory flow | DECISION_REQUIRED |
| A11 | UTC вместо выбранного локального дня документов | P2 | CONFIRMED_STATIC |
| A12 | Неограниченные списки и тяжёлые dashboard-запросы | P3 | NEEDS_VALIDATION |
| A13 | Недостаточно сведений об актуальности и единице продажи | P2 | CONFIRMED_STATIC |
| A14 | Фокус и Escape при открытии мобильного меню | P2 | NEEDS_VALIDATION |
| A15 | Разные ограничения размера PDF | P2 | CONFIRMED_STATIC |
| A16 | Потеря доступа к корзине после неудачного резерва | P1 | CONFIRMED_STATIC |
| A17 | Сохранение устаревшего черновика цены или остатка | P2 | CONFIRMED_STATIC |
| A18 | Неполная приёмка и существующий unit blocker | P1 для заявления готовности | KNOWN_BLOCKER |

A12 исходного краткого отчёта объединял несколько разных рисков. Здесь они
разнесены на A12–A15; A16 и A17 раскрывают замечания из анализа исходников.
A18 — ограничение доказательств, не самостоятельная уязвимость приложения.

## A01 Согласованная цена при checkout

**Нарушение.** Клиника принимает цену A. После успешного validateCart сервер
повторно вызывает resolveOffer. Цена B, изменённая поставщиком между чтениями,
попадает в заказ без нового согласия. В памяти: принято 10000 minor units,
повторное чтение 20000, результат COMPLETED, сохранено 20000.
Автоматическое банковское списание этой проверкой не доказано.

**Где.** [CommerceService](../../../apps/api/src/modules/commerce/commerce.service.ts):
checkout, validateCart, resolveOffer; ориентиры 684–710 и 795–796.
[OffersService](../../../apps/api/src/modules/offers/offers.service.ts): setPrice.
Поставщик с pricing.manage меняет собственную цену легитимным маршрутом;
обход tenant-контроля не требуется. Security severity MEDIUM: значимый ущерб
целостности суммы, но нужны права поставщика и совпадение по времени.

**Как исправлять.**

1. Определить полный согласуемый снимок: цена, валюта, НДС, упаковка/единица,
   минимальное количество и шаг, применимые скидки и доступность.
2. Создавать строки заказа из того же проверенного снимка. Простой перенос
   последнего сравнения выше по коду не закрывает гонку.
3. Связать accepted snapshot/version и финальную запись механизмом согласованной
   транзакции/блокировки либо атомарной проверки версий. Все пути изменения
   коммерческих условий должны участвовать в выбранном механизме.
   Serializable сам по себе без доказанного порядка чтений и конфликтов не DoD.
4. При расхождении вернуть существующий CART_REVALIDATION_REQUIRED и новый diff;
   не создавать успешный заказ и не оставлять удержанные резервы.
5. Сохранить cart version, tenant, идемпотентность и audit/outbox. Деньги —
   точные minor units, без преобразования в JS number.

**Проверки и DoD.** Детерминированно остановить checkout между чтениями,
изменить цену из другого соединения disposable PostgreSQL и продолжить.
Допустимы заказ с принятыми условиями по корректной стратегии или конфликт
с обязательным повторным согласием; недопустим заказ с непринятой B.
Проверить смену валюты/упаковки, повтор idempotency key, отсутствие частичного
заказа и двойного резерва. Gates G0 + CONTRACT + PG + WEB для consent flow.

## A02 Пригодность партии при оплате и отгрузке

**Нарушение.** recallLot сохраняет ACTIVE у затронутых резервов.
CONFIRM_TRANSFER вызывает consume, где проверяются состояние резерва и
количество, но нет проверки RECALLED/EXPIRED/expirationDate партии.
Метод в памяти списал такой резерв. Последующее присваивание DEPLETED
способно затереть текущий статус RECALLED.

**Где.** [InventoryService](../../../apps/api/src/modules/inventory/inventory.service.ts):
recallLot; [OrderWorkflowService](../../../apps/api/src/modules/commerce/order-workflow.service.ts):
consume, CONFIRM_TRANSFER; [LogisticsService](../../../apps/api/src/modules/logistics/logistics.service.ts):
создание/продвижение отгрузки. Последний путь просмотрен статически.
Security severity MEDIUM: нужны существующий заказ, платёжное заявление
и разрешение поставщика на подтверждение.

**Как исправлять.**

1. В транзакции перехода повторно проверять состояние и срок партии.
   Проверка должна участвовать в guarded update/блокировке, чтобы recall
   не мог вклиниться после проверки, но до списания.
2. Согласовать с recall тот же порядок блокировок/версий; держать неизменными
   tenant, резерв, количество, связь позиции заказа со складом/партией.
3. Не заменять RECALLED на DEPLETED как способ скрыть отзыв; количественное
   исчерпание не отменяет историю и ограничение отзыва.
4. Повторить проверку непосредственно перед разрешённой отгрузкой/отправкой.
   Исправление только consume не защищает отзыв уже оплаченного заказа.
5. Отозванный заказ переводить в существующий защищённый exception flow.
   Если деньги реально получены, нельзя выдавать «не получены» только из-за
   блокировки товара. На первом минимальном fix допустимо атомарно запрещать
   опасный текущий переход с ясной ошибкой; окончательное разделение факта
   оплаты и пригодности исполнения требует согласования с платёжной моделью.
   Новый статус/API при необходимости сначала описать в schemas/OpenAPI/client.
6. Не отпускать отозванный остаток обратно в продаваемое availability
   при отмене, expiry или компенсации.

**Проверки и DoD.** reserve → recall → payment confirmation, expiry без смены
статуса, recall одновременно с consume, recall после оплаты перед shipment.
В каждом случае нет незаконного расхода/отправки, частичных записей и утраты
истории. Повтор команд идемпотентен, другой tenant запрещён.
G0 + PG; CONTRACT при изменении envelope/status; WEB для понятного исключения.

## A03 Ошибки действий и конфликт версии заказа

**Где и причина.**
[OrderWorkflowWorkspace](../../../packages/ui/src/order-workflow-workspace.tsx):
refresh и perform. pending хранит command по signature, включая expectedVersion.
После 409 успешный GET обновляет data и очищает error, но не pending.
Повтор того же действия переиспользует старую версию. Успешное чтение также
стирает ошибку записи через очередной polling примерно через пять секунд.

**Сценарий.** Открыть заказ в двух сессиях. В первой изменить заказ, во второй
отправить старое действие. После 409 дождаться GET и повторить действие.
Интерфейс не должен выдавать новый успех чтения за успех старой записи.

**Как исправлять.** Разнести readError, actionError и notice. Ошибка записи
живёт до исправления причины/явного действия пользователя. Для доказанного
version conflict перечитать заказ, показать изменённые условия и сформировать
новую команду только после нужного согласия. При сетевом таймауте, где исход
записи неизвестен, повторять прежний idempotency key или проверять его результат;
безусловно создавать новый key на любой ошибке нельзя. Сбрасывать pending при
смене orderId; защищать результаты старых запросов от применения к новому заказу.

**Проверки и DoD.** Fake timers: 409 → GET новой версии → повтор отправляет
корректную версию; ошибка записи не пропадает от GET. Network timeout после
фактического commit → повтор не создаёт второе действие. Также ошибка GET,
смена заказа, unmount и focus. G0 + WEB; серверный PG нужен только при изменении
серверного контракта/идемпотентности, а не для одной UI-state правки.

## A04 Выбор склада при отгрузке

**Где.** [ShipmentPanel](../../../apps/supplier-web/app/shipment-panel.tsx):
начальный warehouseId, remainingItems, условный блок формы.

**Сценарий и причина.** У заказа два склада. После распределения всех позиций
первого remainingItems пуст; вместе с формой исчезает selector, поэтому выбрать
второй склад нельзя. Повторное открытие снова выбирает первый.

**Как исправлять.** Рассчитать доступные для планирования склады независимо
от выбранного. Selector выводить вне условия remainingItems. При исчезновении
текущего склада выбирать следующий подходящий; при полностью распределённом
заказе показывать понятное завершённое состояние. Не терять введённые количества
при refresh и не отправлять позиции склада A со warehouseId B. Серверные
проверки склада и конкурентно оставшегося количества сохраняются.

**Проверки и DoD.** Два склада; первый заполнен полностью/частично, второй
доступен; все позиции распределены; конкурентная отгрузка в другой сессии;
клавиатурное переключение и узкий viewport. G0 + WEB.

## A05 Атомарность сохранения предложения и публикация

**Где.** [ManualOffer](../../../apps/supplier-web/app/features/supplier-workspace/manual-offer.tsx):
save/publish; OffersService.setPrice; InventoryService.setBalance.

**Сценарий.** Изменить опубликованное предложение. Первый запрос сохраняет цену,
второй получает конфликт склада/резервов. UI сообщает общую ошибку, список
не обновляется, хотя новая цена уже действует. Успех редактирования сообщает
«предложение ещё не опубликовано», хотя существующая публикация не снята.

**Как исправлять.** Предпочтительный связанный fix для единой кнопки «Сохранить»:
серверная операция коммерческих условий с одной транзакцией, guards для всех
нужных permissions, expectedVersion и идемпотентностью. Сначала определить
request/response/error в schemas, OpenAPI, client; затем сервис и UI.
Цена, остаток, audit/outbox должны либо записаться вместе, либо не записаться.
Создание черновика и публикация остаются разными явными действиями.

Если выбирается меньший scope без новой операции, UI обязан явно разделить
сохранение цены и склада, показать успешную часть, обновить серверные данные
и повторять только неуспешную. Это альтернативный UX, не атомарная запись.
Не делать клиентский «откат цены» новым безусловным PUT: он способен затереть
чужое изменение. Выбор одного варианта зафиксировать до реализации.

**Проверки и DoD.** Ошибка второго шага, конкурентное изменение, потеря ответа,
повтор сохранения, published и draft, запрет одного permission, другой tenant.
Текст и публикация соответствуют факту; нет ложного общего успеха.
G0 + CONTRACT + PG для серверной операции, WEB для обоих вариантов.

## A06 Остаток при смене склада

**Где.** ManualOffer: загрузка initialOffer берёт inventoryBalances[0];
onChange selector меняет только warehouseId.

**Сценарий.** На A количество 10, на B 3. Открыть редактор на A, выбрать B:
в поле остаётся 10, сохранение может заменить 3 на 10.

**Как исправлять.** Хранить исходный balance и черновик по warehouseId.
При выборе склада отображать соответствующие quantityOnHand, зарезервированное
количество и доступность. Для нового склада использовать явное пустое/нулевое
начальное состояние, не переносить количество другого склада. Отдельно решать
несохранённые правки при переходе; не уничтожать их фоновым GET.
Отправлять версию выбранного balance, если она добавлена по A17.
Сохранять запрет нарушения существующих резервов.

**Проверки и DoD.** A=10/B=3, переход туда-обратно, новый склад, неактивный склад,
изменение списка складов при открытой форме, отмена и серверный конфликт.
В запросе всегда количество именно выбранного склада. G0 + WEB; A17 добавляет PG.

## A07 Полнота нового кабинета поставщика

**Где.** [Products](../../../apps/web/app/workspaces/products.tsx);
старый [SupplierOffers](../../../apps/supplier-web/app/features/supplier-workspace/supplier-offers.tsx),
ProductProposals, ProductCorrectionsPanel, SupplierInventory, SupplierIntegrations.

**Подтверждено.** Новый Products использует ManualOffer/SpreadsheetImport,
но не подключает историю заявок и corrections. Заявку можно отправить,
а статус/отказ не посмотреть в этом экране. Расширенные старые панели
не подключены к новым рабочим страницам. Это регрессия доступности, а не
доказательство отсутствия соответствующей бизнес-логики на сервере.

**Как исправлять.** Составить карту «функция → прежний компонент/API →
новый маршрут → permission → решение». Обязательно пройти историю заявок,
причины отказа и повторное действие, предложения исправления карточек,
управление публикацией, партии/резервы и доступные настройки источника.
Для каждой функции: переиспользовать в новом маршруте, явно отложить с
согласованным ограничением либо показать реальный доступный путь.
Не возвращать все старые монолитные экраны целиком и не подключать новые
внешние интеграции под видом исправления навигации. Удалять старый код нельзя
до подтверждения переноса.

**Проверки и DoD.** Отправка заявки → список → открытие → отказ/повторное действие;
прямые URL, назад, пустой список, ошибки, ограниченные permissions и tenant.
Каждая функция карты имеет проверенный маршрут или явное решение владельца.
G0 + WEB; CONTRACT только если потребуется менять API.

## A08 Обновление данных и состояние устаревания

**Где.** [useResource](../../../apps/web/app/workspaces/use-resource.ts),
orders/products/dashboard, общий workflow, buyer-cart refresh.

**Факт.** Списки используют mount/manual refresh; dashboard не имеет обычной
кнопки обновления. Детали заказа — polling 5 секунд/focus, корзина — 60 секунд/focus,
документы — ручное обновление. Изменение другой стороны не гарантирует свежий список.

**Как исправлять.** Задать для каждой поверхности события инвалидирования:
успешная собственная запись, возврат focus/online и периодическая проверка только
там, где ожидание внешнего действия это оправдывает. Не добавлять socket-сервис
или новый state manager без основания. У resource хранить lastSuccessAt,
initialLoading, refreshing и stale/error. При фоновом запросе сохранять последнюю
успешную таблицу, явно показывая обновление/ошибку; не очищать форму и actionError.
Игнорировать поздние ответы для другой организации/страницы, не допускать
одновременных одинаковых запросов. Abort допустим как оптимизация, а sequence
остаётся защитой от устаревшего ответа.

**Проверки и DoD.** Вторая сессия меняет заказ, focus обновляет список; offline
сохраняет старые данные с предупреждением; reconnect обновляет; old response
не заменяет данные нового tenant; polling не стирает ввод. Интервалы и допустимую
задержку зафиксировать в task brief, не придумывать универсальный SLA.
G0 + WEB.

## A09 Права тестовых профилей и доступность действий

**Где.** [prepare-dev-database](../../../scripts/prepare-dev-database.mjs):
списки permissions новых ролей и создание профилей; guards price/import/compliance/
warehouse/delivery; соответствующие UI-кнопки.

**Факт и предел.** В скрипте отсутствует часть permissions, нужных отображаемым
операциям, например pricing.manage/import.manage/compliance permissions.
При таких правах guard вернёт 403. Реальные текущие роли рабочей БД не читались;
onboarding создаёт другой набор. Нельзя утверждать, что дефект есть у всех поставщиков.

**Как исправлять.** Зафиксировать матрицу ролей для demo fixture и реального
сотрудника. Проверять capability до отображения активного действия, объяснять
недоступность там, где пользователь должен знать о функции. Guards обязательны.
Обновить создание разрешённых fixture-профилей; для уже существующих аккаунтов
нужен отдельный безопасный reconciliation, а не blanket admin и не reseed каталога.
Рабочие аккаунты не менять в тестовой задаче.

**Проверки и DoD.** Минимальная роль, полная согласованная роль, чужой tenant,
доступ отозван после открытия страницы, обработка 403 без потери формы.
Fixture проверять на disposable DB. G0 + WEB; PG/CONTRACT по затронутому серверному пути.

## A10 Срок и освобождение резервов

**Где.** CommerceService.checkout передаёт ttlMinutes=30;
InventoryService.reserve пишет expiresAt; consume его не проверяет.
В просмотренных apps/api/src и scripts не найден автоматический expiry consumer.
Foundation CORE-03.2 также не даёт основания считать lifecycle полностью принятым.

**Важное уточнение исходного аудита.** Product §23.6 уже требует приостановить
автоматическую отмену и снятие резерва после заявления банковского перевода,
пока его фактическое поступление не подтверждено. Нельзя исправить A10
безусловным освобождением всех резервов старше 30 минут. Требуется применить
утверждённое правило к состояниям заказа, а уточнять только оставшиеся пробелы.

**Как исправлять.**

1. Описать таблицу состояний: до заявления оплаты, заявление pending/уточнение,
   paid, cancelled/rejected, recall, внешний резерв. Для каждого указать,
   применим ли expiresAt, кто и как освобождает/продлевает резерв.
2. Для разрешённого expiry использовать существующий worker/runtime:
   ограниченная выборка, atomic claim/CAS, идемпотентное освобождение,
   восстановление availability только для пригодной партии.
3. Гонку expiry с оплатой/отменой разрешать в одной согласованной модели
   транзакций. Не подтверждать заказ с уже освобождённым резервом и не отпускать
   его дважды. Сохранять audit/outbox, наблюдаемость и повтор после падения worker.
4. Для pending transfer держать явно объяснимое удержание и путь исключения.
   Напоминания/эскалации из §23.6 — отдельный согласованный scope, а не скрытая
   новая интеграция в исправлении TTL.

**Проверки и DoD.** До/ровно/после срока с управляемыми часами; transfer pending
не освобождается; expiry одновременно с confirm/cancel; повтор worker, crash,
recalled lot и внешний резерв. Нет отрицательных количеств и двойного возврата.
G0 + PG + RUNTIME; CONTRACT при новых состояниях; WEB для объяснения пользователю.

## A11 Календарные границы документов

**Где.** [Documents](../../../apps/web/app/workspaces/documents.tsx): query dateFrom/dateTo
с суффиксами T00:00:00.000Z и T23:59:59.999Z.

**Сценарий.** Для UTC+5 выбранный день начинается на сервере в 05:00 местного
времени. Документы с 00:00 до 05:00 исключаются, часть следующего дня включается.

**Как исправлять.** Установить источник календарной зоны: бизнес-зона либо
согласованная зона пользователя, явно подписанная в UI. Преобразовать начало
дня и начало следующего дня в UTC. Предпочитать полуоткрытый интервал
[from, nextDay), но при текущем inclusive API не менять семантику молча:
либо корректно вычислить верхнюю границу, либо сначала обновить контракт.
Не зависеть от случайной timezone процесса сервера.

**Проверки и DoD.** Начало/конец дня, соседний день, месяц/год, пустые границы,
dateFrom>dateTo, клиент и сервер в разных зонах. G0 + WEB; CONTRACT при изменении API.

## A12 Объём списков и нагрузка

**Где.** CommerceService списки корзин/заказов, OffersService.list,
workspace orders/products/dashboard. Часть API возвращает полный findMany
с вложенными объектами, поиск выполняется на клиенте. Документы и импорт уже
имеют собственную пагинацию; нельзя объявлять её отсутствие во всём приложении.

**Риск.** Payload, время ответа и рендер растут с данными. Измеренного превышения
бюджета нет, поэтому это NEEDS_VALIDATION, а не подтверждённый performance incident.

**Как исправлять после измерения.** На synthetic disposable dataset измерить
объём ответа, запросы, время сервера и рендера. Если риск подтверждён —
cursor pagination со стабильным order/id tie-breaker, ограниченным limit,
серверными фильтрами и tenant; отдельные агрегаты dashboard вместо загрузки
всех заказов. Сначала schemas/OpenAPI/client, затем UI и подходящие индексы.
Существующий limit не должен молча обрезать полный результат.

**Проверки и DoD.** Нет дублей/пропусков страниц при изменениях, фильтры корректны,
cursor другого tenant не раскрывает данные, пустая последняя страница обработана.
Числовые бюджеты фиксируются до измерения. G0 + CONTRACT; PG для запросов/индексов,
WEB для навигации. Prisma migration только при реальном изменении схемы.

## A13 Актуальность цены и единица продажи

**Где.** Products показывает ACTIVE price и quantityAvailable по складам,
но не объясняет срок свежести, источник и единицу продажи/упаковку.

**Риск.** ACTIVE не обязательно означает коммерчески свежую цену. Количество
без единицы и кратности затрудняет правильное редактирование и сравнение.

**Как исправлять.** Переиспользовать существующие поля и форматирование.
Показать цену за sale unit, содержимое упаковки/кратность, отдельно доступное
и зарезервированное количество там, где это важно для действия, timestamp
подтверждения и stale/expired. Не вычислять серверную пригодность независимо
в UI и не обещать доступность только по marketplaceVisible. Если API не даёт
нужного статуса, расширить общий контракт.

**Проверки и DoD.** Разные упаковки, stale price при ACTIVE, нулевой остаток,
reserved>0, недоступный timestamp. Форматы совпадают с корзиной, деньги точные.
G0 + WEB; CONTRACT при изменении response.

## A14 Мобильное меню и клавиатура

**Где.** [Workspace](../../../apps/web/app/workspaces/workspace.tsx):
toggle и onKeyDown на aside.

**Доказательство ограничено.** В коде есть возврат фокуса при Escape внутри aside
и скрытие закрытого меню. Не обнаружен явный перенос фокуса при открытии.
Если фокус остаётся на toggle, Escape не попадёт в handler aside.
Исторический browser PASS закрытия существует; он не доказывает этот конкретный
порядок «открыть → сразу Escape». Не утверждать, что всё меню не работает.

**Как проверять и исправлять.** Сначала воспроизвести клавиатурой без Tab.
При подтверждении использовать текущий Fluent pattern; переносить фокус
на доступное закрытие/первое действие, возвращать на toggle и обрабатывать
Escape на корректной области. Если это modal drawer — применить его правила
focus containment и фоновой доступности; не добавлять trap к немодальной навигации
без выбора паттерна. Сохранить aria-expanded/controls и недоступность скрытых ссылок.

**DoD.** Enter/Space → Escape, Tab/Shift+Tab, выбор ссылки, resize при открытом меню,
возврат фокуса, screen-reader имя. G0 + WEB на desktop и узком viewport.

## A15 Единый лимит PDF

**Где.** OrderWorkflowWorkspace допускает 10*1024*1024 bytes.
[DocumentsService](../../../apps/api/src/modules/documents/documents.service.ts):
decodeBase64/quarantine ограничивают 10_000_000 bytes.

**Сценарий.** PDF размером между 10_000_001 и 10_485_760 bytes проходит UI,
но отклоняется backend. Это ошибка согласованности, не обход серверного лимита.

**Как исправлять.** Выбрать уже поддержанный сервером лимит либо согласованно
изменить его, вынести общую константу/контракт и точную подпись. Проверять
размер декодированных bytes; не путать с длиной base64. Сохранить серверную
валидацию содержимого/MIME, карантин и обработку ошибок. Не увеличивать лимит
только для прохождения теста.

**Проверки и DoD.** max-1, max, max+1; расширение PDF с не-PDF содержимым,
повтор загрузки после ошибки без второго workflow-действия. G0; CONTRACT/WEB
по затронутой границе upload.

## A16 Восстановление корзины после неудачного резервирования

**Где.** CommerceService.checkout при compensation помечает checkout FAILED,
корзину ABANDONED. [Cart](../../../apps/web/app/workspaces/cart.tsx) выбирает только
ACTIVE без checkout и не предлагает восстановление.

**Сценарий.** Состав принят, но reserve падает из-за конкурентного остатка.
Пользователь видит ошибку. После refresh прежний состав исчезает из доступного
экрана; повтор прежней команды не является новым корректным checkout.
Это потеря доступности черновика в UI, а не доказанное удаление строк из БД.

**Как исправлять.** Сохранить failed checkout для истории/идемпотентности.
Предложить явное восстановление в новую активную корзину или иной уже существующий
безопасный сценарий. Не менять ABANDONED на ACTIVE простым UPDATE: это может
повторно использовать старый checkout/key/резерв. Новый черновик копирует только
намерение купить, проходит текущую revalidation и новое согласие с изменениями.
Недоступные позиции показать явно; не выбрасывать их молча.
Операция восстановления сама идемпотентна и tenant-scoped.

**Проверки и DoD.** Частичный успех резервов и компенсация, повтор восстановления,
падение сети после создания новой корзины, изменённая цена, недоступная позиция,
другой tenant. Нет двойных заказов/резервов, исходная история сохранена.
G0 + CONTRACT + PG + WEB.

## A17 Защита от сохранения устаревшего черновика

**Где.** setPrice не принимает клиентскую expectedVersion; setBalance читает
текущую серверную version и защищает конкуренцию своей транзакции, но не
сопоставляет её с версией, которую пользователь видел при открытии формы.

**Сценарий.** Сотрудник A открыл остаток 10. B изменил его на 7 и завершил запись.
A позже сохраняет устаревший ввод. Внутренняя серверная CAS начинается уже с
версии B, поэтому не обнаруживает устаревший пользовательский снимок.
Это другая причина, чем перенос количества между складами в A06.
Серверную защиту резервов и Serializable нельзя объявлять отсутствующими.

**Как исправлять.** Если политика — предотвращать потерю правок, добавить
expectedVersion именно редактируемой сущности в общий контракт и сверять её
атомарно. UI хранит версию полученного черновика; при 409 показывает текущие
значения и введённые пользователем, не повторяет молча поверх нового состояния.
Определить область version для связанной операции A05 и всех других писателей.
Если last-write-wins является осознанной политикой источника, обозначить это
как решение с аудитом и UI-предупреждением, а не скрытый эффект формы.

**Проверки и DoD.** Последовательные записи двух сотрудников, реальная гонка,
разные склады, независимые поля и версии, сохранность введённого текста после 409.
G0 + CONTRACT + PG + WEB. Не вводить migration, если существующих version достаточно.

## A18 Приёмка и существующий тестовый блокер

**Факт.** В WORKSPACE-REBUILD есть отдельные PASS typecheck/schema/browser checks,
но полный unit gate BLOCKED на Tabster/createTabster после трёх совокупных
попыток. Живой UI текущим аудитом не проверен. Старый PASS не сертифицирует
новые входы, а отсутствие live browser не является доказательством дефекта приложения.

**Как закрывать.** Выделить точный scope устранения совместимости test environment
с Tabster; сначала прочитать прежние логи. Новый запуск допустим после нового
обоснованного изменения входов/гипотезы, с сохранением истории трёх попыток.
Не удалять падающий тест, не подменять production-поведение no-op mock и не
увеличивать timeout без причины. После целевого исправления пройти обязательные
gates и реальные critical flows на disposable PostgreSQL.

**DoD.** Есть воспроизводимое объяснение причины, минимальный fix, пройденный
полный обязательный gate и отдельные доказательства live API/UI.
Скриншот error-state, route fixture или одно открытие страницы не заменяет
оплату/склад/tenant-приёмку. Если gate снова blocked — сохранить точный результат
и остановить затронутую фазу по Workflow, не начинать следующую как «готовую».

## Состояние реализованных функций

| Возможность | Реализовано по коду | Ограничение |
| --- | --- | --- |
| Оболочка и маршруты двух ролей | Да | Live visual acceptance не выполнена |
| Сессия, членство и capabilities | На просмотренных путях | Не все endpoints аудированы |
| Каталог и корзина | Да | A01, A08, A16 |
| Разбиение заказов и резервы | Да | A02, A10 |
| Состав, счёт, заявление перевода, подтверждение | Есть manual workflow | A02/A03; не все целевые правила §23.6 реализованы |
| Недоплата, переплата, банковский возврат | Целевые правила заданы | Нельзя считать реализованными по full-amount workflow |
| Отгрузка и получение | Да | A04 и recall-gap |
| Документы и фильтры | Да | A11/A15 |
| Предложения, импорт и публикация | Да | A05/A06/A09/A17 |
| Заявка на новый товар | Отправка есть | История/статус не подключены в новом UI |
| Прежние расширенные панели | Код существует | Карта переноса A07 не закрыта |
| Профиль, склады, доставка, реквизиты | Компоненты/API есть | Permissions и live flow не приняты этим аудитом |
| Единообразная свежесть всех страниц | Нет | A08/A13 |
| Release/production и внешние интеграции | Не оценивались | Не следуют из локального manual workflow |

## Порядок исправлений и зависимости

1. A01 и A02 — отдельные минимальные изменения целостности цены и партии.
   До старта каждого проверить существующие contracts/tests; не переписывать
   весь commerce. Если обязательный gate blocked, не объявлять фазу закрытой.
2. A03, A04 — восстановление основных действий заказа и отгрузки.
3. A05, A06, A17 — единый brief редактирования предложения, затем разделённые
   связные изменения согласно выбранному контракту и проверкам.
4. A16 и A10 — восстановление checkout и lifecycle резервов с учётом §23.6.
5. A07–A09, A11, A13–A15 — полнота UI, permissions, обновление и границы ввода.
6. A12 — сначала измерение; оптимизация только по подтверждённому результату.
   A18 устраняется отдельным разрешённым scope настолько рано, насколько
   требуется для обязательных gates выбранного исправления.

Перед кодом каждого пункта назначить одного writer, краткий task brief,
точные изменяемые файлы и disposable fixture profile. Пункты с изменением API
начинать с schemas → OpenAPI/client → server → UI. Изменение Prisma требует
migration, prisma validate и upgrade-path. Исторические миграции не редактировать.

## Матрица будущих проверок

Это план, а не журнал PASS. Выбирать фактические команды по Workflow и
затронутым входам; не запускать все наборы для каждой строки автоматически.

| Обозначение | Команды и область |
| --- | --- |
| G0 | npm run typecheck; npm test; git diff --check для TypeScript change |
| CONTRACT | npm run verify:core-contract для контракта покупки |
| PG | npm run verify:postgres для checkout, tenant, rollback, stock concurrency |
| RUNTIME | npm run verify:runtime-split для изменённого API/worker runtime |
| WEB | npm run verify:web после проверки источника dev-процессов и тестового профиля |
| RELEASE | npm run verify:release только при отдельной release-приёмке |

Перед DB-writing проверкой подтвердить disposable identity/fixtures.
Рабочий demo-каталог не reseed. Запуски и повторы считать по Workflow §4,
максимум три на gate/блокер; смена чата/инструмента не обнуляет попытки.
Прежний evidence переиспользуется только при проверяемых неизменных входах.
Один security fix не равен закрытию всех пунктов этого реестра.

## Критерии закрытия отдельного пункта

- [ ] Исходный сценарий воспроизведён или статическое доказательство уточнено.
- [ ] Минимальное исправление реализовано в согласованном scope.
- [ ] Контракт, guards, идемпотентность, audit/outbox сохранены или явно обновлены.
- [ ] Тест проверяет нарушенный инвариант, включая отказ и конкурентный сценарий.
- [ ] Обязательные gates имеют фактический PASS или доказанный REUSED_PASS.
- [ ] UI critical flow проверен на живом согласованном окружении, если затронут.
- [ ] Проверены scope diff, чужой WIP и отсутствие секретов.
- [ ] Публикация и actual CI зафиксированы, если входят в разрешённый scope.
- [ ] Evidence внесён в существующую карточку/Acceptance Matrix; пункт закрыт по факту.

Для каждого ремонта дописать в этот документ краткую ссылку на его существующую
карточку и evidence; не дублировать полный журнал тестов и продуктовую очередь.

## Checkpoint документации

Основание: запрос пользователя после аудита — подробно задокументировать
все выявленные проблемы и способы исправления перед началом ремонта.
DoD текущего docs-only scope: единый реестр, доказательства/ограничения,
решения и критерии проверок, корректные локальные ссылки, сохранность чужого WIP.

Preflight: canonical root/main/HEAD сверены; index исходно пуст; существующие
изменения исходников и общих документов принадлежат прежним задачам и сохранены.
По состоянию приложения PlatformaMarket и PlatformaMarket UI idle.
Этот документ — единственный собственный путь записи.
Исходные sealed security-артефакты не изменены.

Проверки документа 30.09.2026: Node readback — 23 локальные Markdown-ссылки
разрешаются, разделы A01–A18 присутствуют без дублей, trailing whitespace нет,
все 7 упомянутых npm scripts существуют. Проверка содержимого относительно
Product §23.6 учтена в A10. git diff --check — PASS для tracked diff;
новый untracked документ отдельно проверен на пробелы. Список чужих dirty paths
до/после совпадает, index пуст, HEAD остался 646dab5.
Документ сохранён локально; commit/push и CI в этой side conversation не выполнялись,
общая Git-история и незавершённый продуктовый WIP не изменены.
TS/build/DB/browser suites для текущей docs-only правки не требуются.
Публикация исходного продуктового WIP и изменение общих статусов не входят
в этот локальный документ. Исправления A01–A18 ещё не начаты.

Следующий шаг: выбрать первый разрешённый fix A01, сверить его текущие входы
и сформировать минимальный brief с PostgreSQL regression test и обязательными
gates. Перед кодом учесть A18; не обещать завершённую приёмку при blocked gate.

A13–A15 WEB1:24/25 PASS; A15 failed before upload because native file input had no associated label (visible caption existed). Added React useId + Field htmlFor/input id, retaining accessible-name locator. Canonical build2 and focused WEB2 required for changed UI; previous24 passes reused. API build1 PASS, contract/volume not started because sequential command stopped on WEB failure.
A15 build2 FAIL TypeScript: Fluent Field htmlFor belongs to label slot, not root. Corrected slot shape; build3 final attempt, then focused WEB2 (not yet attempted).

Финальная запись30.09: canonical npm run dev восстановлен и оставлен работающим (session33798, launcher26204, API28360:4012, web11992:3000). Обе цепочки процессов принадлежат launcher из canonical root. Профиль go_live/JWT, рабочая marketplace, role all. GET /api/health/ready: ready, database/storage ok; GET /catalog: HTTP200. Никакого reseed/миграции при восстановлении. Лог outputs/workspace-audit-final-dev.log. A01–A18 LOCAL_PASS в указанной границе; дальнейшие операции не начаты.

## Публикация двух задач — 30.09.2026

Основание: новое явное поручение владельца «сделай пуш всех незакомиченных
изменений из этого чата и из чата PlatformaMarket UI». Это отменяет прежнюю
отсрочку публикации для данного набора. Единственный writer — текущий primary;
PlatformaMarket UI notLoaded, завершённые turn summaries прочитаны.
Canonical main646dab5, origin https://github.com/NikIg228/PlatformaMarket.git;
fetch подтвердил0 ahead/0 behind. Разрешены commit/обычный push/проверка actual CI,
не release/tag/deploy, изменение БД или новая продуктовая фаза.

Кандидат:317 явных путей, весь продуктовый WIP двух задач (единое приложение,
каталог/UI, workflow и аудит A01–A18, тесты/миграции/документация). Список и хэши
outputs/publish-20260930-inputs.json. Отдельно остаются5 прежних служебных путей:
.codex/project-session.json — receipt другого оркестратора;4 tracked next-env.d.ts
старых приложений — автоматически изменяемые build/dev declarations. Новый
apps/web/next-env.d.ts является частью нового workspace scaffold.

Typecheck13/13, serial full unit12/12, canonical/API builds, CONTRACT/PG/RUNTIME,
затронутые browser flows — REUSED_PASS по предыдущему разделу. Продуктовые
исходники и lockfile после final unit не изменялись; только generated next-env
нового приложения обновлён запуском dev. Проверены paths, миграции, lockfile
(добавлен только workspace), отсутствие credential/key patterns, diff hygiene.
Применены Git Workflow Master и development-toolkit review/verification.

Известное ограничение: CI ещё использует legacy browser/build paths; отдельный
legacy buyer bundle budget FAIL не переименован в PASS. Canonical gate принят;
состояние CI после публикации сообщить отдельно, не выдавать локальный pass за CI.
Release workflow срабатывает на tags/dispatch, push main не запускает deploy.
Старые BLOCKED записи PlatformaMarket UI по Tabster сняты A18; история сохранена.

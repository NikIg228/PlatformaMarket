# INTERNAL-PILOT — полная последовательность, 28.09.2026

Owner: primary01a0c957-1f23-7b70-9dc9-226afbb5c0b1, generation3; один writer.
Статус: ACTIVE. Пользователь разрешил все восемь блоков из предыдущего ответа,
без ожидания подтверждений; вопросы записывать для последующего обсуждения.
Источник требований: Product23/22, Foundation4.2; это checkpoint, не второе ТЗ.
Разрешение включает реализацию внутреннего цикла заказа; прежнее откладывание
CORE-02/03 больше не запрещает работу в этой последовательности. Неутверждённые
бизнес-правила не выдаются за решения владельца: см. PILOT-OPEN-QUESTIONS.md.
Без внешних СДЭК/1С/PSP, production deployment, реальных платежей/данных/рассылок.

Checkout: C:\Users\user\Desktop\dentmarket-kz-main, main7f49402.
Origin: NikIg228/PlatformaMarket. Папка не переименована: sharing violation3/3,
REBRAND checkpoint сохраняется. Перенос не блокирует продуктовую реализацию.
Прежний WIP: staged branding51 paths, AGENTS origin, registry/handoff/PRIMARY/
CORE-04/PILOT-DOCS receipts, четыре next-env и flow-a. Сохранять; коммиты разделять.

Последовательность: CORE-04.5 ручное предложение/история/карточка/корзина;
CORE-01/02/03 заказ; CORE-05/06 коммуникации/права; CORE-04.6/04.7 акции;
CORE-06.6 панель; CORE-07 списки/аналитика; CORE-08/09 общая приёмка.
Перед каждым блоком сверить существующий код/API/tests, затем реализовать пробел.
DoD: сквозной UI/API сценарий трёх сторон, ошибки/tenant/idempotency/резервы,
документы и права; актуальное evidence, review, scoped commit/push и actual CI.
Не считать весь пилот готовым по приёмке одного блока.

Gates по Workflow: TS typecheck+test, затронутые builds, critical UI verify:web;
API contract verify:core-contract; commerce/DB verify:postgres, migrations upgrade;
runtime/config/profile gates только при изменении соответствующих входов.
Только существующая disposable dentmarket_audit_20260914; не рабочая БД.
Max3 попытки/gate,20мин build/test,45мин suite/CI; прежние попытки не обнулять.
Роли прочитаны: Backend Architect (границы/данные), Frontend Developer
(состояния/доступность), Code Reviewer (риски), Git Workflow Master (атомарность).
Агенты не создаются. Рабочие source changes пока не начаты.
Следующий шаг: конкретная сверка ручного предложения/API и refresh корзины.

CORE-04.5 implementation in progress: typed master variant search/cursor, manual
create/configure/publish form and candidate submission; history selection; cart
60s/focus scheduler; initial inventory guard against rebinding another offer.
Typecheck attempt1 FAIL BigInt literal under current TS target; fixed with BigInt()
without changing target. Attempt2 PASS12/12. Unit attempt1 aborted after existing
buyer order-profile cold import exceeded5s (78 buyer cases passed, new scheduler
passed); no failed assertion. Retry2 uses same tests/thresholds sequential Turbo
workspace scheduling to reduce contention; unfinished workspaces must also run.
Brand-only commit b917ff84d16b0a3585e64dfd3d24a552e081a9b9 pushed and exact remote
confirmed; CI36350104586/Security36350104628 pending. Source base now b917ff8.
Folder move still blocked; no fourth move attempt. No pilot feature committed yet.
Typecheck2 PASS12/12; tests2 PASS11/11 with workspace concurrency1, unchanged
assertions/timeouts. Full pilot build attempt1 running; local URLs explicitly
forwarded via Turbo --env-mode=loose. E2E typecheck PASS before additional positive
publication assertions (same new test, check again before browser).
Core-contract attempt1: schema/API prerequisite builds passed and reused; direct
node scripts/verify-pilot-backend.mjs --contract-only FAILED API readiness45s,
no child diagnostic output. It overlapped web build; retry only after build completes
to isolate resource contention. No timeout increase, no auth/config bypass.
New manual E2E verifies zero-stock publication refusal, reload/resume, then positive
stock/publication and clinic product detail. Fixtures confined to audited local DB;
seed supplier has one active historical agreement, no current acceptance override.
Build1 PASS10/10; core-contract2 PASS85 components/27 operations; PostgreSQL1
PASS tenant/rollback/idempotency/stock/cart-race. Manual browser1 PASS including
publication refusal/resume/positive buyer visibility/mobile390. E2E typecheck2 PASS.
Review follow-up: preserve warehouse safety stock during initialForOffer updates,
VAT rate in resumed editor, assign missing legacy packaging via existing versioned
API. New regression checks; changed inputs require applicable gates again.
Review follow-up typecheck PASS12/12 and tests PASS11/11 (tests3.log), no relaxed
assertions. Build2 running for changed inventory/API-client/supplier inputs.
Brand b917ff8 CI36350104586 + Security36350104628 both SUCCESS.
Browser acceptance will run all test files in two disjoint batches with a fresh
owned API per batch: authentication/workspace group and remaining product flows.
Reason: previously observed auth429 under accumulated fixture requests; preserve
rate limits and tests. This changes scheduling only, not assertions or coverage.
Remaining CORE-04.5 after current slice: delivery terms UI and complete import
history pagination; new-product operator roundtrip evidence. Do not close row yet.
Final review: tenant boundary remains server-side; search returns only shared
master fields; initial inventory cannot rebind another offer, preserve reserved
and safety quantities; exact minor-unit price conversion; retries retain draft;
publish stays explicit and enforces agreement/admission/compliance. Added source
restriction per ADR012: manual editor cannot edit API/ERP-managed offers.
Build2 PASS10/10; PostgreSQL2 PASS; regular browser batches PASS41+9=50,
38 pre-existing opt-in cases SKIPPED (not claimed as evidence). Changed supplier
source restriction now has targeted typecheck/tests/build/manual browser follow-up;
all unaffected workspace evidence reused. No business data migration.
Supplier source-guard follow-up: typecheck PASS, tests49/49 PASS, production build
and bundle budget PASS; manual browser final PASS1/1. No remaining failed gate for
this bounded slice. Core contract PASS reused: last edits did not change HTTP shapes
or catalogue response inputs. PostgreSQL2 exercised latest inventory implementation.
Review and git diff --check PASS; publish 29 explicit paths, excluding pre-existing
registry/handoff/CORE04/PILOTDOCS/PRIMARY/next-env/flow-a WIP. Full CORE04.5 still open.
088150ad44bd8f63524d61c61ba1cecae221d6b3 pushed; exact remote SHA verified.
CI36351888969/Security36351889033 pending. Same CORE04.5 continues (not next phase):
import history cursor pagination, delivery terms via existing OfferDeliveryOption,
new-draft reset. Contracts first, no new provider/DB model. DoD: scoped cursor/tenant
unit/API, delivery form + buyer visibility, schemas/OpenAPI/client, typecheck/tests,
app builds, contract/browser; existing stock PostgreSQL evidence unchanged.
Questions document remains authoritative for unresolved business choices.
Terms/history slice: typecheck1 PASS12/12; tests1 PASS11/11 (API381, schema125).
Production build1 running. Supplier validator changed to lazy import after
initial typecheck; build typecheck + final targeted check covers exact final input.
Review discovered existing manual-candidate approve produces offer without packaging
and publication record, unlike import approval. CORE04.5 remains open until this
supplier→operator→supplier→buyer path is fixed and browser-proven; do not confuse
CSV/XLSX approval E2E with manual-candidate evidence.
Review of onboarding permissions: real supplier onboarding grants pricing.manage,
delivery.view/manage. Historical seed.ts supplier permission list omits pricing.manage;
record as seed consistency debt for final acceptance, not a reason to alter working
accounts or weaken authorization. Explicit browser fixture permissions are isolated.
Terms build1 PASS10/10 (6m19s), latest supplier lazy validator included; E2E
TypeScript PASS. Contract1 running after build completion (no overlapping build).
Browser follow-up: manual-offer + spreadsheet-import-ui + marketplace/product-login
for affected supplier, history and both buyer comparison surfaces. Full regular50
from prior slice reused for unrelated flows; source changes isolated to terms/history.
088150a CI36351888969 and Security36351889033 SUCCESS (exact published SHA).
Terms core-contract1 PASS90 schemas/30 core operations, response/error validation.
Terms browser1 running on approved DB and latest built apps. No pending previous
slice gate; current remaining manual-candidate gap still prevents CORE04.5 closure.
Terms/history browser1 PASS13/13: actual delivery upsert→buyer product dialog,
exact threshold/fallback price + hours, mobile/desktop history page51, product login
return and marketplace. Owned ports confirmed free; npm lifecycle stderr appeared
only during test-owned shutdown after passes; Playwright exit0, no assertion failed.
Review: no automatic shipment, no provider call, fixed money exact; tenant-scoped
cursor, stable timestamp/id ordering, active warehouse guard, explicit read/save.
No Prisma schema/migration changed. PostgreSQL stock evidence REUSED unchanged
inventory/commerce inputs. Contract/typecheck/tests/build/browser/diff-check PASS.
Ready for scoped terms/history publication; next work remains manual-candidate gap.
83a428c1a618ec1cf8597979abb3c7908ed73831 terms/history pushed, remote exact.
CI pending. Same CORE04.5 candidate roundtrip starts: approval operator-only,
required unit/pack coefficient, active master product/variant + SALE packaging,
hidden DRAFT offer/publication, atomic single decision; supplier own submission
history. Existing proposed API/UI retained where possible, no automatic publication.
Gates: contracts/types/tests, API/admin/supplier builds, disposable PG concurrency,
manual candidate browser supplier→operator→supplier→buyer; no new integrations.
Candidate typecheck2 PASS12/12. Candidate unit1: API384 pass incl4 new risk tests;
1 existing PDF renderer timeout5000ms. Isolated retry2 unchanged test PASS8/8
(3.23s assertions); remaining10 workspaces now run separately, reuse passedAPI.
No renderer/assertion/timeout changes. Current browser test cleanup archives all
owned approved masters even if a later assertion fails. Published83a CI still
in progress at browser step; Security36353212608 SUCCESS.
Candidate remaining unit1: seven workspaces PASS, admin lazy-panel count test
expected16 but new separate lazy panel makes17. Updated explicit module/count
assertion (same lazy-loading rule); admin/buyer/supplier unit2 PASS4/4 tasks.
API384 + isolated PDF8 and remaining workspace passes now cover complete unit set.
Candidate build1 running; no schema migration. Terms83a CI36353212652 SUCCESS,
Security36353212608 SUCCESS. Full published terms/history acceptance confirmed.
Read-only next-phase findings: existing PAYMENT_CONFIRMATION document visibility
requires confirmed PSP payment graph (document-reference-graph.ts). A buyer's
unverified transfer receipt must use a distinct evidence kind/contract, never
relax that invariant or relabel it as confirmed payment. Order confirmation
locks SupplierOrder before checking state; manual payment/cancel transitions
must share that lock and preserve order/invoice version. No next-phase writes yet.
Candidate build1 PASS10/10 (3m38), contract1 PASS99 schemas/35 operations,
PostgreSQL1 PASS transaction/tenant/idempotency/stock regressions. Browser1 running:
manual-candidate + manual-offer + flow-b3 (5 cases). Owned servers from this run;
all ports were free at preflight. No working DB changes.
Correction to next-phase note: PAYMENT_CONFIRMATION accepts a PAID supplier order
as well as confirmed PSP allocations; it still cannot represent an unpaid receipt.
Candidate browser1:4PASS, manual-candidateFAIL at exact required-field label
(Industry includes required marker); operator card/materials loaded. Test locator
changed to scoped label match; no app/timeout/assertion weakened. Browser2 runs
candidate plus import publication/rollback regressions because approval schema
and rejection logic are shared. Build/contract/PG inputs unchanged, passes reused.
Candidate browser2 PASS5/5: manual supplier→operator→supplier→buyer incl real PG
simultaneous approval (201/409, one master/audit), CSV/EXCEL operator publication
and rollback. Browser1 other4 PASS reused. No runtime changes after build/typecheck.
Review: operator-only decision, pending CAS inside transaction, category industry
validation, bounded exact packaging coefficient, hidden unpriced offer; tenant
history keyset. Old duplicate candidate UI removed, other controls preserved.
All local gates PASS. Current candidate publication is next; CORE04.5 waits exactCI.

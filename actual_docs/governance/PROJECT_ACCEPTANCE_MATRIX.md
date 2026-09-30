# PlatformaMarket — актуальная матрица приёмки

Baseline30.09.2026: main@2a816c337bae15f6684318cf26d21bf6f71cb3c5.
Обновление01.10: отдельный согласованный PERFORMANCE-CI-DELIVERY выпуск ниже.
Исторический PASS применим только к своим входам и границе.
Публикация, наличие кода и production readiness — разные состояния.

## Текущее состояние

| Область | Статус | Доказательство / ограничение |
| --- | --- | --- |
| CORE04.1–04.4 | ACCEPTED в ограниченном scope | 278be21; CI36127372917 и Security36127373128 SUCCESS |
| CORE04.5 | ACCEPTED в ограниченном scope | 73ac601; CI36355260705 и Security36355260722 SUCCESS |
| A01–A18, canonical web/API/worker | LOCAL_PASS | Опубликованы в2a816c3; исправления цены/партии/offer/order/UI/TTL/read models и проверки ниже |
| Unified frontend | LOCAL_PASS / live rollout NOT_ACCEPTED | apps/web, canonical build/browser/budget, release api/web и ingress; Docker image build ожидает hosted CI |
| Полный CORE01–09 | NOT_ACCEPTED | Наличие agreement/manual order/auth/operations кода не закрывает Product §23.6 и полный цикл |
| POST-BE / POST-FULL | NOT_ACCEPTED | Отдельные приёмки одной revision/data/environment; не закрываются этим аудитом |
| Optional go_live blocks | COMPOSED / PARTIAL | Локальная видимость не означает полноту продукта, LIVE_VERIFIED или production |
| Production / внешние providers | NO-GO / NOT_ACCEPTED | Требуются выбранные реальные provider/legal/infrastructure receipts |

## Выпуск PERFORMANCE-CI-DELIVERY01.10

[Карточка и журнал попыток](task-state/PERFORMANCE-CI-DELIVERY-2026-09-30.md).
Локальный кандидат основан на2a816c3. Commit/push и новый hosted CI ещё NOT_RUN;
старые CI failures ниже не заменяются предположением о новом PASS.

| Проверка | Фактический результат |
| --- | --- |
| Production dependencies | npm audit --omit=dev --audit-level=high: PASS0; parser controls и isolated security-storage PASS |
| TypeScript / unit | typecheck13/13 PASS; API/E2E последующие typechecks PASS. Составной full unit PASS:443 API сразу, PDF target8/8 после cold-import setup fix, remaining11 package tasks PASS |
| Canonical build / JS budget | `npm run build`:7/7 PASS. public entries23JS/1,118,819raw/340,741gzip максимум; ceilings24/1,500,000/450,000 сохранены |
| Core / PostgreSQL | PASS119 schemas/43 verified operations; PG tenant/rollback/concurrency и новые supplier pages PASS. Один core startup retry с неизменным45s timeout |
| Browser | Canonical38:32 сразу +4 focused PASS после test-only исправлений +2 comparison/login/cart retry на390/1440; FlowB3 canonical7/7 PASS; финальные measurements2/2 PASS |
| Runtime / configuration | Runtime split3roles PASS; production-config и readiness8/8 PASS; Compose/Caddy native validation canonical/legacy PASS; container build локально NOT_RUN, нет Docker engine |
| Документация | Archive305 entries/hash/semantics, active/archive links; финальный diff и protected WIP review перед staging |
| Legacy rollback | Admin build PASS; buyer compile PASS, прежний budget FAIL25/1,733,332raw/481,814gzip. Не основной release gate; legacy release readiness не принята |

Manifest/catalog gzip504557→340740(-32.5%); browser encoded JS466527→429517
(-7.9%). Final local cold TTFB390/1440:23.1/20.8ms против19.5/15.7ms,
ScriptDuration0.230/0.245s против0.161/0.212s: ускорение по времени не доказано.
Все12 samples сохранены; это не production SLO. Admin inventory/import/external
initial GET2→1. Supplier payload на fixture: legacy78165Б, page(limit1)707Б;
объёмы различаются, этот результат не равен latency/load benchmark.

Evidence локально ignored: outputs/performance-ci-20260930; точный состав и
команды сохраняются в карточке. Полный CORE/POST/production этим не принимается.

## A01–A18: исторические проверки

Последующее изменение30.09 — [CI-DATABASE](task-state/CI-DATABASE-2026-09-30.md):
wrapper/CI target и conditional telemetry imports исправлены локально.
PASS: regression14/14 + telemetry7/7, typecheck13/13, составной full unit graph
(один PDF flaky retry), API build, core/PG, runtime split, observability.
Прежние readiness45s/60s FAIL устранены без изменения timeout. Этот fix и
dependency remediation входят в общий выпуск01.10 выше; не выполнять их заново.

| Граница | Фактические последние проверки30.09 |
| --- | --- |
| TypeScript | npm run typecheck — PASS13/13 |
| Полный unit graph | npm exec -- turbo run test --concurrency=1 — PASS12/12; serial execution того же graph |
| Canonical web | npm exec -- turbo run build --filter=@marketplace/web — PASS; API build PASS с неизменёнными последующими входами |
| CORE contract | npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only — PASS114 schemas/38 operations |
| PostgreSQL / runtime split | Последние A12 PASS; reuse обоснован неизменёнными входами последующих A13–A15 |
| A13–A15 browser | Первый24/25; исправлен input label, финальный build3 PASS; focused second run1/1 PASS +24 REUSED_PASS. Это не новый единый25/25 run |
| Workspace volume | playwright.workspace-volume.config.ts через db:test — PASS1/1 на synthetic1000; основные bounded lists/summary, не все legacy endpoints |
| Известные старые unit blockers | Tabster/Vitest снят A18; старые «остановиться на typecheck» не действующая очередь |

Локальные ignored evidence: outputs/workspace-audit-a13-15-verified-inputs.json,
workspace-audit-a12-verified-inputs.json, workspace-audit-a13-*,
workspace-audit-a15-*, workspace-audit-a13-15-*; опубликованный состав —
outputs/publish-20260930-inputs.json и publish-20260930-receipt.json.
Это ссылки на локальные artifacts, не гарантия их наличия в другом checkout.

Измерения synthetic1000: offers68 425Б/p95 26мс; orders22 025Б/p95 22мс supplier
и15мс buyer; current cart318Б/23мс; summary49Б/15мс; render49–160мс.
Они относятся к workspace read endpoints и данной машине/fixture, не ко всему
каталогу, inventory lots, production latency или Lighthouse/Core Web Vitals.

## Опубликованный CI и ограничения

| Gate | Фактический результат на2a816c3 |
| --- | --- |
| [CI36737223743](https://github.com/NikIg228/PlatformaMarket/actions/runs/36737223743) | FAIL, первая попытка; rerun не выполнялся |
| verify109961988677 | Core-contract wrapper выбрал dentmarket_audit_20260914, CI подготовил marketplace |
| postgres-integration109961989049 | 36 migrations применены, затем organization-profile-fixture guard отказал из-за несовпадения выбранной/ожидаемой DB |
| [Security36737223539](https://github.com/NikIg228/PlatformaMarket/actions/runs/36737223539) | Dependencies109961991970 FAIL:2 high/4 moderate (brace-expansion/js-yaml/multer и dependents); CodeQL109961991908 PASS |
| Legacy buyer bundle | FAIL:25 initial JS /1 732 101 raw/481 473 gzip против24/1 500 000/450 000; canonical build не закрывает этот gate |
| CI/release topology baseline | Прежние legacy configs заменены в выпуске01.10; live production parity всё ещё не принята |
| Старый CATALOG-LAYOUT | Исторический5/7,3 попытки; два clinic sticky-header/mobile-panel cases не приняты. После смены menu на link нужны актуальные сценарии, не старые locators |
| FRONTEND-DEMO/header return | Отдельные guest/new-registration return cases были не приняты после3 попыток; новый узкий набор не означает полного PASS |
| Переименование локальной папки | Отложено владельцем, Windows3/3; canonical root не изменён |

Полный текущий остаток с сохранёнными CORE/AUD/POST/EXT IDs —
[Foundation](../backend/DENTMARKET_BACKEND_FOUNDATION_V2.md).
Не переносить архивный следующий шаг в новую задачу. История команд/попыток и
карта архивирования доступны через [Documentation index](../DOCUMENTATION_INDEX.md).
Новые gates выше не переписывают историю прежних FAIL.

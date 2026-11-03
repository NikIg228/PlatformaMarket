# Комплексный аудит PlatformaMarket — 03.11.2026

Статус: отчёт выполненного аудита с явно незакрытыми проверками. Продукт не готов
к общей production-приёмке. Это evidence, не второй backlog и не разрешение на реализацию.

## Вывод

Техническая база main собирается и проходит широкий набор автоматических проверок,
но не реализует весь согласованный продуктовый контракт. Подтверждены три отдельных
дефекта API/состояния, два UI-дефекта и существующие функциональные разрывы.
Полная native/mobile, Linux/container, backup restore, multi-instance и live-provider
приёмка не доказана. Незавершённый Codex Security scan не является security PASS.

Проверка привязана к `4543fd22c92464bb72fe75a627bb225adb921fde`; изменения
этого аудита только документационные и диагностические. Содержательные выводы:

- [Функциональность и известные разрывы](comprehensive-audit-20261103-functional.md).
- [187 требований с источниками, кодом и границами доказательства](comprehensive-audit-20261103-requirements.csv).
  116 строк имеют частичное статическое сопоставление; наличие теста или общий
  зелёный suite не превращены в полную приёмку каждого правила.
- [Разбор42 приёмочных сценариев](comprehensive-audit-20261103-requirements.md):
  существующее покрытие, отсутствующая реализация и недоступные проверки.
- [UI/UX и результаты браузера](comprehensive-audit-20261103-ui.md).
- [Архитектура, инфраструктура, native/mobile inventory](comprehensive-audit-20261103-runtime-mobile.md).
- [Актуализация документации](comprehensive-audit-20261103-docs.md),
  [инвентарь документов](comprehensive-audit-20261103-doc-inventory.csv),
  [архив с manifest](../../history/archive/2026-11-03-audit/README.md).
- [Машинное evidence](comprehensive-audit-20261103-results.json): результаты
  диагностик, browser cases, load/bundle и SHA256 локальных logs/screenshots.

Dev восстановлен штатным `npm run dev` из канонического root: launcher19796,
dev17432, API14732 на4012, Next16356 на3000; health/catalog200.
Собственные диагностические API/web процессы завершены; восстановленный dev
оставлен работающим для владельца. Generated `apps/web/next-env.d.ts` вернулся
к исходному виду, продуктового diff нет. Рабочая БД не мигрировалась/не reseed.

## Итоговый реестр проверок

Ниже итог исполнения координатора; ранний журнал дальше сохранён как история
первого запуска. Prerequisites schemas/API переиспользованы только на неизменном
коде/lock/config. Логи находятся в `.tmp/comprehensive-audit-20261103/`.

| Gate / точная команда | Результат | Что доказано / ограничение |
| --- | --- | --- |
| `npm run build`, оба profile env=pilot | PASS, attempt1,7tasks2m40 | Общий Windows build, не образ Linux |
| `npm run typecheck` | PASS, attempt1,13tasks2m10 | Типы пакетов/приложений |
| `npm test` | PASS2036,7skipped, attempt1 | Unit;7PG cases отдельно ниже |
| `npm run lint` | PASS, attempt1 | Включает UI-contract5tests/474CSS+TSX |
| `node --test scripts/postgres-tool-invocation.test.mjs scripts/production-readiness.test.mjs scripts/frontend-deployment-profile.test.mjs scripts/local-development-profile.test.mjs` | PASS25/25, attempt1 | Контракты профилей/инструментов, не реальная авария |
| `node scripts/verify-production-config.mjs` | PASS, attempt1 | Синтетические guards, не Yandex config |
| `node scripts/verify-runtime-split.mjs` | PASS, attempt1 | API/worker split на локальном runtime |
| `node scripts/verify-pilot-composition.mjs` | PASS, attempt1 | pilot347/go_live382 routes |
| `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs` | PASS, attempt1 | Реальные PG/HTTP tenant isolation, rollback/concurrency/stock, replay и доменные сценарии; test DB |
| Supplemental7PG specs через `db:test`/Vitest | PASS7/7, attempt1 | Пропуски общего unit пройдены отдельно; список в postgres-supplement-1.log |
| `npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs` | FAIL, attempt1 | Скрипт addCartItem не передаёт expectedVersion и получает409; guard продукта не ослаблялся |
| `npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only` | PASS, attempt1 | Отдельный core-contract путь: OpenAPI/shared responses/errors; не отменяет FAIL полного pilot-backend |
| `npm run verify:web` | PASS123, attempt1,5.7min | Pilot browser, смесь real/mock; не все role/locale сочетания |
| `npm run db:test -- exec -- playwright test --config .tmp/comprehensive-audit-20261103/operator-real-diagnostic.config.ts` | PASS3, attempt2,12.2s | Настоящие API/PG operator orders/org/projections; attempt1 failed из-за4113/4012 mismatch harness |
| `npm run build --workspace=@marketplace/web`, оба profile env=go_live | PASS, attempt1 | Новый профиль, оправданная отдельная сборка |
| `npm exec -- playwright test --config .tmp/comprehensive-audit-20261103/workspaces-mock-diagnostic.config.ts` | PASS12, attempt1,49.5s | Go_live documents/messages/support recovery/mobile/keyboard; API mock |
| UI audit diagnostic `ui-audit.config.ts` | 4PASS/2FAIL из6, attempt1 | 2FAIL подтверждают AUD-UI03/04; screenshots/computed сохранены |
| `node scripts/verify-observability-alerts.mjs` | PASS, attempt1 | 7rules/14synthetic vectors/runbook anchors |
| `npm run db:test -- exec -- node scripts/verify-observability-integration.mjs` | PASS, attempt1 | /metrics401 без токена,200 с токеном, PG gauges, отсутствие org UUID в labels |
| `node .tmp/comprehensive-audit-20261103/http-candidates.mjs` | Два дефекта воспроизведены, attempt1 | AUD-SEC01/AUD-API01, реальные HTTP/PG, собственные fixtures очищены |
| `node .tmp/comprehensive-audit-20261103/freshness-race.mjs` | Дефект воспроизведён, attempt1 | AUD-FUNC05, два реальных connections/барьер, fixtures очищены |
| `node .tmp/comprehensive-audit-20261103/read-load.mjs` | MEASURED, не capacity PASS | Ниже результаты; rate limit не отключался |
| `npm audit --json` | FAIL exit1 | 21moderate package records,2advisories;0high/critical. Не21 независимая уязвимость |
| `npm run db:test -- exec -- node scripts/verify-backup-restore.mjs`, object fixture=true | BLOCKED attempt1 | У dedicated test role нет CREATEDB; restore DB не создана, admin config запрошен |
| Linux/container/native/multi-instance | NOT_RUN | Нет доступных проверенных Docker/SDK/device/Redis binary prerequisites; ничего не установлено |

### Производительность и архитектура

Pilot public/catalog bundle:24JS,1,174,223raw/357,516gzip bytes, заданный budget PASS.
Это размер bundle, не Web Vitals или гарантия пропускной способности.
Ограниченный real read-load: Windows8logicalCPU/8GiB, PG17.10,648products/680offers,
pilot/test/development API, workers disabled, один IP, штатный limiter.
Burst300/concurrency20:240HTTP200+60HTTP429,5.467s,p50=381/p95=681/p99=703ms.
Soak60s/concurrency10:7690requests,10HTTP200+7680HTTP429,p95=24ms.
Soak в основном измеряет отказы limiter; его нельзя выдавать за скорость каталога.
Readiness после нагрузки200. Метрики смешанных statuses не равны latency200.
Запись/checkout load, capacity scaling, DB connection saturation и production query
plans не доказаны. Полный load harness также зависит от CREATEDB и содержит drift
expectedVersion; переписывание продуктового скрипта не входило в аудит.

Modular monolith, отдельные API/worker roles, Prisma transactional boundaries и
shared schemas/client сохраняются. Оснований для автоматического перехода к
микросервисам нет. Измерения ограничены локальным профилем; сначала исправить
конкретные state/auth gaps и проверочные scripts, затем измерять выбранный deployment.

## Существенные находки и приоритетный план

Приоритет означает очередность будущей согласованной работы; существующие R-ID
остаются единственным реестром исполнения. План не разрешает изменения продукта.

| ID / приоритет | Факт и влияние | Следующее изменение и приёмка |
| --- | --- | --- |
| AUD-SEC01 / P0 | Anonymous POST sessions/:id/organization меняет activeOrganizationId, затем500. Controller271 не требует actor; undefined убирает userId filter. Нужны известные valid session UUID и допустимый org UUID; accessToken не выдан, account takeover не доказан | Явный actor guard до query и owner-bound session lookup/atomic operation. Anonymous/foreign/revoked requests401/403 без DB mutation; authorised switch и token subject consistency |
| AUD-API01 / P1 | Connector enroll201 выдаёт opaque token, стандартный Bearer heartbeat401, lowercase bearer201. Конфликт identity JWT middleware и connector auth | Единая case-insensitive схема и явное разделение agent/user audience. Real enroll→heartbeat/ack, expired/revoked/foreign token denial; не обходить проверку JWT для прочих routes |
| AUD-FUNC05 / P1 | Freshness worker overwrite: будущий expiry остаётся, FRESH→STALE и PUBLISHED→PAUSED при конкурентном refresh | CAS/lock с повторной проверкой. Двухсоединённый interleaving regression плюс штатная stale-пауза |
| AUD-SEC02 / P1 candidate | Source review MFA не показывает атомарного погашения TOTP timestep. Требует password/bootstrap и перехваченного ещё действующего кода. Dynamic replay не выполнен | Отдельная разрешённая validation; при подтверждении atomic counter/replay denial без поломки recovery. Не включать в confirmed exploit count |
| AUD-FUNC01/02 / P1, R4 | Резерв до оплаты и обязательный PAYMENT_PROOF расходятся с принятыми правилами | Полная П1/state/schema/API/UI + legacy policy version; доказать money/stock/rollback/idempotency. Optional proof отдельно с сохранением manual confirmation |
| AUD-FUNC03/04 / P1, R4–R6 | Старые200bps и новый10% accrual — разные контуры; cash/debt=null, полный ledger отсутствует. Реальное двойное взыскание12% не доказано | Сначала согласованный payment/provider boundary, затем ledger/allocations/returns/disputes/monthly docs. Пример полного receipt/refund/cash без двойного дохода |
| AUD-UI01/AUD-FUNC07 / P1, R3 | ERP self-service заменён заявкой в поддержку | UI обеих ролей + capability/auth/first-sync/recovery + live выбранная конфигурация. Support-ticket не критерий подключения |
| AUD-UI02 / P2 | KK календарь внутри русского shell/tabs; локализация частичная | Закрыть RU/KK strings и locale propagation на выбранных flows; representative mobile/desktop/layout. EN отложен, не считать дефектом |
| AUD-UI03 / P2 | Blocking cart error исчезает через5.6s, retry остаётся без объяснения | Persistent inline error + transient toast только как feedback;503/retry/recovery с сохранением состояния |
| AUD-UI04 / P2 | Shared input placeholder hover4.475422<4.5 | Исправить shared token/adapter, representative consumers screenshot/computed/keyboard; без локального override |
| AUD-FUNC06 / P2, R3 | MANUAL48h не равен рабочему календарю freshness | Принятая calendar policy, timezone/weekend/day-boundary tests; не смешивать с order-response SLA |
| AUD-TEST01 / P1 | Pilot/load scripts отстали от expectedVersion | Контрактное обновление harness, затем полный штатный gate; текущий FAIL остаётся видимым |
| AUD-DEP01 / P2 | npm audit: glob/minimatch2advisories,21affected records | Проверить reachable vulnerable call patterns/versions и минимальный совместимый patch; lock diff+affected checks, не массовое upgrade |
| AUD-MOBILE01 / P1 release | Native source на divergent branch, release debug-signing/local id, старый APK не доказывает текущую сборку | Отдельно согласовать canonical Git integration, release identities/signing, Android/iOS build+device matrix; не merge в рамках аудита |

Дополнительные незакрытые требования: B2C checkout/receipt, агентская программа,
live payments/carriers/NCA/CRM, полный документооборот и финансы оператора.
Они описаны в функциональной матрице; зелёные внутренние tests их не реализуют.
AI confirmation race остался непроверенным кандидатом, не доказанной эскалацией.

### Граница security

Проверены bounded source paths, зависимости, existing auth/tenant/PG tests и две
отдельные HTTP-гипотезы. Это не exhaustive security certification. Запущенный
Codex Security scan `e1f14291-11be-4753-a972-52b58f43988e` на момент последней проверки
остаётся discovery/running, только provisional threat model; sealed report отсутствует.
0findings в незавершённом scan не означает отсутствие уязвимостей.
Автоматическая проверка безопасности отклонила динамическую проверку MFA replay
как потенциально рискованную cybersecurity-операцию. Через другие инструменты
она не повторялась. Полное security направление остаётся ограниченным.

### Порядок доведения до production

1. Изолированно исправить AUD-SEC01/API01/FUNC05 и drift тестов с regression;
   затем закрыть targeted auth/state/API gates без ослабления требований.
2. По принятому roadmap замкнуть order/payment/stock, ledger и необходимые UI;
   dependencies: provider/legal choices → contracts → backend → UI → real evidence.
3. ERP/CRM и документы/live providers принимать по выбранным реализациям,
   не generic adapter/mock PASS. Внешние реальные операции требуют отдельного scope.
4. RU/KK/recovery/shared contrast и native release принять на реальных устройствах.
   Refactor только после конкретного риска/измерения, не новый общий cleanup.
5. Выбрать Yandex region/services/network/DB/storage/queue/secrets/TLS topology
   и ownership. В этом аудите нет resource sizing, цен или выбранных managed services.
   На разрешённом Linux runner: image build без публикации, migrations upgrade/
   startup race, restart/shutdown, multi-instance limiter/queue, bounded write load,
   restore DB+objects+keys/queues и фактические RPO≤5min/RTO≤2h.
6. Только после evidence всех live/operational условий отдельная release-приёмка.
   Локальный build/CI/этот отчёт не разрешают deploy или работу с реальными деньгами.

## Поручение и границы

Переданное владельцем поручение из чата «Менеджер»: доказательный аудит требований,
функциональности, UI/UX, безопасности, архитектуры/производительности, mobile,
эксплуатации и всей технической документации. CRM изучается только в части
межпроектных контрактов read-only. Исправления продукта — планом; разрешены отдельные
диагностические материалы и изолированные проверки, актуализация/архивирование docs.
Без изменений product code/config/dependencies/рабочей БД, реальных внешних операций,
покупки ресурсов, push/merge/deploy. Собственные проверенные docs — локальные коммиты.
Целевая облачная среда: Yandex Cloud; ресурсы/регион ещё не выбраны.

Владелец подтвердил: «Изменения сохранены, исполнители приостановлены».
Существующие dev-процессы не остановлены этим подтверждением и принадлежат прежним
запускам; нельзя считать их тестовой средой или завершать без отдельного основания.

## Зафиксированная база

- Канонический root: `C:/Users/user/Desktop/dentmarket-kz-main`.
- Branch: `main`; HEAD: `4543fd22c92464bb72fe75a627bb225adb921fde`.
- Исходный tracked WIP: `actual_docs/governance/task-state/PRIMARY-SESSION.md`
  (+204 строки), `apps/web/AGENTS.md` (уровень заголовка). Сохраняется без staging.
- Исходный untracked: `output/CRM_ALERT_COMPONENTS_SPEC_2026-11-02.md`,
  `output/catalog-controls-20261031/`, `output/roadmap-coverage-review-20261029.md`,
  `output/security-remediation-20261028/`, `output/stand-access-20261029/`,
  `output/stand-access-live/`, `output/storefront-review-20261031/`.
- Node `v24.18.0`; npm `12.0.1`; packageManager заявляет `npm@11.16.0`.
  Отличие фиксируется как вход, само по себе не дефект приложения.
- Runtime evidence старых П01–П03 — историческое, не новый PASS аудита.
- П04/V16: продуктовая реализация не продолжалась; вопросы остаются открытыми.

## План проверки до исполнения

Изменяемое поведение продукта: отсутствует. Главные риски проверки: запись в
рабочие данные, конфликт dev/build artifacts, внешние side effects, смешение mock
и live evidence, принятие старого PASS за новую сертификацию.

1. Инвентарь источников/маршрутов/модулей/mobile/scripts; приоритет последних решений
   владельца, объединённого ТЗ, доменных контрактов и roadmap.
2. Матрица требование → источник → code/API/UI → проверка → результат → разрыв.
3. Source-backed функциональный/security review, независимая перепроверка high/critical.
4. Проверить prerequisites и изоляцию; выбрать общие build prerequisites один раз.
   Unit/types/lint, PostgreSQL/контракты/rollback/concurrency, runtime/guards, browser,
   production/build/containers, backup/restore и измерения нагрузки по реальным scripts.
   Точные команды фиксируются перед запуском; опасные scripts на dev не запускаются.
5. UI: дизайн-контракты, RU/KK и применимость EN, desktop/mobile/keyboard, состояния;
   mobile browser отдельно от native/emulator/device.
6. Docs consistency/link inventory, подтверждённые исправления, журнал перемещений
   при архивировании; никаких изменений требований под реализацию.
7. Единый реестр findings, приоритетный план с dependencies/acceptance, ограничения
   и условия проверки будущей Yandex Cloud среды. Diff hygiene и scoped docs commit.

Критерий завершения: вся матрица имеет итог/объяснённое ограничение, существенные
требования сопоставлены, находки проверены, evidence привязано к версии, docs проверены,
план исправлений готов. Один scan/CI/отчёт не закрывает весь аудит.

Бюджет одной probe: 2 минуты; start: 5 минут; отдельный build/test: 20 минут;
suite: 45 минут. До 3 попыток на gate, повтор только с причиной. Нагрузочный finite
budget определяется после чтения scripts. Отдельные ограничения не останавливают
независимые направления комплексного аудита.

## Реестр запусков

Владелец отдельно разрешил остановку и восстановление Market dev. Проверенное
дерево launcher7196 → dev17192 → API22748/web17748 остановлено; порты3000/4012
освобождены. Восстановление обязательно после проверок, рабочая БД не меняется.

Lockfile SHA256: `AFF3AFF242F95339E3BC2BE24FE7584859AC65EFE87187E008C23A2134FCE721`.
Read-only SQL подтвердил отдельную `127.0.0.1:5432/dentmarket_audit_20260914/public`,
PostgreSQL17.10 Windows; последняя migration `20261103000000_order_response_sla`
завершена. Dev marketplace не является целью тестов.

Первый общий prerequisite: `DEPLOYMENT_PROFILE=pilot NEXT_PUBLIC_DEPLOYMENT_PROFILE=pilot npm run build`
(PowerShell env assignments), попытка1, budget20min. Проверяет реальную сборку
schemas/client/API/unified frontend и даёт artifacts для следующих gates.
После build: общий typecheck/unit/lint по текущему SHA; DB scripts выполняются
последовательно через существующий wrapper, повторный API build не нужен при
неизменных inputs и уже пройденных prerequisites alias. Browser pilot и go_live
учитываются отдельно. Логи: ignored `.tmp/comprehensive-audit-20261103/`.
Продуктовые исправления запрещены scope.

### Выполнение первой группы

| Gate | Команда | Попытка/результат | Граница |
| --- | --- | --- | --- |
| Pilot build | `npm run build` с обоими profile env=pilot | 1 PASS, 7 tasks, 2m40 | Windows artifacts; не Linux/live |
| Types | `npm run typecheck` с profile=pilot | 1 PASS, 13 tasks, 2m10 | Один schema build cache hit |
| Profile/restore contracts | `node --test scripts/postgres-tool-invocation.test.mjs scripts/production-readiness.test.mjs scripts/frontend-deployment-profile.test.mjs scripts/local-development-profile.test.mjs` | 1 PASS25/25 | Contract tests, не restore rehearsal |
| Production guards | `node scripts/verify-production-config.mjs` | 1 PASS | Synthetic config; не целевая Yandex среда |
| Unit | `npm test` | 1 RUNNING | 45min budget, общий suite разрешён audit scope |
| Runtime split | `node scripts/verify-runtime-split.mjs` | 1 RUNNING | Build prerequisites PASS выше |
| HTTP candidates | `node .tmp/comprehensive-audit-20261103/http-candidates.mjs` | 1 completed, два дефекта воспроизведены | Real HTTP+PG, synthetic fixtures cleaned, go_live/test/jwt |

HTTP evidence: anonymous session organization switch →500, но DB active organization
изменена; access token не возвращён. Требуются известный active session UUID и
допустимый organization UUID. Agent enroll201 → Bearer heartbeat401, bearer heartbeat201.
Результат сохранён в `http-candidates-result.json`, воспроизведение в одноимённом mjs
в ignored evidence directory. Это не PASS ожидаемого поведения.

Следующий DB gate: `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs`,
attempt1, budget45min, последовательный на проверенной auditDB. Эквивалент
`verify:postgres`: schemas/API build уже PASS на неизменённых исходниках. Script
применяет миграции только в auditDB, создаёт/убирает синтетические fixtures.

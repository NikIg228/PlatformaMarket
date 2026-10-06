> ARCHIVE · снимок до пересборки06.10.2026. Старые статусы, команды и следующие шаги не являются текущим поручением. Требования: [описание проекта](../../../../../PROJECT_OVERVIEW.md); остаток: [roadmap](../../../../../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md). Приёмка ограничена указанными в исходном тексте версиями.

# PERFORMANCE-CI-DELIVERY — согласованный выпуск

Обновлено: 01.10.2026 01:42+05:00. Состояние: CLOSED — опубликовано, CI/Security PASS.
Владелец: 01a0f302-2d38-75d1-b79c-141e7428b533, единственный writer.
Основание: владелец30.09 разрешил весь перечисленный объём за один проход,
без промежуточных подтверждений, с проверками и push после всех проверок.
Checkout: C:\Users\user\Desktop\dentmarket-kz-main; main@75e0e21bca206c05c4eb76fc2477fd872d384973.
Исходный baseline:2a816c337bae15f6684318cf26d21bf6f71cb3c5.

Fix75e0e21 опубликован и remote SHA подтверждён. Hosted container attempt2
PASS api/web. [Security36772750368](https://github.com/NikIg228/PlatformaMarket/actions/runs/36772750368)
PASS dependencies и CodeQL. [CI36772750254](https://github.com/NikIg228/PlatformaMarket/actions/runs/36772750254)
SUCCESS: verify110082987071, postgres-integration110082986692, api110082986928,
web110082987231. Hosted typecheck13/13, полный unit graph, build7/7, JS budget,
core/runtime/production/extended API PASS; FlowB3 7/7 и canonical browser38/38
PASS едиными запусками. PostgreSQL включает authority и backup/restore.
DoD согласованного выпуска закрыт. Production deploy, полный CORE и legacy
release readiness не принимались. Рабочая БД и чужие процессы не менялись.
Собственных процессов/незавершённых Git-операций нет; пять исходных WIP сохранены.
Итоговый docs-only receipt переиспользует gates75e0e21 по Workflow4.2: код,
lockfile, fixtures и CI конфигурация не меняются. Для него проверены ссылки,
согласованность статусов и diff; [skip ci] предотвращает повтор полного runtime
набора только из-за записи результата. Следующий продуктовый scope не открыт.

Публикация01.10 01:24+05:00: commit8045225adbffa1d825366865676bce5d509abe9d
отправлен обычным push в origin/main; remote SHA подтверждён. Staged review,
diff check, docs414 active/481 archive links/305 archive entries PASS; E2E final
typecheck PASS. Пять исходных dirty files остаются вне commit. Исторический
Markdown hard break в snapshot Product записан эквивалентным backslash вместо
двух пробелов, отражён в manifest; содержание и semantic hash сохранены.
[CI36772413966](https://github.com/NikIg228/PlatformaMarket/actions/runs/36772413966)
и [Security36772413883](https://github.com/NikIg228/PlatformaMarket/actions/runs/36772413883)
IN_PROGRESS, attempt1. Не считать их PASS до результата. Ни release, ни deploy
не запускались. Следующий шаг — дождаться jobs и разобрать фактический сбой,
если он появится, в пределах прежних лимитов.

Hosted container attempt1 FAIL обоих targets в npm ci: test-only
redis-memory-server postinstall компилирует Redis, Alpine не содержит make.
Исправление: только RUN npm ci получает поддерживаемый пакетом
REDISMS_DISABLE_POSTINSTALL=true. Runtime использует внешний Redis; другие
lifecycle scripts не отключены. TypeScript/application inputs прежние;
следующий container build — attempt2, до3 на этот gate. Docker engine локально
по-прежнему отсутствует; owning check выполняется hosted CI.

## Scope / DoD

1. Исправить подтверждённые dependency advisories без смены стека.
2. Перевести основной CI/browser/build/budget на apps/web; согласовать
   Release/Docker/ingress конфигурацию. Production deploy/tag/release не входят.
3. Отделить публичный каталог от кабинета; измерить до/после на одинаковых
   dependencies. Сохранить фильтры, URL, сравнение, корзину и возврат после входа.
4. Ограничить supplier offers/inventory reads серверной пагинацией и отдельным
   чтением партий/резервов при раскрытии. Сначала shared contracts, затем API/UI.
5. По измерениям разделить крупные admin components внутри lazy sections;
   отменять ненужные GET, проверить повторные запросы/рендеры, публичный dynamic
   boundary, shared imports; выделить конкретные backend operations с сохранением
   транзакций и tenant checks. Изменения должны устранять подтверждённый риск.
6. Review полного outgoing scope; обязательные gates PASS, commit/push main,
   remote SHA и фактический CI. Не объявлять PENDING успешным результатом.

Последнее состояние01.10: canonical browser38/38 составной PASS, включая
две проверки comparison/login return/cart retry на390/1440. Journey attempt1
FAIL2: свежий login запускал асинхронное определение города одновременно с
переходом назад; после submitting фокус находился вне dialog. Attempt2 PASS2,
21.8s: задан одинаковый deliveryCityId до/после login, Escape отправляется
сфокусированной кнопке диалога. Это детерминизация окружения/клавиатурного действия,
не исправление delivery provider. Существующая гонка быстрого возврата при
автовыборе города требует отдельного разбора; сценарий без явного города не
считается проверенным этой парой tests. UI business source не менялся.
Canonical FlowB3 PASS7/7,23.3s с новым
operator JWT fixture; E2E typecheck и delivery config tests2/2 PASS. Canonical
build prerequisites переиспользованы без изменений runtime source/dependencies.
Выбранные локальные runtime gates завершены, все собственные sessions/listeners
закрыты. Fetch origin:HEAD...origin/main0/0. Финальный review/staging/push/CI впереди.
Исторические RUNNING/NOT_RUN записи ниже перекрыты этим checkpoint, не команды
для повторного запуска. Generated apps/web/next-env.d.ts возвращён к исходному
состоянию; пять защищённых исходных dirty файлов остаются вне публикации.

Сохраняются docs reconciliation и CI DB/telemetry changes предыдущих задач.
Их исходные результаты: [CI-DATABASE](CI-DATABASE-2026-09-30.md),
[DOCS-AUDIT](DOCS-ARCHITECTURE-AUDIT-2026-09-30.md).
Чужой исходный WIP: registry и четыре legacy next-env.d.ts — не менять/не stage.
Новые worktrees, агенты, рабочая БД и чужие процессы не разрешены.

## Проверки / лимиты

До проверок фиксировать inputs и attempt ledger. На каждый blocker максимум3
попытки по Workflow; общий запрос без дедлайна не отменяет bounded commands.
Минимум: typecheck, full unit, diff check; dependency audit/security storage;
canonical web build/browser/budget; core contract/PostgreSQL для paging;
runtime split для API; production-config/readiness для deployment configuration.
Повторно использовать неизменные prerequisites по Workflow4.2. Проверки с
записью только на disposable audit DB после guard/preflight.

## Выполнено / текущее

Preflight восстановлен: canonical root/main/HEAD, primary generation4/idle,
index пуст; прежний WIP сохранён. Baseline hashes: outputs/performance-ci-20260930/input-baseline.json.
Production npm audit baseline:7 advisories (1critical,2high,4moderate).
Пакеты: Next16.3.3, grpc1.14.4, brace-expansion1.1.18/2.1.4,
js-yaml5.3.0, multer2.3.0. Component advisories не доказывают exploitability
конкретного deployment. Проверяются direct callers и patched releases.
Evidence текущих команд: outputs/performance-ci-20260930 (ignored).
Integration/push/новый CI: NOT_RUN. Собственных running процессов нет.
Обновлены Next16.3.8 root+5apps, grpc1.14.5, brace1.1.21/2.1.7/5.0.12,
YAML5.4.1, multer2.4.0 и lock. npm install attempt1 оставил stale transitive
lock resolutions (audit4); targeted npm update пересчитал их, audit attempt2
PASS0 и npm ls PASS. Других version changes нет, только2 удалённых transitive
dependencies multer. ignore-scripts не заменяет compatibility gates.
Parser controls PASS: YAML empty merge budget и ordinary parse; brace обе
production branches ordinary + malformed rewrite/comma. Security storage на
audit DB PASS (0configs,0plaintext; не проверка реальных provider credentials).
Полная baseline build `npm run build`: 7/7 tasks PASS,6m47s; shell session95829
ещё возвращает running после summary, дождаться завершения/owned cleanup.
Prisma generate6.19.3 PASS, API/schemas prerequisite больше не stale.
Canonical manifest baseline:28 JS,1,845,677raw,504,557gzip(/catalog), budget
сохранён24/1,500,000/450,000. Это baseline measurement, не budget PASS.
Новый scripts/verify-web-bundle.mjs измеряет обе public entries и fail-closed CI.
Canonical E2E config теперь owned API4012/web3000, jwt/pilot/audit DB guard,
reuseExistingServer=false. Новый performance spec:3cold/warm samples390/1440.
Baseline browser measurement session20470 RUNNING, startup PASS,2 tests.
## Checkpoint01.10 / после каталога

Baseline browser attempt1 FAIL: catalog-search404, public buyer default ID отсутствует
в audit DB. Новый run-canonical-browser.mjs проверяет цель/connected DB и читает
активного synthetic buyer, передаёт его ID API; никакого seed/dev attachment.
Attempt2 PASS2, но list reporter не сохранял inline JSON attachments. Attempt3
с явным testInfo.outputPath/writeFile PASS2,12 samples390/1440 cold/warm.
Все baseline artifacts сохранены в outputs/performance-ci-20260930/before-catalog-*.json.
Full build session95829 завершён exit0, прежний RUNNING снят.

PublicCatalog выделен в feature entry + usePublicCatalog + pure public query;
не загружает buyer-workspace/orders/documents/services, сохраняет общий CompactCatalog,
карточки, filters/dialog/quick offers. Media helper общий с legacy buyer-workspace.
Unit targeted PASS11/11 (query, URL, paging/error controls). Web build PASS.
Budget attempt1 FAIL25files/464573gzip после split. Provider вынесен в отдельный
UI export; attempt2 FAIL26/464676 (сам по себе provider не уменьшил граф).
Доказанная причина: document-upload-model импортировал одну константу из полного
CommonJS schemas. Narrow document-upload-limits export + frontend-routes export
сохраняют semantics; build PASS, budget attempt3 PASS23files/1,118,829raw/340,746gzip.
Ceilings24/1,500,000/450,000 не повышались.
Browser final catalog scope PASS5/5:12 measurement samples +390/1440 pages/filter
draft/Escape/focus/48-card return/history/no workspace reads +late-response test.
Baseline и after одинаковые Next16.3.8/pilot/audit DB, production builds.
Manifest gzip504557→340746(-32.5%); фактический browser encoded JS466527→429232
(-8.0%, включает динамические session chunks). Не смешивать эти две метрики.
Local cold TTFB median390:19.5→14.6ms,1440:15.7→8.6ms; ScriptDuration390:
0.161→0.139s,1440:0.212→0.146s. Это локальные3 samples, не production SLO.
Summary/catalog raw JSON и build/browser logs — outputs/performance-ci-20260930.
Все собственные build/browser sessions завершены; listeners3000/4012 отсутствуют.

Canonical CI draft: e2e default теперь runner+unified config; e2e:legacy оставлен.
Основной verify:web и budget смотрят apps/web. FlowB3 остаётся явно названным
legacy import compatibility gate: его покрытие не удалено, собственная alias
собирает legacy как rollback evidence. Новый canonical default tests:
unified-application, public-catalog, workspace-rebuild, supplier-capabilities.
Старые unified selectors согласованы с уже существующим account link вместо menu.
Full canonical suite ещё NOT_RUN. Release draft matrix api/web; production compose
и Caddy один WEB_DOMAIN +same-origin/api; прежняя topology сохранена в
compose.production.legacy.yaml +infra/Caddyfile.legacy. Dockerfile добавляет e2e
workspace manifest в npm-ci layer. Конфигурационные tests PASS2/2, release origin
HTTPS/same-origin redirect validation. Реальный Docker/Caddy CLI не найден на PATH;
Compose/Caddy native validation пока NOT_RUN, нужен portable tool или CI evidence.
Production deployment/tag/release НЕ выполнялись.

Public static rendering review: root connection() обеспечивает per-request nonce
из apps/web/proxy.ts. У всех HTML/RSC private,no-store, CSP script nonce.
Просто убрать connection() или разрешить public cache сломает nonce/ослабит
границу. Решение: сохранить динамический root; отдельная hash/SRI cache policy
не входит в этот performance выпуск. Проверка статуса не объявляет cache ускорение.

Следующий шаг: bounded supplier corrections/inventory contracts/read model/UI,
затем GET cancellation/admin decomposition/backend use case и общие gates.
Typecheck/full unit/core/PG/runtime/canonical full browser/production gates для
всего нового change set пока NOT_RUN. Commit/push/index по-прежнему отсутствуют.

## Checkpoint01.10 / реализация и общие gates

Новые shared Zod/OpenAPI/client reads: correction-offers, inventory summaries,
inventory/:balanceId/lots и reservations, inventory-overrides. Каждый запрос
проверяет SUPPLIER capability + guard permission, tenant predicate и take=limit+1
(UI25, максимум100), timestamp/id cursor привязан к tenant/type/filter/parent.
Детали сначала проверяют владельца balance, затем отдельный child tenant filter.
Legacy endpoints сохранены. Corrections удерживает выбранный product/draft при
смене страницы; inventory читает детали только при раскрытии, отдельно pages.
Unit isolation/select/cursor PASS5/5, typed client abort/cursor PASS2/2.
Реальный PG contract/paging/foreign-parent test добавлен в verify:postgres;
OpenAPI assertions расширены. Эти runtime gates ещё NOT_RUN.

useResource передаёт AbortSignal и отменяет уходящий GET; forwarding внедрён
в workspace orders/offers/summary/permissions/auxiliary lists. Writes и cart
loader с POST validate не получили транспортную отмену/новые retries.
Admin SupplierOperations разделён на четыре панели + hook/types внутри прежнего
lazy section. Baseline browser attempt1 FAIL из-за неправильной формы фикстуры
соседних widgets; исправленная fixture attempt2 PASS1. Измерено2 GET для balances,
import-batches, external-items при первом открытии. Устранена повторная загрузка
при выборе первого supplier; новый after test требует1, ещё NOT_RUN.
CommerceService.createCart делегирует конкретную createActiveCart operation;
authorization/profile остаются до вызова, cart+audit одна прежняя transaction.
3 новых unit-теста PASS в общем API прогоне. Рефакторинг не заявляет ускорение API.

Общий typecheck attempt1 PASS13/13,1m1s (до PDF test setup change).
Full npm test attempt1: API443PASS/1FAIL (PDF.js cold import превысил5s),
остальные пакеты turbo прервал. Это ранее наблюдавшийся setup timeout, не
регрессия PDF content. PDF.js import перенесён в beforeAll с30s setup budget;
все assertions и5s deadline самих тестов сохранены. Target retry2 PASS8/8,5.6s.
Незавершённая часть `turbo test --concurrency=2 --filter=!@marketplace/api`
PASS11/11,1m35s. Итог unit graph — составной PASS, не выдуманный exit0 npm test.
API typecheck для изменённого test setup ещё требуется. Логи unit-1,
pdf-unit-2, unit-remaining/typecheck-1 в outputs/performance-ci-20260930.

Native configuration PASS: Compose5.5.1 config --quiet для canonical/legacy,
Caddy2.10.2 adapt --validate для обоих ingress; только example domains/env,
никаких служб/сертификатов/production writes. Official portable binaries в
Temp/platformamarket-delivery-tools-20261001, composeSHA256/CaddySHA512 сверены.
Acquisition attempt1 исправлен byte[] decoding sidecar; attempt2 распознал
128hex SHA512 вместо SHA256; attempt3 checksum+extract PASS. Бинарники не в git.
Caddy multiline syntax исправлен; legacy topology сохранена явно. Docker context
исключает env/secrets/local artifacts; API image больше не собирает Next.
CI добавляет native production config checks и api/web container build без push.
Docker engine локально отсутствует: image build ожидает CI, не локальный PASS.
Release namespace нормализован lowercase; реальный tag/release не создавался.

Full final build attempt1 RUNNING (session56229), pilot; ports3000/4012 перед
стартом свободны. Новый полный canonical
browser/budget, core/PG/runtime/production gates ещё NOT_RUN. Commit/push нет.
Все прежние build/browser/unit sessions завершены, кроме текущей final build.

## Решения и открытые вопросы выпуска

Checkpoint01.10 00:52+05:00: final build56229 завершён exit0,7/7,4m32s.
Budget final PASS23JS/1,118,819raw/340,741gzip; ceiling прежний.
API typecheck после PDF setup change PASS. Delivery script tests12/12 PASS,
production-config PASS, production-readiness8/8 PASS. Runtime split31388 exit0:
3roles/entrypoint/production-all checks PASS на финальном build.
Core contract attempt1 FAIL readiness45s до проверки контракта, без startup logs
при warn; одновременно шёл runtime probe и завершение build cache. Новая гипотеза
для одного transient retry — конкуренция запуска на8GB машине (есть чужой
PlatformaCRM browser/dev, их не трогать). Attempt2 запущен отдельно с LOG_LEVEL=info,
timeout45s неизменён, session72046 RUNNING, core-contract-2.log. Не повторять
инструментальный telemetry fix: он сохранён и runtime split доказан. PG ещё
NOT_RUN: последовательная команда остановилась на core FAIL, session50759 exit1.
Все остальные sessions завершены. Нужны core outcome, затем PG/full browser,
финальные catalog measurements, review/docs evidence и публикация/реальный CI.

- Публиковать отдельные этапы или весь выпуск? Последний запрос: push только
  после всех проверок; логические commits допустимы после соответствующих gates.
- Как сравнить каталог при обновлении Next? Baseline после security update,
  до application split; одинаковые build/runtime/profile/data для сравнения.
- Нужны ли реальные внешние сервисы/production deploy? Нет, scope конфигурации
  и локальных disposable проверок; живые интеграции не добавлять.
- Независимые агенты? Не разрешены AGENTS; security review отдельными self-pass.

## Практики

Уточнение01.10 01:08+05:00: legacy admin build PASS, buyer compile PASS, но
встроенный legacy budget FAIL25/1,733,332raw/481,814gzip (тот же исходный
blocker; лимиты не менять). Оставить verify:flow-b3 с legacy build в основном
CI означало бы незавершённый canonical переход. FlowB3 перенесён на собственные
API/web3000; operator browser получает настоящий session-bound fixture JWT,
API-only assertions сохраняют development headers на isolated API как прежде.
Все7 tests и проверки publication/rollback сохраняются. Старый вариант и его
budget сохранены отдельным verify:flow-b3:legacy; его PASS не заявляется.
Новые prerequisites: финальная canonical build неизменна, test/config typecheck
и delivery tests, затем полный FlowB3. Результат ожидается, не обход FAIL.
Final catalog measurements PASS2/2,12samples. Browser encoded JS466527→429517
(-7.9%), manifest504557→340740(-32.5%). Final cold TTFB390/1440:
23.1/20.8ms против19.5/15.7ms; ScriptDuration0.230/0.245s против0.161/0.212s.
Нагрузка машины неконтролируема; временное ускорение не доказано. Сохранены
все before/after/final измерения, не выбирался только быстрый запуск.

Checkpoint01.10 01:00+05:00: core-contract attempt2 PASS; PostgreSQL attempt1
PASS (session19575 exit0), включая все новые supplier reads, cursor/tenant/role
проверки и прежние checkout/rollback/concurrency invariants. На fixture:
legacy inventory JSON78165bytes; summary page(limit1)707bytes; это разные
объёмы данных, не сравнение latency или production нагрузочный результат.
Canonical browser attempt1:32PASS/4FAIL. Две старые supplier fixtures ожидали
legacy nested inventory вместо новых endpoints/раскрытия; corrections locator
getByLabel exact не совпадал с required label; logout test прерывал revoke
немедленным goto. Исправлены только fixtures/ожидания/role locators, не бизнес-код.
Targeted retry PASS4/4,44s; весь набор36 имеет составной PASS. Ошибка передачи
--grep через npm alias (Unknown cli flag) произошла до запуска браузера;
исправленный вызов db:test run e2e --workspace=... -- --grep выполнен один раз.
Browser evidence canonical-browser-1/2/2b.log. Admin измерение подтвердило
inventory/balances, import-batches и external-items2→1 GET, after JSON сохранён.
Docs verification: archive305 entries/hash/semantics, active links409 и archive
links481 сохранены; один FAIL command mention `build:7` — исправлена пунктуация.
Checker защиты ограничен пятью исходными чужими файлами, поскольку код теперь
меняется по новому разрешению; прежняя проверка docs-only всего кода неприменима.
Финальный performance measurement идёт отдельно от build/других browser gates.
Следом legacy FlowB3 compatibility, финальный review/docs и Git/CI.

Development toolkit execution/backend/frontend/performance/verification/review;
Agency Code Reviewer/Git Workflow Master; UI standard. Security dependency fix
использует fix-finding: source-to-sink, compatibility, отдельный review pass,
focused substitute (audit), затем owning checks. Не полный security scan.

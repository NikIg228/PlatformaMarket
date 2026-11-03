# Исправления по аудиту03.11 — выполнение04.11

Статус: LOCAL_PASS первого блока; общий реестр исправлений остаётся открытым.
Владелец разрешил начать реализацию исправлений из реестра.
База main@36081f0427bf8a6d52917536e5c02109a659843b, единственный canonical root.
Исходные PRIMARY-SESSION.md/apps/web/AGENTS.md/output изменения сохраняются.
Реестр аудита и его незакрытые проверки не объявляются исправленными заранее.

Порядок: SEC01 → API01 → FUNC05 → TEST01; затем независимые UI/config исправления.
Крупные функциональные разрывы требуют соблюдения принятых доменных контрактов;
невыбранные денежные/provider/юридические решения не подменяются реализацией.
Native ветка не переключается/не сливается автоматически, рабочая БД не меняется.

Первый блок: отсутствие actor не должно приводить к запросу/изменению сессии;
агентский токен должен обрабатываться своим контроллером без доверия к identity
headers; конкурентный refresh не должен быть затёрт stale worker.
Риск высокий: auth/shared middleware/tenant и конкурентные остатки.
Контракты запроса и успешного ответа сохраняются. UI не требуется для этих
серверных исправлений: существующие действия и отображаемые результаты сохранены.

После каждого поведения — focused Vitest. Завершение блока: API types/build,
реальный HTTP happy/anonymous/foreign/revoked token, isolated PostgreSQL и race,
core-contract и runtime split по влиянию; diff hygiene и review callers.
БД только проверенная dentmarket_audit_20260914 через штатный db:test wrapper.
До3attempts/gate; повтор только после релевантного изменения. Чужие процессы не
останавливаются; ранее разрешённый dev stop/restoration только при конфликте artifacts.

Применены fix-finding (граница и совместимость), Development Toolkit backend/
verification и Backend Architect (минимальная серверная граница, транзакционные
инварианты). Независимые перспективы review выполняются отдельными проходами
основного исполнителя: пользовательские правила запрещают делегирование без
отдельного поручения. Заблокированная MFA dynamic probe не повторяется.

Публикация: предыдущий аудит явно оставлен local-only. Outgoing range включает
его коммит; до любой публикации нужно отдельно разрешить включение этого коммита.

UI03/04 passport: market-components-v1/platforma-semantic-light-v1, Manrope14,
controls44/32/radius8; геометрия и палитра сохраняются. Blocking cart error использует
существующий ErrorState presentation=inline. Shared Input/Textarea placeholder
использует существующий text.secondary вместо text.muted для контраста hover.
Проверки: web/UI types/build, shared UI contracts, cart503 после5.6с+recovery,
Input/Textarea rest/hover/focus computed contrast и screenshots desktop/mobile.
## Результат текущего блока

LOCAL_PARTIAL; общая задача исправлений не завершена, commit/push не выполнены.

- AUD-SEC01: actor обязателен до чтения; lookup и update ограничены владельцем,
  ACTIVE и expiry; конкурентный revoke запрещает запись. Новый token формируется
  до изменения сессии, subject берётся из проверенной сессии.
- AUD-API01: agent heartbeat/claim/ack используют собственную проверку токена;
  middleware удаляет недоверенные identity headers и не интерпретирует agent token
  как user JWT. Bearer регистронезависим; прочие routes сохраняют JWT/session guard.
- AUD-FUNC05: stale transition выполняется с CAS по версии/source/sync/expiry;
  пауза и audit/outbox относятся только к реально изменённым balances.
- AUD-UI03: blocking initial cart error использует shared ErrorState inline.
  Ошибка сохраняется после5.6с, keyboard retry восстанавливает экран.
- AUD-UI04: Input/Textarea placeholder использует существующий text.secondary.
  Rest/hover/focus проверены при1440/390px; input44px/radius8/Manrope14 сохранены.
- AUD-TEST01: WIP, НЕ исправлен/НЕ принят. Checkout scripts передают expectedVersion,
  но pilot purchase fixture пока содержит ошибочное buyerProfile поле.
  Load harness изменён, полный запуск НЕ выполнен: prerequisite CREATEDB отсутствует.

### Проверки на текущих изменениях

Логи: `.tmp/audit-remediation-20261104/`; API/schema prerequisites build пройдены,
поэтому внутренние команды core-contract/runtime выполнялись без повторной сборки.

| Проверка | Результат |
| --- | --- |
| Vitest session-organization + auth-sessions.service/workspace-session/session-logout/identity-headers | PASS attempt2; attempt1 ошибки test harness сохранены в журнале выполнения |
| Vitest inventory-freshness.service + data-freshness.service | PASS4, attempt1 |
| API typecheck и API build | PASS, attempt1 |
| `db:test -- exec -- node scripts/verify-audit-boundaries.mjs` | PASS attempt2; attempt1 harness cleanup FK failure; anonymous/foreign/revoked и valid switch, Bearer variants/claim/token denial |
| `db:test -- exec -- node scripts/verify-inventory-freshness-race.mjs` | PASS attempt1; real PG interleaving + ordinary stale/repeated controls |
| `db:test -- exec -- node scripts/verify-postgres-integration.mjs` | PASS attempt1; postgres-1.log |
| Web build, web/UI scoped typecheck | PASS attempt1; web-build-1/web-types-1/ui-types-1.log |
| `node scripts/verify-runtime-split.mjs` | PASS attempt1; runtime-1.log |
| `db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only` | PASS attempt1; core-contract-1.log; не закрывает полный purchase gate |
| Changed-file ESLint | PASS attempt1; lint-1.log |
| `npm run verify:ui-contract` | PASS5tests,474files; ui-contract-1.log |
| Existing UI03/04 browser regressions | PASS2; ui-1.log, screenshots/computed ui-results |
| Cart keyboard recovery1440/390 | PASS2; ui-more-1.log, ui-more-results |
| Input/Textarea rest/hover/focus1440/390 | PASS2 attempt2; ui-states-1 failed before browser due diagnostic-generation syntax; ui-states-2.log/states.json/screenshots |
| `git diff --check` | PASS |

### Блокер и продолжение

Полный `db:test -- exec -- node scripts/verify-pilot-backend.mjs`:
1. FAIL CART_VERSION_CONFLICT при addItem: повторно использована checkout cart.
2. FAIL тот же конфликт: edit script завершился до записи fixture; rerun был ошибочным.
3. FAIL unknown Prisma argument buyerProfile в новой synthetic organization.
Все три лога сохранены как pilot-backend-1/2/3.log. Лимит AGENTS §7.1 исчерпан.
Запрошено явное решение владельца на исправление fixture и одну дополнительную
попытку. До ответа эту операцию не продолжать, не объявлять gate зелёным.
Следующий точный шаг: убрать несуществующий relation в fixture по Prisma schema,
проверить связанные buyer assumptions и cleanup, затем разрешённая попытка4.

Остальные позиции реестра аудита остаются открыты: MFA candidate/dynamic validation,
payment/reservation/ledger и договорные решения, ERP self-service, RU/KK shell,
native/Linux/container/restore/multi-instance/live-provider prerequisites. Их
приёмка не следует из успешных проверок этого блока. Новая реализация следующей
фазы не начата при незакрытом обязательном gate текущего блока.

Собственный isolated UI server остановлен; dev restoration начат штатным npm run dev
из canonical root (launcher8644). Рабочая БД не мигрировалась и не reseed.

### Уточнение исходной диагностики AUD-TEST01

Первоначальный аудит связывал409 на addItem с отсутствием expectedVersion.
Проверка реализации показала другое: AddCartItemInput не принимает expectedVersion;
addItem проверяет lifecycle корзины. Для уже оформляемой/неACTIVE корзины guard
правильно возвращает409. expectedVersion нужен checkout и передаётся из актуальной
корзины. Исходный FAIL сохранён; его первоначальное объяснение уточнено здесь.

### Scoped UI review

Screenshots desktop/mobile просмотрены: persistent error содержит причину и
клавиатурную кнопку повтора, без overflow; shared control geometry не изменена.
Computed minimum placeholder contrast5.915:1 для Input/Textarea across rest/hover/focus;
измерения сохранены в ui-states-results. Новых assets/декоративных controls нет.
Новых замечаний к этим двум правкам не найдено; другие UI findings не закрыты.

Dev восстановлен и проверен: API ready200, catalog200; launcher8644/npm21392,
API21484:4012, Next11528:3000. Source canonical, JWT/no demo login; dev оставлен.
Generated next-env.d.ts вернулся к исходному виду автоматически. Финальная diff
hygiene PASS; чужие PRIMARY-SESSION/apps/web/AGENTS/output не изменены/не staged.

## Разрешённая попытка4 — PASS04.11

Владелец явно разрешил исправление fixture и одну дополнительную попытку.
Удалён несуществующий Organization.buyerProfile; полный профиль создаёт уже
имеющийся completeFixtureOrganization. Проверены schema и зависимые buyer/cart
вызовы. node --check, scoped ESLint и diff hygiene PASS.
`npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs` attempt4 PASS:
checkout COMPLETED,1supplier order,1reservation, idempotent checkout и supplier
confirmation; price/stock revalidation и принятие новых условий также пройдены.
Лог pilot-backend-4.log. Первые три FAIL сохранены. Проверка выполнялась на
изолированной dentmarket_audit_20260914, собственный API завершён. Штатный dev
не останавливался, рабочая БД не менялась. Тестовые order/checkout остаются в
disposable DB согласно штатному сценарию. Блокер pilot-backend снят; полный
load harness всё ещё NOT_RUN (CREATEDB prerequisite), AUD-TEST01 принят частично.

## AUD-DEP01 — план перед изменением

Проверены npm ls, реальные callers и upstream advisories GHSA-g3hv-75wg-m249 /
GHSA-3g3m-2fjr-6pw4. minimatch11.0.1 и glob14.0.2 — первые исправленные версии.
Прямого application glob(pattern from request) не найдено. Старые minimatch3/5
не содержат firstPhasePreProcess/optimizationLevel, однако advisory охватывает
их версионно; не объявлять npm audit чистым без проверки всего дерева.

Граница: overrides существующих transitive deps, минимальный lock diff; без
npm audit fix --force/смены ESLint или ExcelJS. glob7 callback API сохраняется;
glob>=9 (rimraf5) обновляется до14.0.2. Minimatch consumers используют named
Minimatch/GLOBSTAR или современный namespace; проверить их поведение после update.
Риск: file matching, CLI/build/lint и XLSX zip. Проверки: bounded matching и abort,
ExcelJS read/write roundtrip, существующие import/export unit, lint и API build;
npm audit + npm ls и lock diff. Не переиспользовать PASS затронутых deps после update.
Тесты только disposable, dev временно остановить по прежнему разрешению и восстановить.

### AUD-DEP01 — BLOCKED; candidate reverted

Global minimatch override broke glob7 sync matching (rawGlob undefined). Narrowing
the override initially retained npm's prior lock resolution; smoke2 failed identically.
Re-resolving from original lock restored minimatch3.1.5/5.1.9 for legacy consumers,
with modern minimatch11.0.1/glob14.0.2. Smoke3 passed legacy sync/callback matching,
then failed on Windows path separators in the diagnostic expectation. Abort/XLSX
steps were not reached. No fourth smoke was run: AGENTS attempt limit exhausted.
Next step needs authorization: normalize diagnostic path comparison, inspect rimraf
consumer semantics, then one smoke4. Candidate import tests21, API build and lint
passed; final candidate audit retained11moderate legacy records. Initial broad
candidate audit0 is NOT acceptance because it broke legacy glob.

Own package.json/package-lock.json edits were reverted to HEAD and installed deps
restored with npm install --ignore-scripts. Both files have no diff. Baseline21moderate
records remain open; no dependency fix is claimed. Candidate patch/logs retained in
.tmp/audit-remediation-20261104/dependency-*. First auth/state/UI/pilot block remains
LOCAL_PASS on original dependencies. No commit/push performed in this continuation.

IMPORTANT current dev state: stopped for dependency work. Automatic approval review
rejected the combined evidence-write/dev-restoration command with `blocked by policy`,
without further reason. No alternative launch attempted. Earlier dev-restored status
above is historical. Restoration remains outstanding via the existing canonical
.tmp/audit-remediation-20261104/restore-dev.ps1 (npm run dev), then health/catalog200.

### Continuation authorized04.11

Owner explicitly instructed «Продолжай» after the blocked continuation report.
Canonical restore command now accepted (launcher16952); readiness pending.
Continue narrowed dependency candidate and one additional smoke4, preserving
three previous failures. Only comparison of modern glob's Windows separators was
normalized. Real consumer rimraf path-arg uses node:path.resolve and accepts both
separators; application path behavior is unchanged. Candidate patch SHA256:
C10DF504FA42B945D57D2B88F2A0F83BFEA175B6DFDDF2442746C005F4274FD3.

### Текущий итог продолжения

Smoke4 PASS: legacy callback/sync, modern async/sync, bounded preprocessing1part,
abort1read до/после rejection, XLSX roundtrip. Кандидат применён с узкими overrides:
minimatch>=9<11.0.1 →11.0.1; glob>=9<=14.0.1 →14.0.2. Legacy3/5 сохранены.
Добавлен воспроизводимый `node --test scripts/dependency-compatibility.test.mjs`:
4PASS и scoped ESLint PASS. Ранее пройденные21import tests, API build и lint
переиспользованы для тех же relevant dependency resolutions; новый тест проверен
отдельно. Final npm audit exit1:11moderate package records (одна legacy advisory),
0high/critical, НЕ security PASS. Изменённые source-to-sink paths закрыты; legacy
dependency chain требует отдельного совместимого решения. Gate smoke больше не blocked.

Непроверенный load harness diff сохранён как .tmp/audit-remediation-20261104/load-candidate.patch
и удалён из рабочего source tree. Полный load gate НЕ выполнен/НЕ закрыт. Рабочие
package/lock сейчас содержат принятые узкие overrides, предыдущий revert исторический.
Dev повторно восстанавливается из canonical root штатным npm run dev, launcher14796.

Dev restoration завершён: API22836:4012 ready200, Next10932:3000 catalog200,
launcher14796; canonical npm run dev оставлен работать. Рабочая БД не менялась.
Dependency fix локально зафиксирован в a70118c; push ещё не выполнялся.
Публикация outgoing range включает ранее local-only audit36081f04 и поэтому
ожидает отдельного решения владельца. Остальные принятые исправления готовы
к локальному коммиту; CI до публикации не запускался.

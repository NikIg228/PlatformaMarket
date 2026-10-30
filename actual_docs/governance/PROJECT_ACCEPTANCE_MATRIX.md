## 31.10 — каталог и элементы предложения: scoped PASS

«Подробнее» открывает товар без quick-view. Количество без встроенных стрелок,
с автошириной и максимумом100; поставщики выровнены, сортировка dropdown.
[Evidence и границы](evidence/catalog-product-controls-20261031.md): focused tests,
types/builds/lint/UI-contract и desktop/mobile flow PASS; полная E2E/DB/release
приёмка не заявляется. Публикация/CI учитываются отдельно.

## 31.10 — витрина по одобренному референсу

Компактная шапка/диалог, карточки с Подробнее, точные существующие фото и отсутствие
глобального личного режима. Types/builds/focused tests/lint/UI-contract PASS;
[scope и evidence](evidence/supplier-storefront-reference-20261031.md).
Финальная visual-приёмка PASS, dev восстановлен; публикация/CI учитываются отдельно.
Общий R7/B2C не закрыты; данные реальны, геометрия controls соответствует DESIGN_SYSTEM.

# PlatformaMarket — актуальная матрица приёмки

## 30.10 — публичная витрина поставщика: PASS (scoped), CI GREEN

Каталог → карточка → имя/логотип поставщика → `/catalog/suppliers/[supplierId]`.
Шапка/логотип/RU-KK, только актуальные доступные публичные предложения,
настройки поставщика с tenant/role/CAS и сохранением черновика при ошибке.
Полный PostgreSQL, contracts/runtime, типы, API/web/buyer builds, focused tests,
browser1440/390/keyboard/recovery, scoped lint/UI-contract PASS.
[Evidence и сохранённые FAIL](evidence/supplier-storefront-20261030.md).
Рабочая БД и deployment не менялись; личная корзина вне scoped результата.
Feature06025fa и test-fix ba55190 опубликованы. На ba55190
[CI41105317325](https://github.com/NikIg228/PlatformaMarket/actions/runs/41105317325)
и [Security41105317288](https://github.com/NikIg228/PlatformaMarket/actions/runs/41105317288)
completed/success: PostgreSQL, контейнеры, общий verify и Security PASS.
Первый FAIL client test fixture сохранён в evidence. Общий R7 не закрывается.

<a id="buyer-context-review-20261029"></a>

## 29.10 — buyer context и право на отзыв: PASS (scoped), CI GREEN

Финальное evidence: [CI40823718196](https://github.com/NikIg228/PlatformaMarket/actions/runs/40823718196)
и [Security40823718285](https://github.com/NikIg228/PlatformaMarket/actions/runs/40823718285)
completed/success на8e6eb79fcc08e29e6609d41995740db5cf455ef2. UUID receipt command,
получение/review/replay проверены полным extended API. Canonical import7,
browser123, full-access3 и promotion4 PASS; types/unit/lint/build, PostgreSQL,
authority/backup-restore, containers, runtime/profile/core/production contract gates,
dependencies и CodeQL PASS. Новый разрешённый цикл завершён со второй CI-попытки.
Финальная docs-only запись не меняет проверенные runtime inputs. Предыдущие
failure и локальный startup timeout ниже сохранены, их результат не переписан.

База main@8805498 + scoped diff. Только canonical source; несвязанный
output/security-remediation-20261028 сохранён. Граница24А/33А: личный режим
просмотра, организационное оформление, receipt-based review в unified UI;
полный B2C checkout, формула рейтинга, native/KK и весь R7 вне этой приёмки.

PASS: schemas build и2 contract tests; API types/build; client types и18 tests;
buyer/web types, buyer21 tests и затем6 context tests после refresh fix;
API trust/commerce/auth115 PASS,1 opt-in skip; scoped ESLint.
`verify-postgres-integration.mjs` через `npm run db:test -- exec -- node` PASS:
tenant isolation, rollback, concurrent idempotency, scarce stock и cart race.
Тем же wrapper выполнен `verify-pilot-backend.mjs --contract-only` PASS;
`node scripts/verify-runtime-split.mjs` PASS. Prerequisites schemas/API build
выполнены отдельно и переиспользованы, это не сокращение alias coverage.
DB identity dentmarket_audit_20260914/PG17.10/53 migrations проверена.
Schema/lock/Prisma client не менялись; API build с npm_config_ignore_scripts=true
переиспользует существующий generated client, не обходит изменение schema.

Real HTTP/SQL verifier PASS: role denial403, foreign order404, invalid input400,
два receipt с replay, partial409/full eligible при pending installation и без
документов; concurrent review один id/ревизия/audit, второй ключ409; принудительный
сбой audit откатывает review/revision в настоящей Prisma transaction.
Браузер1440/390 PASS: вход, контекст A, checkbox/keyboard и checkout enable,
personal блокировка/сохранность обеих корзин; switch A→B→A, сброс подтверждения,
отказ403 чужой корзине; review load error/retry и восстановление после неизвестного
результата отправки без второго отзыва. Финальная isolated go_live сборка PASS.

Попытки verifier: cycle1/1 — cartItemId отсутствовал в fixture; /2 — нет fresh
предложения; /3 — ожидание201 вместо документированного validate200. Лимит
остановлен; владелец явно разрешил новый цикл. Cycle2/1: выявлена одноорганизационная
handoff session; перед switch добавлен штатный refresh текущих членств, действия
покупателя блокируются до его завершения. Целевые6 tests и buyer types PASS;
пересборка изменённого frontend PASS. Cycle2/2: синхронная проверка checkbox
до завершения rendering; заменена штатным auto-wait assertion. Cycle2/3 browser
PASS. После композиционной правки header повтор affected build/browser PASS.
Правила не ослаблены; backend PASS переиспользован на неизменённых исходниках.

Artifacts: `.tmp/buyer-context-review-20261029/`,
`output/playwright/buyer-context-review-20261029/`; snapshots/computed styles
приняты: controls44px/radius8px/Manrope14px, overflow=false1440/390; просмотрены
desktop/mobile снимки. Source fingerprint совпадает с `inputs.json`, финальный
bundle budget PASS. Собственные API4412/web3103 закрываются finally, тестовые сессии
отзываются, свой опубликованный offer скрывается/архивируется. Dev4012/3000
и рабочая БД не затронуты. Commit/push/CI pending; full release не запускался.
Применены development-toolkit (backend/frontend/review/verification), Playwright
и React checklist; проверки выполняет тот же исполнитель без делегирования.

Публикация e36189a выполнена, remote SHA совпал. Security40765215681 SUCCESS;
CI40765215678: containers, types и postgres/authority/backup-restore PASS,
`npm test` FAIL (attempt1). Два зависимых fixture не отражали новый receipt
контракт: order-profile без reviewEligible и document-consolidation order без
items/shipments. Исправлены только fixture; profile проверяет также false при
DELIVERED. Buyer130 tests PASS, API45 PASS; runtime source не менялся.
Следующий CI должен проверить дополненный SHA; прежний failure сохраняется.

bd87918: Security40766691270 SUCCESS; CI40766691252 attempt2 прошёл полный unit,
types/lint/build, PG/backup/containers и системные gates до extended API.
`verify:trust-geo` FAIL409: старый verifier выставлял DELIVERED без receipt.
Исправлен fixture: отрицательная проверка статусного shortcut, затем собственная
paid shipment и настоящий RECEIVE_SHIPMENT перед отзывом. Checkout browser consumers
обновлены для обязательного подтверждения организации; после reload подтверждение
снова требуется. Product runtime неизменен. Node syntax и E2E types PASS;
полное исполнение этих зависимых сценариев — следующий CI attempt3.

1f0b923 опубликован; Security40768990396 SUCCESS. CI40768990348 attempt3
снова остановлен в extended API: новый RECEIVE_SHIPMENT fixture использовал
строковый idempotencyKey вместо UUID →400 Invalid UUID. Unit/types/lint/build,
PG/authority/backup, containers и предшествующие system gates PASS; browser CI
NOT_RUN. Лимит попыток исчерпан, исправление/повтор не выполнялись. Следующий
точный шаг после нового решения владельца: randomUUID() для receipt command,
проверка fixture и новый CI. Product runtime и local acceptance не менялись.

Владелец явно разрешил новый цикл29.10. Исправлен только receipt idempotencyKey
на randomUUID(). Node syntax, scoped ESLint и diff hygiene PASS. Локальный
extracted-fragment harness: подготовка1 syntax collision до API;2 startup timeout
60s без готовности API4412. Owned процесс остановлен; сценарий NOT_RUN локально.
Проверка полного verify:trust-geo перенесена в штатную disposable CI среду;
guards/assertions не ослаблены. Несвязанные параллельные API security edits
не входят в публикацию. Новый CI cycle attempt1 должен проверить UUID/receipt/review.

6d6a5f7: Security40821415844 SUCCESS. Новый CI40821415842 attempt1 подтвердил
полный extended API (receipt UUID, review/replay) и canonical import. Canonical
browser113 PASS/10 FAIL: только неожиданный GET /auth/workspaces в трёх старых
UI fixture (requisites/settings/workspace). Точные GET responses добавлены,
assertions неожиданных запросов не изменены. E2E typecheck/scoped ESLint PASS;
повторное browser исполнение проверяется следующим CI attempt2. Runtime без правок.

## 29.10 — три security fixes, LOCAL PASS; remote CI pending

По явному поручению исправлены ZIP actual expansion, browser-bound handoff и
billing operator boundary из scan59e803b8. Focused adversarial/legitimate tests,
owning API1024/client96, types13/13, scoped lint, API/unified build, runtime split,
`verify:postgres` и27 дополнительных real HTTP/SQL assertions PASS. PostgreSQL
только disposable, own API/PG остановлены. Два buyer/supplier browser cases
добавлены в canonical CI; remote conclusions фиксируются после scoped push.
[Изменения, попытки и ограничения](../security/SECURITY_REMEDIATION_STATUS_2026-10-28.md#три-исправления-code-audit--29102026).
Это не завершение оставшегося audit кода и не production-приёмка.

## 29.10 — синхронизация требований, без новой runtime-приёмки

Прямое поручение: roadmap и связанные документы согласовать с Desktop unified ТЗ,
принятые ответы перенести, подготовку сохранить отдельно, устаревшие Market статусы
в ТЗ обновить. База main@89a8df9; чужой WIP API/client/checkpoint сохранён.
Риск: смешать решения/проекты/код/evidence или включить чужие файлы. План/gates:
сверка исходного hash,180 Q/Т/П, late answers/AC/AT, links/anchors, неизменность
checkbox-статусов, staged diff hygiene и явные paths; app/DB/browser не требуются.

[Действующий scope](../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md#unified-sync),
[требования](../UNIFIED_SPEC_MARKET_REQUIREMENTS_2026-10-29.md), [открытые вопросы](ROADMAP-QUESTIONS-AND-DECISIONS.md#unified-open).
Ни один открытый R-result не получил DONE. Desktop/mobile/авто-допуск/B2C/P1–P7
требуют новых контрактов и приёмки; старые scoped PASS сохраняют свои границы.
Read-only GitHub Actions29.10 повторно подтвердил completed/success CI40742163553
и Security40742163648 на5be8417. Это не сертификат текущего dirty дерева.
Docs gates29.10 PASS: `node .tmp/roadmap-sync-20261029/check-docs.mjs` —27 файлов,
180 исходных Q/Т/П без изменений,108 R-checkbox IDs/статусов сохранены,42 AT
и восемь поздних принятых ответов Market покрыты;72 новых локальных ссылки/якоря
проверены. Market-статусы в Desktop-ТЗ обновлены отдельно; CRM-разделы вне scope
сохранены. `git diff --check` — PASS. Runtime/DB/build/browser не запускались
для Markdown; прежний CI привязан к5be8417, docs-коммит использует `[skip ci]`.

Применены AGENTS/Workflow docs-only и Git Workflow Master: отдельный логический
docs-коммит, явный staging, без чужого WIP. Полный аудит/провайдеры/deploy не запускались.

28.10 — **Опубликованный код5be8417: CI / Security SUCCESS.**
При docs-only актуализации roadmap read-only запрос GitHub Actions подтвердил
`head_sha=5be841759b03046a6c3bb27293c93829355355ca`, completed/success:
[CI40742163553](https://github.com/NikIg228/PlatformaMarket/actions/runs/40742163553),
[Security40742163648](https://github.com/NikIg228/PlatformaMarket/actions/runs/40742163648).
Ожидание corrected CI и FAIL предыдущих публикаций ниже сохраняют историю;
финальный corrected workflow завершён успешно. Это не полный code audit,
не live НУЦ/providers, не R7/R8/R9 acceptance и не разрешение production.
[Текущий остаток roadmap](../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md#current-status).
Локальные app/DB/browser suites для редакции Markdown не повторялись.

28.10 — **Security dev/build: LOCAL SCOPED PASS; новый CI ожидается после push.**
По отдельному поручению9 audit records→0 всех severity, полное npm resolution
exit0. Vitest4.1.12/Nest CLI12.0.11/API TS6.0.3; runtime Nest11 и frontend TS5
сохранены. Types13tasks, API build/font bytes/watch/runtime, isolated web build,
node verification9 PASS. Все1832 unit cases прошли по workspace; root npm test
имел timeout, scoped sequential completion PASS (7 opt-in PG skips).
Оба workflow проверяют также devDependencies. Предыдущие CI40729017785 и
Security40729017814 на7bd4e2db SUCCESS, включая go_live document verifier.
[Изменения, команды и история попыток](../security/SECURITY_REMEDIATION_STATUS_2026-10-28.md#дополнение-devbuild-зависимости).
Оставшийся code audit и прежние границы покрытия сохраняются.
Публикация2f473de: Security40740022052 SUCCESS; CI40740021988 — containers/PG/
root unit/types/lint/build PASS, затем FAIL direct observability discovery dist.
Source-only fix четырёх direct verifier-команд:62 cases/14 files и alert vectors14
PASS при существующих5 compiled specs. Полный corrected CI — следующий gate.

28.10 — **Security CI dependencies: LOCAL PASS; remote CI проверяется после push.**
По явному выбору владельца исправлены production dependencies и устаревший
admin lazy-import regression. Audit15→0, npm test1832, types13tasks,
fresh owned PostgreSQL/API build, API client/unified web build16.4.3,
runtime split/actual OTel smoke/scoped lint PASS.
[Команды, история попыток и ограничения](../security/SECURITY_REMEDIATION_STATUS_2026-10-28.md#дополнение-зависимости-и-блокеры-ci).
Полного аудита или production/provider acceptance это не означает.
Публикация0f7bd27: Security SUCCESS; CI прошёл исходные блокеры и PostgreSQL,
но обнаружил старую impersonation fixture в document-compliance. Исправленный
verifier получил отдельный real HTTP/SQL PASS (pilot/all, owned PG); go_live
результат требует следующего CI, защита actor не ослаблялась.

28.10 — **Security remediation: LOCAL SCOPED PASS.** Четыре исторических finding,
три дополнительных пакета и три WAVE1 инварианта сопоставлены с кодом и evidence.
Полный PostgreSQL gate, focused SQL117/74, HTTP42, unit150 и reset-token5 PASS;
27 входных hashes совпадают. [Текущая сводка и ограничения](../security/SECURITY_REMEDIATION_STATUS_2026-10-28.md).
Workbench open/idle не изменены; полного аудита/production/криптографической
приёмки нет. Статус публикации и CI — в отчёте соответствующего коммита.

16.10 — **R7.6.5 операционный довоз: SCOPED PASS.**
На main/3aa1c0b + локальный scope: API unit21, supplier/E2E types, scoped lint и
изолированный unified build PASS. Browser4 неизменённых +2 affected PASS после
исправления inline validation; mock API, screenshots/computed styles1440/390.
После отдельно разрешённого исправления lot fixture PostgreSQL/API10/8/2 PASS:
tenant/party/stale/stock/rollback/concurrent replay, отдельное списание2, оригинал
и PDF сохранены, товар DELIVERED при документальных AGREED/INCOMPLETE. Core contract
363 operations/69 verified/251 schemas и runtime split PASS.
[Журнал с командами и историей попыток](../domains/document-workflow-implementation-log.md).
Полный R7.6.5, НУЦ/формы/подписи/возвраты остаются открытыми.
Отдельно разрешённые миграции marketplace и запуск dev PASS не закрывают R7.6.5.

15.10 — **R7.6.2 GENERATED-счёт: SCOPED PASS; CI SKIPPED.**
Подготовка → PDF preview → подтверждение поставщиком → текущий счёт/история
клиники реализованы. Isolated PostgreSQL (включая dependent suites), migration
upgrade, core-contract, runtime split, focused unit/client, API/web build/types,
UI contract и browser3/3 (1440/390, keyboard/retry/stale) PASS. PDF1/10pages
и screenshots/computed styles проверены. Browser — mocks; backend — real PG.
Рабочая миграция/deploy не выполнялись. Полный CI исключён владельцем.
История попыток и команды — [checkpoint](task-state/PRIMARY-SESSION.md).
Публикация — отдельный feature-коммит текущего пакета; SHA/remote в Git-квитанции.


15.10 — **Без ручного обновления: PUBLISHED, scoped PASS; CI SKIPPED.**
Постоянные refresh controls и время последней загрузки удалены из кабинетов;
контекстный retry, automatic refresh и бизнес-команды сохранены. UI90,
23 уникальных mock-browser сценария, scoped lint/types, UI contract и финальная
isolated web build49routes PASS. Неуспешные попытки сохранены в
[checkpoint](task-state/PRIMARY-SESSION.md). DB/full CI не запускались.
Новые локальные operator modules и три untracked tests сохранены как WIP,
не входят в собственную публикацию; рабочий UI исправлен также в них.
Опубликован 2112e6a1fff5eff3a8a33b9ef29ead58455669ba в origin/main; SHA совпадает.
GitHub Actions head_sha: total_count=0, [skip ci] по запросу владельца.



15.10 — **Равные карточки и подчёркнутые категории: PUBLISHED, scoped PASS; CI SKIPPED.**
Карточки товаров равного размера; категории supplier/clinic/admin используют
общие tab adapters без hover/selected заливки, с подчёркиванием как Settings.
UI unit90, contract2, types/lint, UI contract386files, browser18/18,
изолированная pilot web build/types49routes — PASS. Initial visual6/8 исправлен
сверкой толщины underline с Settings; повтор8/8PASS. Полный CI исключён запросом
владельца, [skip ci]. Детали:
Опубликован e85479956688f28f469228099c293ca01ea5f854 в origin/main; remote SHA совпадает.
 [checkpoint](task-state/PRIMARY-SESSION.md).


15.10 — **Escape назначения оператора: PUBLISHED, scoped PASS; CI SKIPPED.**
Один modal/focus trap сохраняется при lazy загрузке формы; закрытие и возврат
фокуса проверены до/после загрузки, при повторном открытии1440/390, retry и busy.
Фокус-регрессия воспроизведена до fix; production browser6/6PASS после fix,
admin/E2E types, scoped lint, isolated frontend build/types PASS.
Полный CI исключён явным запросом владельца; прежний CI FAIL сохраняется как история.
Опубликован 1efdc2c73272c4f92b536fde1c5dea6569f18820 в origin/main, remote SHA
совпадает; [skip ci] указан по запросу владельца. Узкий scope закрыт.
Детали и неуспешные попытки: [checkpoint](task-state/PRIMARY-SESSION.md).

15.10 — **Рамки, подсказки и разделение форм кабинетов: PUBLISHED; CI FAIL / rerun BLOCKED.**
Общие DmHeading/InfoTip/FormSections; note с рамкой в цвет текста; обращения на
«вы». Налоговый статус: статус и дата начала на виду, прочее раскрывается;
validation автоматически показывает скрытое ошибочное поле, значения сохраняются.
UI unit90PASS, UI/E2E types/scoped lint/UI-contract386files/build+types PASS;
28 целевых browser cases PASS по итоговому evidence, screenshots/computed1440/390
просмотрены. Escape hovered help исправлен; прежний intermittent profile focus
fail и успешная отдельная проверка сохранены в [checkpoint](task-state/PRIMARY-SESSION.md).
Backend/API и рабочие данные без изменений. Коммит `fc57098` опубликован;
[CI38638377189](https://github.com/NikIg228/PlatformaMarket/actions/runs/38638377189)
FAIL:120browserPASS/1FAIL — operator assignment Escape, conversations.spec.ts:89.
Security, PostgreSQL, контейнеры, types/unit/build/API checks PASS. Следующие
full-access/promotion steps skipped. Запрос повторного verify-job отклонён GitHub403;
повтор не запущен. Нужен owner rerun failed job; scope не закрыт как общий PASS.

15.10 — **Settings/общие controls: PUBLISHED; CI/SECURITY PASS**, `02cb2d6` → origin/main.
[CI38632147815](https://github.com/NikIg228/PlatformaMarket/actions/runs/38632147815)
и [Security38632148097](https://github.com/NikIg228/PlatformaMarket/actions/runs/38632148097)
completed/success на этом SHA; verify, PostgreSQL и оба контейнера PASS.
Итоговый receipt сохранён локально после публикации без новых code changes.
Действия по ширине содержимого с явным fullWidth; DmField без растяжения по
соседней подсказке; persistent note с заметным переходом справа/mobile снизу.
VAT/реквизиты центрированы, selectors тематизированы. Убраны UI истории и вкладка
Settings «Договор и документы», её orphan content и старые переходы; backend
snapshots/требования к допуску сохранены. Final browser9PASS + routing1PASS +
visual2PASS; representative catalog/admin3PASS, UI89PASS + note4PASS, UI/E2E types,
scoped lint/UI-contract и final web build/types PASS. Screenshot/computed1440/390
просмотрены. Команды/попытки/граница — [checkpoint](task-state/PRIMARY-SESSION.md).

15.10 — **R7.6.1.4 VAT: PUBLISHED, CI/SECURITY PASS**, `9c5e38c` → origin/main.
[CI38624076481](https://github.com/NikIg228/PlatformaMarket/actions/runs/38624076481)
и [Security38624076310](https://github.com/NikIg228/PlatformaMarket/actions/runs/38624076310)
completed/success на этом SHA. CI browser113PASS, import7PASS, full-access3PASS,
promotion4PASS; API/web containers и отдельный PostgreSQL job PASS.
Владелец разрешил новый цикл: buyer browser2/2PASS390/1440, keyboard/computed
и screenshots PASS после исправления композиции; supplier10PASS + price1PASS.
Backend275/schema291/client74/UI89 tests PASS; types/build/lint/UI contract/
web budget/runtime PASS. Full isolated PostgreSQL attempt2PASS (attempt1:
collision test fixture indices); core-contract69 operations PASS.
Команды, логи, оставшиеся checks и следующий шаг —
[checkpoint R7.6.1.4](task-state/PRIMARY-SESSION.md). Прошлые PASS ниже не
сертифицируют этот пакет; рабочая БД не мигрировалась. Итоговый CI receipt
добавлен локально после публикации, новых code changes нет. Legacy manual browser
fixtures обновлены и typechecked, отдельная legacy suite не запускалась.

Маршрут с08.10: приоритет №1 — [функциональная карта](../FUNCTIONAL_AUDIT_AND_ROADMAP_2026-10-08.md),
подробные требования — [PROJECT_OVERVIEW](../PROJECT_OVERVIEW.md),
единый реестр исполнения — [Main Roadmap](../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md).
Ниже evidence отдельных задач, с датами и границами версий. Это не общий PASS
текущего dirty checkout и не доказательство production. Старые карточки доступны
по совместимым адресам как архив; читать их только для нужного evidence.
Пересборка документации не переоткрывает CORE и не закрывает POST/EXT/R0–R9.

14.10 общая приёмка по новому запросу владельца — BLOCKED на `2876648` + dirty
patch, публикации нет. Full unit12/12/types13/13 PASS; web build/budget PASS
23files/1146176raw/349175gzip без изменения лимитов. Admin browser15PASS включает
ранее NOT_RUN object390 (скриншот проверен). Canonical browser105PASS/2FAIL:
catalog comparison390/1440. Попытка2 повторила ошибку неполного mock; попытка3
с полным контрактом выявила неверное предположение fixture о наличии складских
остатков. Лимит3 исчерпан, gate остановлен. Последний E2E typecheck PASS;
тестовая коррекция не принята. Нужны оставшиеся scoped checks и фактический CI
после публикации; прежний CI FAILURE не заменён локальными PASS.
[Точные результаты и следующий шаг](task-state/PRIMARY-SESSION.md).

14.10 R7.7.3.1 + read-only list/detail UI части .3.3 — LOCAL_PASS выбранного
сценария на `2876648` + scoped patch: API151/full filtered pages/authority/404,
safe profile/two cities, real operator UI, browser7 (с адресными locator fixes),
1440/390 screenshot/computed styles, types/lint/core/runtime/Admin+unified build.
Source и final visual review READY,57 source hashes MATCH; receipt — в checkpoint.
Публикация BLOCKED зависимостью R7.7.1.3; CI NOT_RUN; .3.2/остальная .3.3 открыты.
Команды, попытки и ограничение legacy catalog write —
[технический журнал](../applications/admin-implementation-log.md).

14.10 R7.7.2 — LOCAL_PASS на `2876648` + scoped patch: authorized server totals,
safe capabilities projection и существующие Admin panels. Unit/types/lint/core/runtime,
real API с151 объектами каждого вида, real operator UI,1440/390 screenshot/computed
styles и read-only review PASS. Семантика и попытки —
[технический журнал](../applications/admin-implementation-log.md).
Публикация BLOCKED зависимостью R7.7.1.3 (object390 NOT_RUN после tool denial),
новый CI NOT_RUN. Это не общая приёмка Admin и не подтверждение внешних подключений.

13.10 ADMIN_REBUILD — LOCAL_PASS на `64784c2` + scoped patch. Штатный вход оператора
email/пароль без Google/Apple/MFA, отдельная cookie/session и постоянная проверка
operator membership; рабочая очередь/уведомления, исправления MA-01–05.
Auth108, support23, schemas/client/admin10, isolated PostgreSQL integration,
runtime split, production auth, affected types/build/lint/UI contract PASS.
Real auth1 и messages2 PASS; targeted UI/regression/consumer checks PASS.
Canonical local operator login/cookie recovery/mobile/logout PASS. Локальный
аккаунт подготовлен по явному разрешению, credentials ignored. Git/CI отдельно;
общей production-приёмки нет. [Попытки и evidence](task-state/CATALOG-PROMOTIONS-MESSAGES-2026-10-12.md).
Опубликованы55744ff + test follow-up1ff5d98, remote совпал. На1ff5d98 Security
38440062044 SUCCESS; CI38440062021 FAILURE: browser100 PASS/7 прежних failures
catalog/unified/profile; CORE06 conversations исправлен и больше не падает.
PostgreSQL и обе контейнерные сборки SUCCESS. Итоговый post-push receipt локальный.

13.10 Messages/support/operator audit на `64784c2` — COMPLETE_WITH_FINDINGS,
не полная функциональная приёмка: новые browser23 PASS/5 FAIL + backend1 FAIL.
Пять findings MA-01–05: восстановление операторской формы неверными defaults,
недоступный локальный operator login, OPEN после ответа при ручном переоткрытии,
только ручное обновление очереди, устаревший conversationId после выбора чата.
Два реальных трёхсторонних сценария и support UI17 PASS; неизменённые backend/
PG/Message evidence переиспользованы с указанными границами. Product code/live DB
не изменялись. [Полный отчёт и команды](task-state/CATALOG-PROMOTIONS-MESSAGES-2026-10-12.md).
Тот же SHA: Security SUCCESS; CI FAILURE (canonical browser100 PASS/7 FAIL
в catalog/profile/unified, Postgres и оба containers SUCCESS). Общая production
готовность и закрытие R7 не заявляются; automatic fixes не разрешены аудитом.

13.10 CATALOG-PROMOTIONS-MESSAGES / operator review — LOCAL_PASS,
baseline2f25ed8 + scoped patch: compact header/status chips, escalation modal,
ticket-authoritative lifecycle, operator-only completion with public decision,
explicit repeat escalation, support notifications and private-note isolation.
Focused schema/client/backend tests, isolated PostgreSQL lifecycle/race/rollback,
dependent support attachment tests and real HTTP CORE06 PASS. Affected types,
scoped lint, UI contract362, runtime split, PostgreSQL integration and API/go_live
web builds PASS. Messages/question browser13 plus final shared-dialog regression4
PASS; screenshots/computed styles inspected at1440/390. No live data or migration.
[Exact attempts, commands and publication receipt](task-state/CATALOG-PROMOTIONS-MESSAGES-2026-10-12.md).
This is a scoped R7 result; publication/CI tracked separately, no production claim.

14.10 CATALOG-PROMOTIONS-MESSAGES / Messages-question — LOCAL_PASS,
baseline c251bc1 + this patch: тихое обновление/полная история, закреплённый composer,
модальный вопрос с контекстом товара/поставщика, черновики/повторы/фокус и возврат
в глубокий каталог. PNG/JPG/PDF до10МБ/10 файлов: tenant/participant authorization,
точный context/actor claim в транзакции, replay/races/rollback и защищённое чтение.
Targeted UI browser10 + support3, isolated PostgreSQL и HTTP CORE06 PASS;
schema/backend/dependent/UI/client units, affected types/lint/UI contract,
runtime split/API build/go_live web build PASS. Без изменения рабочей DB/schema.
[Checkpoint с командами, всеми попытками и Git/CI receipt](task-state/CATALOG-PROMOTIONS-MESSAGES-2026-10-12.md).
Это частный результат R7, не общая production-приёмка.

12.10 PRODUCT-PAGE-PREVIEW-DATA — LOCAL_PASS, baseline954be51 + this patch:
по отдельному поручению владельца пять товаров со скрина получили тестовые
варианты, две фасовки, по3 поставщика, характеристики/описания и10 PDF.
Локальная DB подготовка ограничена точными IDs, transactional/idempotent,
с backup и предварительной rollback-проверкой в test DB. Исходные названия
сохранены, короткие заголовки показаны в каталоге. Документы доступны только
в development. Unit15 + UI-policy4, browser8 unique, native пять страниц1440/390,
типы/lint/UI-contract и go_live web build PASS. [Полное evidence](task-state/PRODUCT-PAGE-PREVIEW-DATA-2026-10-12.md).
Это тестовое наполнение, не приёмка реальных коммерческих данных или production.

12.10 PRODUCT-PAGE-REDESIGN — LOCAL_PASS, baseline4096d0b5 + this patch:
страница товара по согласованной композиции референса и общим DS adapters;
вариант/сопоставимая фасовка/валюта, zoom, компактные предложения, сортировка,
количество/предварительная сумма, корзина и вкладки информации. Выбор сохраняется
после входа и смены города; запоздалый ответ не меняет текущий город, pending
cart write не дублируется при переключении варианта. Цены/отзывы/документы не
подставляются из демонстрационных данных. Unit64, browser10 unique PASS;
affected types/lint/UI-contract351 и final go_live web build PASS.
[Checkpoint: команды, попытки, screenshot/computed-style evidence и Git/CI receipt](task-state/PRODUCT-PAGE-REDESIGN-2026-10-12.md).
Это частный результат R7.1, не общий R7, актуализация каталожных цен или deploy.

09.10 CONTROL-STATES — LOCAL_PASS, baseline85a80758 + this patch: единые
заливки neutral controls во всех приложениях, без обычных цветных рамок и
сдвига нажатия; keyboard/error/disabled/selected и primary/danger сохранены.
Unit5/browser23 unique PASS, affected frontend types, scoped lint/UI-contract348,
go_live web build PASS. Проверены screenshot/computed styles desktop/mobile,
каталог, формы авторизации, клиника, поставщик, оператор и support recovery.
[Checkpoint, команды и история попыток](task-state/CONTROL-STATES-2026-10-09.md).
Это частный результат R7.1, не общая приёмка R7 и не сертификат production.

09.10 CATALOG-REFERENCE-V3 — LOCAL_PASS: каталог по утверждённому референсу,
пять desktop колонок, статичные прямоугольные акции, sticky только toolbar,
сортировка, реальные brand/parameters/price unit/supplier count/availability,
выбор поставщика через существующий modal. Unit9/browser6 PASS, buyer/web/e2e
types, scoped lint/UI-contract348, final go_live build PASS. Screenshot и computed
styles1440/390, scroll/focus, error/empty/retry/cart consumers проверены.
[Checkpoint и границы](task-state/CATALOG-REFERENCE-V3-2026-10-09.md).
Это частная приёмка R7; рабочие данные, страница товара и общий R7 не изменены.
Publication/CI receipt — в checkpoint, локальный PASS не означает CI_PASS.

08.10 STATUS-CARDS-V2 — LOCAL_PASS, baseline main b06a41e + this patch:
approved shared success/error/info and yellow warning cards; catalog add result,
unknown write outcome, pagination retry preserving products, filter/offer retry,
authoritative cart-change notices, deduplicated offline and verified recovery.
Two modal defects repaired after explicit additional cycle authorization:
portal specificity keeps close above backdrop; focus stays in the open dialog
when retry trigger unmounts. Final11 unique browser scenarios PASS (desktop/mobile,
including3 unchanged consumers with reused evidence); focused unit tests PASS,
six affected frontend workspace types PASS, scoped ESLint/UI-contract343 PASS,
go_live web build PASS. Prior failed attempts retained in
[checkpoint](task-state/PRIMARY-SESSION.md); screenshots/traces in
`output/playwright/status-cards-v2-*`, logs `.tmp/status-cards-*`.
No backend/DB/deploy changes or full release certification; R7 remains open.
08.10 R1.1 — OWNER_SCOPE_ACCEPTED / TRUST_CODE_AUDIT:
trust обязателен в пилоте, AI только для стандартизатора Excel/CSV; AI-помощники
вне текущего плана, рекомендации/подписки/реклама отложены. Реализация R3.7/R7.5
не принята. Сверка main3012394/runtime1e666ee:9-компонентный score engine,
reviews/appeals/API и часть UI существуют; автоматические producers событий
из бизнес-переходов и полный canonical apps/web путь не подтверждены.
Текущий pilot выключает trust. Точные параметры/пробелы —
[R1 checkpoint](task-state/R1-LAUNCH-SCOPE-2026-10-08.md).
Existing CI37739925051 `verify:trust-geo` PASS на synthetic fixtures переиспользован
без расширения до live/полного UI; новых app/DB/browser запусков для docs нет.

08.10 R0 — ACCEPTED / CI_PASS, baseline **R0-2026-10-08**:
`1e666eef94d9012d0e7a54991e68391b677e7018`, remote SHA подтверждён.
Опубликованный patch исправляет document retry focus, обновляет устаревшие
UI assertions и проверяет promotions отдельным go_live profile после pilot.
Targeted26, full-access3, promotion4 PASS; UI/web/E2E types, lint, оба builds PASS.
Visual recovery4 PASS, desktop/mobile focus и screenshots проверены.
История attempts и точные команды — [checkpoint](task-state/R0-BASELINE-2026-10-08.md).
[CI37739925051](https://github.com/NikIg228/PlatformaMarket/actions/runs/37739925051)
и [Security37739925079](https://github.com/NikIg228/PlatformaMarket/actions/runs/37739925079)
SUCCESS: canonical browser107/107, full-access3/3, promotion4/4, import/rollback7/7;
PG, containers, lint/types/tests/build и runtime/production checks PASS.
Dev/test44/44 migrations; production UNKNOWN. Audit9 moderate OpenTelemetry
остаются при high/critical gate PASS. R0.1–3 закрыты, R1 не начат. Следующий
receipt docs-only сохраняет code/config/lock inputs; CI переиспользуется.
Ниже сохранены старые CI failures как история.

08.10 R0 repair — ORIGINAL_BLOCKERS_FIXED / BROWSER_CI_FAIL:
опубликованы2d6b749 и29ffa54435e77c796fd6dc676b438e49c1a81a93, remote SHA
подтверждены. PG3 PASS; API32tests, dependency regression3, fixture tests7,
types/lint, go_live build, production auth/runtime PASS. FlowB3 после ожидания
animation.finished PASS2 locally; в CI29ffa54 FlowB3, PG, containers и Security
PASS. CI37732546397 FAILURE: canonical browser81 PASS /25 FAIL в6 specs;
full-access SKIPPED. Security37732546407 SUCCESS. Audit high0/critical0, moderate9
OpenTelemetry остаются. Команды/attempts/границы в [checkpoint](task-state/R0-BASELINE-2026-10-08.md).
R0.2 открыт; browser failures требуют сверки с принятыми UI-контрактами,
массовая замена assertions не выполнена. Рабочая DB/R1/deploy не менялись.

08.10 R0 initial baseline — исторический BASELINE_RECORDED / CI_FAIL:
main0bd933e, runtime e68a518; исходный dirty5 — только проверенные metadata и
Next instructions. [Checkpoint](task-state/R0-BASELINE-2026-10-08.md) содержит
владение, состав публикации, маршруты, remote/CI и остаток. Dev/test44/44
миграций;4 byte differences объяснены LF/CRLF, неизвестных/незавершённых0.
Read-only10 HTTP probes200 — доступность оболочек, не бизнес/E2E приёмка.
CI37696144727 и Security37696144642 FAILURE: verify:postgres fixture контактов
и npm audit; контейнеры/CodeQL SUCCESS. Локальный UI PASS не отменяет эти FAIL.
Документирование не запускает R1, рабочие migrations или CI repair.

08.10 FUNCTIONAL-AUDIT-ROADMAP — CODE_AUDIT / TARGETED_UNIT_PASS:
функциональная карта на1fb24ca9698769c69d2c23265f6a9a7105fecd45; 24 server test
files /163 tests PASS (13/79 +11/84). Точные команды, связи API/UI и границы —
в [приоритетном документе](../FUNCTIONAL_AUDIT_AND_ROADMAP_2026-10-08.md).
Это не новый PostgreSQL/E2E/live PASS. Self-service ERP обеих ролей и совместная
реализация backend/UI — принятые требования; runtime подключения через поддержку
пока не заменён. Docs-only evidence — [checkpoint](task-state/FUNCTIONAL-AUDIT-ROADMAP-2026-10-08.md).

08.10 STATUS-TOASTS — LOCAL_PASS:
scope main1fb24ca plus reviewed action-feedback diff. Clinic, supplier and operator
action outcomes use one bottom-right card: solid brand green success/red error,
semantic icon/title/explanation, five-second timer and slide-out, manual close.
Fluent modal ownership preserves accessible feedback and focus restoration;
field validation, access conditions, business states, drafts and recovery controls
remain contextual. No API, permissions, money/stock or database contract changes.
Final shared-provider browser8 PASS; support5 PASS (compact support case rerun
after removal of its old timer). Includes both roles1440/390, operator reply,
same-error retry after expiry/dismiss, modal keyboard close, document upload and
accounting recovery, inventory, attachments and retained drafts/idempotency.
All six affected frontend workspace types, scoped ESLint, UI-contract343 sources,
go_live web build and diff hygiene PASS. White-text contrast: green5.35:1,
red6.49:1, amber5.46:1, blue6.90:1. Desktop/mobile modal captures inspected;
clock-controlled captures use disabled CSS animation for a settled visual.
Commands/attempts/publication: [checkpoint](task-state/PRIMARY-SESSION.md).
Logs `.tmp/status-toast-*`; screenshots `output/playwright/status-toasts*`.
Full E2E/release/backend/DB suites NOT_RUN: UI feedback slice with intercepted API.
This does not close R7 or certify production/CI.

08.10 DOCUMENTS-REDESIGN — LOCAL_PASS:
scope main5d24ae5 plus reviewed Documents diff. Clinic procurement/supplier sales
registry, grouped server filters, bounded counterparty search, periods, cursor
paging; desktop detail/mobile drawer with independently loaded related order
documents, downloads/signatures/versions and permission-based accounting.
Marketplace agreement/credentials moved to supplier Settings; legacy link redirects.
Schema4/client1/document-service-and-isolation55/OpenAPI3 tests PASS; nine unique
targeted fixture browser cases PASS (1440/390, keyboard/return focus, filters,
empty/error/retry, upload draft, accounting recovery/denial). Final screenshot and
computed control sizes inspected. Affected types/scoped lint/UI-contract342 sources,
schema/API builds, runtime split and go_live web build PASS. No DB writes, migration,
external signing, release certification or full E2E. Legacy entry UI preserved.
Attempts, commands, artifacts and publication status:
[checkpoint](task-state/DOCUMENTS-REDESIGN-2026-10-08.md). This slice does not close R7.

08.10 SUPPLIER-CONTACTS-SOURCES-TABS — LOCAL_PASS:
scope main@110e27b plus this task's reviewed diff. Supplier official/public contact
and exactly two reserve contacts required for completion/save; legacy profiles
remain readable. Catalog receives official fields only, order contacts are read
after permission/party checks. Existing JSON persistence, no migration or live seed.
Shared navigation tabs (Settings/Import/order), contextual help, cancel hover and
five-second bottom-right save toast; 1C/MoySklad guided request UI uses existing
support API. No live connector activation or external-service readiness claimed.
Service/profile8, projection/order12, terms15, schema3 and public render1 PASS.
Isolated DB contact persistence/replay/rollback/role/tenant/privacy proof PASS;
runtime split/OpenAPI PASS.17 unique browser cases PASS at1440/390 including
contact completion, errors/recovery, keyboard/dialog focus, import/order tabs,
touch help and toast timing. Visual captures inspected in
`output/playwright/supplier-contacts-ui-2/`, `supplier-contacts-final/` and
`supplier-toast-mobile-verified/`. Final affected types, scoped ESLint,
UI-contract337 sources, API/schema builds and go_live web build PASS.
Attempts and exact commands: [task checkpoint](task-state/PRIMARY-SESSION.md).
Logs `.tmp/supplier-contacts-*`, `.tmp/supplier-sources-*`, `.tmp/supplier-toast-*`.
Full E2E/release NOT_RUN: focused slice with isolated backend and affected UI gates.
Publication/CI recorded separately; R7 remains open.

08.10 SETTINGS-PROFILE-EDITABLE-V2 — LOCAL_PASS:
scope main@3fa9089 plus this task's reviewed diff; owner-approved Settings/Profile
for clinic and supplier, inline name/email/phone/avatar, additional work contacts.
[UI pattern](../ui-ux/DESIGN_SYSTEM.md),
[API and migration](../operations/production-auth-runbook.md),
[attempts and publication](task-state/PRIMARY-SESSION.md).
Identity/org/upload/session suites100 PASS; body-policy13 PASS; schema3/client2/
UI tokens5 PASS. Isolated migration deploy/upgrade, CAS concurrency, rollback,
role/tenant denial, contact idempotency and verified email/session transition PASS.
Actual JWT HTTP API PASS with a loopback scanner simulator and private local mail;
no external delivery certification. Targeted browser17 unique cases PASS, including
1440/390 both roles, keyboard/touch cancellation, drafts/errors/retry, contact add,
address conflict rebase, sessions pagination/revoke and existing navigation/logout.
Final screenshots inspected: `output/playwright/profile-edit-v2-final-visual/`.
Affected schemas/API/web/UI/client/e2e types, API build, go_live web build, scoped
ESLint and UI-contract PASS. Logs `.tmp/profile-edit-*`. Full E2E/release were not
run: scoped UI/auth/upload change, covered with targeted DB/HTTP/browser gates.
Owner-approved local migration20261007190000_profile_contacts applied after a
validated private backup; existing User/OrganizationProfile values unchanged.
No seed or production deployment. R7 and external production readiness remain open.

05.10 INVENTORY-EDITOR-TEMPLATES — LOCAL_PASS (CI отдельно при доставке):
[контракт](../applications/supplier-web.md),
[HTTP и проверка](../integrations/runbooks/manual-supplier.md).
Раздельные команды stock/price, права, strict payloads и отсутствие записи
другого измерения. Редактор на странице остатков; contextual link открывает
выбранный баланс с фокусом. Plain XLSX/CSV: один товар, все12 колонок заполнены.
Service8/schema8/client2 PASS; ImportFileParser14/14 PASS2 (CSV assertion corrected).
Scoped types и ESLint PASS; API build PASS2 (первый EPERM из-за DLL dev API).
Isolated PostgreSQL commercial PASS2 (первый не стартовал из-за вызова wrapper
без npm): HTTP validation/role/tenant, rollback, stock race, replay, publication
and warehouse versions; fixtures cleaned. Runtime-split и runtime OpenAPI PASS.
Browser7/7 + affected existing3/3 PASS1; desktop1440/mobile3902/2 PASS2 после
компактной ширины поля/кнопки, initial и saved снимки просмотрены.
Canonical go_live web build PASS2 (повтор после scoped CSS).
Логи `.tmp/inventory-*.log`, снимки `output/playwright/inventory-editor/`.
Применены Development Toolkit, Agency UI/Code Reviewer и Spreadsheets.
Full E2E/release не запускались: ограниченная правка, отдельные целевые UI/API/DB
проверки; рабочая БД не изменялась, миграций и новых интеграций нет.

05.10 PRODUCT-PAGES-REFINEMENT — LOCAL_PASS (CI отдельно при доставке):
[контракт](../applications/supplier-web.md), [общий поиск](../ui-ux/SHARED_SEMANTIC_THEME.md).
DmSearch440×44, inner Find/clear/Enter/IME; компактные corrections/promotions,
формы без roadmap, inventory cursor loading/retry/cancellation без нижних панелей.
Рабочий XLSX с примером/инструкцией: ImportFileParser13/13 PASS3 после исправления
XML namespace экспорта и CommonJS-пути fixture. Browser31 уникальный case PASS: supplier20, refinement4,
shared3, catalog2 и calendar2. Search PASS3 после исправления тестовых assertions;
catalog PASS2 после исправления fixture. Финальные снимки1920/390 PASS2 после
исправления mobile grid overflow в picker; manual/recovery повтор2/2 PASS.
UI/web/buyer/supplier/e2e types, scoped ESLint, canonical go_live web build PASS.
API build при восстановлении dev: FAIL1 из-за import.meta в новом spec;
CommonJS-compatible fixture path исправлен, API build PASS2, parser13/13 PASS3.
`git diff --check` PASS. Логи `.tmp/refine-*.log`; снимки
`output/playwright/product-refinement/`. Применены Development Toolkit,
Agency UI/UX/Code Reviewer/Git Workflow и Spreadsheets для XLSX.
Без full E2E/DB/release: backend бизнес-операции не менялись, API перехватывались
fixtures; проверка парсера использовала настоящий скачиваемый файл.

05.10 SHARED-FOCUS — LOCAL_PASS (CI отдельно при доставке):
[контракт](../ui-ux/SHARED_SEMANTIC_THEME.md). Единый тонкий Tab-индикатор;
клик/набор/редактирование не включают keyboard mode и не создают двойную рамку.
Modality units3/3 PASS1; browser3/3 PASS2 после уточнения outline offset:
поиск заявок1440/390, textarea, button, Dropdown/portal/Escape, forced colors,
ошибки регистрации и checkbox. UI/e2e types, scoped ESLint и canonical go_live
web build PASS; визуально проверены сохранённые desktop/mobile снимки.
Снимки `output/playwright/shared-focus/`, логи `.tmp/shared-focus-*.log`.
Без backend/DB/full E2E: изменение общего frontend focus, не release gate.

05.10 PRODUCTS-UX-V2 — LOCAL_PASS (CI проверяется отдельно при доставке):
[контракт](../applications/supplier-web.md), [checkpoint](task-state/PRIMARY-SESSION.md).
Семь согласованных поверхностей: добавление, импорт, заявки, исправления,
остатки, акции и инспектор. Desktop breadcrumbs; mobile title/back icon.
Серверный preview импорта, точная конверсия цены; резервы/страховой запас
сохраняются, недостаточный остаток и конфликт версии откатывают строку.
Focused API34/34 + stock4/4, schemas51/51, client9/9, Swagger3/3, web6/6;
20 уникальных browser cases PASS, affected7/7 после visual polish.
Scoped lint/types, canonical go_live web build, API build/runtime-split PASS.
PostgreSQL product reads и workflows PASS; stock rollback и two-connection
reservation race PASS. `verify:postgres` equivalent: reused schemas/API builds +
`npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs` PASS.
Visual1440/390 всех7, inventory900 и live read-only links PASS; отсутствующие
READY фотографии показаны заглушками. Логи `.tmp/products-ux-*.log`, снимки
`output/playwright/products-ux-v2/`. Рабочая БД/production не менялись;
полные frontend/E2E/release suites не запускались вне затронутого scope.
Применены Development Toolkit, UI/UX практики, Code Reviewer и Git Workflow Master.

02.10 ROLES — CLOSED / CI_PASS: [checkpoint](task-state/CABINET-UX-2026-10-02.md),
[ADR017](../architecture/adr/017-temporary-local-full-access.md). FULL_ACCESS для clinic/supplier/admin;
роли сохранены, tenant/identity/capabilities действуют. Root и contract/PG/runtime/config PASS;
57 RBAC + 3 full-access browser PASS, local21 pages PASS. Redesign отложен.
Код4aa1e00; CI37011303819 / Security37011303920 completed/success, attempt1.

02.10 SHARED-THEME — CLOSED / CI_PASS: [checkpoint](task-state/SHARED-THEME-2026-10-02.md),
[контракт и аудит](../ui-ux/SHARED_SEMANTIC_THEME.md). Общая светлая палитра v1,
Fluent/CSS состояния, auth/public/workspace overrides, Tag tones и keyboard modality.
Typecheck13/13, unit12/12, targeted UI61/61, canonical build/budget, browser51/51,
последующая StatusTag regression2/2 PASS. Root/local gates и targeted reuse отражены
в checkpoint. Рабочая БД, deploy, внешняя identity и full dark acceptance вне scope.
Код d067809, CI36928758840 / Security36928758801 completed/success (первая попытка).

Baseline30.09.2026: main@2a816c337bae15f6684318cf26d21bf6f71cb3c5.
Обновление01.10: отдельный согласованный PERFORMANCE-CI-DELIVERY выпуск ниже.
Исторический PASS применим только к своим входам и границе.
Публикация, наличие кода и production readiness — разные состояния.

Планирование01.10: [Foundation §6](../backend/DENTMARKET_BACKEND_FOUNDATION_V2.md#6-разделение-остатка-внутренний-контур-и-техдолг-внешней-готовности)
отделяет внутреннюю работу на synthetic fixtures от DEFERRED_EXTERNAL и
DEFERRED_DECISION. Это классификация существующих обязательств, не новый PASS
функций и не разрешение внедрять интеграции. Смешанные POST/DEMO/media этапы
не считаются принятыми по локальным тестам их частей.

## Датированные результаты и ограничения

Строки относятся к указанным в них версиям. Итог CORE09 от02.10 заменяет
прежний NOT_ACCEPTED внутреннего CORE на30.09, но не закрывает production.
Фразы «CORE08 начат», «CORE09 впереди» и DEV_PENDING в ранних receipts — история;
фактическое состояние миграций/позднего WIP сверяется в R0, не выводится из них.

| Область | Статус | Доказательство / ограничение |
| --- | --- | --- |
| CORE-09 итоговая приёмка | LOCAL_CORE_PASS | [CORE-09](task-state/CORE-09-INTERNAL-2026-10-02.md): все CORE01–08 outcomes сведены к64591bc. CI36996467232/Security36996467259 SUCCESS: root types/lint/unit/build, PG/upgrade/tenant/rollback/races, authority/restore, contracts/config/runtime, extended API4 suppliers, canonical browser57/57 и FlowB3 7/7. Дополнительно local go_live build/budget и promotion browser2/2 PASS. Self-review без новых критических findings; POST-BE/POST-FULL/production не приняты |
| CORE-08.1–08.5 внутренний контур | CLOSED / CI_PASS | [CORE-08](task-state/CORE-08-INTERNAL-2026-10-02.md):64591bc опубликован/remote verified. Shared auth/MFA/upload/operator contracts; ESLint/CI/npm-only; preallocation/route/Next proxy limits; production go_live/Swagger policy. Полный CI36996467232/Security36996467259 SUCCESS; максимальный10MB upload и oversized/chunked413 PASS.5 dev-only advisories отдельно, runtime audit0; production/working DB не затронуты |
| CORE-06.1–06.6 внутренний контур | CI_PASS | [CORE-06](task-state/CORE-06-INTERNAL-2026-10-02.md): очередь9 доменов, назначения/CAS/history, support/internal notes, текстовые buyer/supplier/operator диалоги; personal cursor, escalation, retry/draft, focus/390px. PG upgrade/tenant/replay/dedup, core-contract320, runtime, canonical browser55/55 + targeted keyboard PASS; root typecheck8/unit7/build5/bundle3 PASS. 4023881, CI36976595298 / Security36976595308 SUCCESS. Внешние каналы/production не приняты |
| CORE-07.1–07.3 внутренний контур | CLOSED / CI_PASS | [CORE-07](task-state/CORE-07-INTERNAL-2026-10-02.md):3f2002b + corrective7cec2fa опубликованы, remote verified. Typecheck2/focused regressions/PostgreSQL3/Prisma/runtime/core-contract2/webbuild/bundle/browser2 PASS. CI36990679071 и Security36990679215 SUCCESS: verify/PG/containers/CodeQL/dependencies. Исправление CI — test inventory lazy panels20→21; runtime неизменён. Точные суммы/tenant/dataset/UTC/replay/rollback и3 роли1440/390 проверены. Working150000 не применена; CORE08 начат, CORE09 впереди |
| CORE-05.1–05.3 внутренний контур | CI_PASS | [CORE-05](task-state/CORE-05-INTERNAL-2026-10-02.md): email proof CAS, безопасные приглашения/повторная доставка, сотрудник/роли/disable, отзыв сессий, MFA concurrency. Schema/client/OpenAPI; реальный browser flow BUYER/SUPPLIER/OPERATOR. 0021438, CI36936601972 / Security36936601908 SUCCESS. Root types/unit с affected reruns, PG/core/runtime/config/build/budget, canonical browser и local auth PASS. Рабочая БД, внешняя доставка/identity и реальные сотрудники вне scope |
| CORE-01.1–01.3 внутренний контур | CI_PASS | [CORE-01-INTERNAL](task-state/CORE-01-INTERNAL-2026-10-01.md),831f7e0/df1f399, CI36845016859 и Security36845016749 SUCCESS: effective framework dates, synthetic PostgreSQL lifecycle; юридические тексты/боевые организации/ЭЦП не приняты |
| CORE-02.1–02.4 внутренний контур | CI_PASS / DEV_RESTORED | [CORE-02-INTERNAL](task-state/CORE-02-INTERNAL-2026-10-01.md): exact partial/overpayment, bilateral reduction/history, review/dispute/working-hour timers. Typecheck/unit/PG upgrade+transactions/core/runtime/build/bundle, canonical browser43/43 и real API2/2 PASS; f893f8f опубликован; CI36852606548 и Security36852606570 SUCCESS. Две локальные миграции применены по отдельному разрешению; каталог505/510 сохранён, dev восстановлен; внешние деньги не менялись |
| CORE-03.1–03.4 внутренний контур | CI_PASS / DEV_RESTORED | [CORE-03-INTERNAL](task-state/CORE-03-INTERNAL-2026-10-01.md): split shipment/receipt, manual return stages, exact money/quantity, party consent, reorder/revalidation. Typecheck/unit/PG upgrade/core/runtime/build/bundle, canonical browser46/46, live API desktop+390 PASS. 1abeb4d опубликован; CI36859245986 и Security36859246168 SUCCESS. Миграция120000 применена по отдельному разрешению, каталог505/510 сохранён, dev go_live health/catalog200; внешний перевод денег не выполняется |
| CORE04.1–04.4 | ACCEPTED в ограниченном scope | 278be21; CI36127372917 и Security36127373128 SUCCESS |
| CORE04.5 | ACCEPTED в ограниченном scope | 73ac601; CI36355260705 и Security36355260722 SUCCESS |
| CORE-04.6–04.7 внутренний контур | CI_PASS / DEV_PENDING_APPROVAL | [CORE-04-INTERNAL](task-state/CORE-04-INTERNAL-2026-10-01.md): согласованные immutable версии discount/N+M, history/min30/price-lock, nonstack, atomic gift reserve/compensation, bilateral reduction, split shipment promise/reorder; supplier/operator/public/order UI. PG upgrade+transactions, core/runtime/config, typecheck/unit/build/budget, pilot46/46 и real go_live2/2 desktop/390 PASS. f14cbe1 опубликован, CI36874461180 и Security36874461153 SUCCESS. Миграция140000 только в audit DB; рабочий dev остановлен. Реальные акции/цены и production не приняты |
| A01–A18, canonical web/API/worker | LOCAL_PASS | Опубликованы в2a816c3; исправления цены/партии/offer/order/UI/TTL/read models и проверки ниже |
| Unified frontend | CI_PASS / live rollout NOT_ACCEPTED | apps/web, canonical build/browser/budget, release api/web и ingress; оба Docker targets PASS на75e0e21 |
| Полный CORE01–09 — исторический срез30.09 | NOT_ACCEPTED на30.09; заменён LOCAL_CORE_PASS02.10 | Сохранён прежний отрицательный статус; актуальная граница внутренней приёмки — строка CORE09 выше. POST-FULL/production отдельно |
| POST-BE / POST-FULL | NOT_ACCEPTED | Отдельные приёмки одной revision/data/environment; не закрываются этим аудитом |
| Optional go_live blocks | COMPOSED / PARTIAL | Локальная видимость не означает полноту продукта, LIVE_VERIFIED или production |
| Production / внешние providers | NO-GO / NOT_ACCEPTED | Требуются выбранные реальные provider/legal/infrastructure receipts |

## Выпуск PERFORMANCE-CI-DELIVERY01.10

[Карточка и журнал попыток](task-state/PERFORMANCE-CI-DELIVERY-2026-09-30.md).
Выпуск8045225 и container fix75e0e21 опубликованы в origin/main; remote SHA
подтверждён. [CI36772750254](https://github.com/NikIg228/PlatformaMarket/actions/runs/36772750254)
и [Security36772750368](https://github.com/NikIg228/PlatformaMarket/actions/runs/36772750368)
SUCCESS на75e0e21: verify, PostgreSQL/authority/backup-restore, api/web images,
dependencies/storage и CodeQL. Первый container FAIL исправлен, attempt2 PASS.
Итоговый docs-only receipt использует REUSED_PASS тех же runtime inputs;
собственные docs checks PASS. Исторические failures ниже сохранены.

| Проверка | Фактический результат |
| --- | --- |
| Production dependencies | npm audit --omit=dev --audit-level=high: PASS0; parser controls и isolated security-storage PASS |
| TypeScript / unit | typecheck13/13 PASS; API/E2E последующие typechecks PASS. Составной full unit PASS:443 API сразу, PDF target8/8 после cold-import setup fix, remaining11 package tasks PASS |
| Canonical build / JS budget | `npm run build`:7/7 PASS. public entries23JS/1,118,819raw/340,741gzip максимум; ceilings24/1,500,000/450,000 сохранены |
| Core / PostgreSQL | PASS119 schemas/43 verified operations; PG tenant/rollback/concurrency и новые supplier pages PASS. Один core startup retry с неизменным45s timeout |
| Browser | Canonical38:32 сразу +4 focused PASS после test-only исправлений +2 comparison/login/cart retry на390/1440; FlowB3 canonical7/7 PASS; финальные measurements2/2 PASS |
| Runtime / configuration | Runtime split3roles PASS; production-config и readiness8/8 PASS; Compose/Caddy native validation canonical/legacy PASS; container build локально NOT_RUN, нет Docker engine |
| Hosted full graph | typecheck13/13, npm test, build7/7 и все настроенные API/runtime gates PASS; FlowB3 7/7 и browser38/38 едиными запусками |
| Документация | Archive305 entries/hash/semantics, active/archive links; финальный diff и protected WIP review PASS |
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

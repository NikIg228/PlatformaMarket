# CORE-06 — операторские процессы и внутренние диалоги

## Итог приёмки02.10 — CLOSED / CI_PASS

main@0021438 + scoped CORE06 diff, один primary writer. Все обязательные local gates
PASS. Последние попытки: typecheck8 13/13 (30.721s), unit7 12/12 (2.793s,11 cache;
полный unit6 71.078s PASS), canonical browser7 55/55 (2.9m), targeted browser8
1/1 (58.5s) после queue-focus review. Web build5 и bundle3 PASS. PG1/contract1
(320operations/172components)/runtime1/prisma-final REUSED_PASS: schema/API/tests,
lockfile и профиль не менялись после их успешного прогона. Логи .tmp/core06/.
Diffcheck/review обязательны перед staging. Снимок scoped paths/hash хранится
в .tmp/core06/delivery-files.txt и delivery-source-hashes.csv перед commit.

Диалоги сохраняют текст при network failure, повторная отправка не дублирует
сообщение; личные непрочитанные не смешиваются с прочтением организацией.
Оператор видит диалог после эскалации, назначения/решения имеют version/reason/history.
Отсутствующий внешний канал даёт failure, in-app projection дедуплицируется.
Проверены Enter/Escape, focus return, desktop1440 и mobile390; screenshots просмотрены.
Scope не включает production/реальную доставку каналов/рабочие KPI. Rollback guard
существует, не переписан. Локальная рабочая миграция была отдельно разрешена владельцем
и применена ранее с сохранением counts505/510/32/17; новых DB writes этой проверкой нет.
Прежние5 WIP исключить из commit; generated web next-env также не публиковать.
Следующий шаг: scoped commit/push main, remote SHA и фактический CI/Security.
После CI_PASS перейти CORE07–09 и итоговому аудиту по текущему разрешению.
Dev остановлен для checks; восстановить go_live после проверок последовательности.

## Хронология и попытки (старые статусы ниже не являются текущими)
Review02.10: применены development-toolkit (execution/frontend/verification/review),
Agency Code Reviewer (contracts/tenant/CAS/replay/failure) и Git Workflow Master
(scoped conventional commit/fast-forward/preserve WIP); без отдельных агентов.
Проверены Conversation row lock/sequence/personal cursor, operator escalation
scope, support internal notes/assignee/CAS/history, queue tenant metadata,
notification dedup/missing adapter, migrations и сохранённый import rollback guard.
Новые modal close callbacks возвращают focus; shared default DmDialog не изменён.
Browser7 PASS55/55,2.9m; typecheck7 PASS13/13,37.422s; unit6 PASS12/12,71.078s;
bundle2 PASS. Скриншоты трёх ролей1440/390 просмотрены, overflow нет.
Review обнаружил такой же риск возврата focus в новом OperationAssignmentPanel:
применён controlled close + возврат к opener, добавлен keyboard regression.
Build5/targeted browser8 и затронутые финальные TS/unit/bundle ещё выполняются.
Full browser55 и backend PG/contract/runtime PASS переиспользуются для
неизменённых путей; после final checks — scoped publication/фактический CI.
Актуальный checkpoint02.10: browser blocker исправлен. Controlled close/exit
сам по себе не устранил aria-hidden (web5 FAIL21.9s). Подтверждён корень:
у Dialog нет trigger/restorer target; focus после удаления теряется на body.
SupportOperations сохраняет opener и возвращает focus при закрытии, при переходе
фокусирует стабильную именованную section. Никакого ручного aria-hidden/force.
web6 PASS1/1,12.5s: три роли/retry/escalation/assignment/operator send/390px.
Добавлены keyboard Enter/Escape/return-focus assertions; полный web7 выполняется.
Typecheck5 FAIL(React useRef требует initial), исправлено; typecheck6 PASS13/13.
Build3/4 PASS; новые shared/UI правки требуют финальных root unit/typecheck/bundle.
Dev6116 и его дочерние процессы остановлены перед build; сейчас только тестовые
серверы принадлежат Playwright. Dev восстановить после всех проверок.
Статус: CLOSED / CI_PASS. Primary01a0f302-2d38-75d1-b79c-141e7428b533, один writer.

Последнее решение владельца02.10: самостоятельно исправлять возникающие блокеры,
ошибки/конфликты и довести CORE06–09+аудит. Для этой последовательности прежний
числовой лимит попыток не требует остановки/повторного разрешения; сохранять
попытки и evidence, каждый повтор только после диагностики/новой гипотезы.
Нельзя пропускать gates, ослаблять проверки/guards или расширять EXT/данные.
Новая гипотеза подтверждена исходниками установленного Fluent: закрывать Dialog
через open=false, дождаться surfaceMotion exit, затем unmount/навигация; добавлен
optional onClosed в DmDialog и controlled open в SupportTicketPanel. NOT_VERIFIED.

Dev восстановлен02.10 11:28+05: npm run dev:local, go_live, launcher6116,
API13740/4012, web11564/3000 из canonical root. Launcher подтвердил health,
root и непустой catalog-search200; оставлен работающим. Логи
.tmp/core06/dev-restored-20261002.{out,err}.log. Diffcheck PASS; commit/push нет.

Актуальная остановка02.10: unit environment blocker исправлен: isolated mock и
pilot/go_live assertions. Typecheck4 PASS13/13,46.112s. Root unit4 FAIL85.94s:
неизменённый buyer order-profile test превысил5s при конкурентном web build.
Без изменения timeout/assertions, после окончания build: unit5 PASS12/12,47.594s.
Web build1/2 и bundle1 PASS. Prisma final validate PASS (фиктивный URL, без DB).
Browser1: canonical54 PASS/1FAIL (CORE06),4m. CORE06 проходит buyer/supplier,
retry draft, resolve/escalation, operator ticket assignment; затем зависает
доступное поле связанного диалога. Cleanup маскировал locator error — исправлен
через allSettled; default action timeout15s,90s test unchanged. Fixture выбирает
offer без прежнего conversation этого buyer, поэтому повторы независимы.
web-2.log: CLI флаг передан не тому npm, браузер NOT_RUN; исправлен вызов
`npm run db:test -- run e2e --workspace=@marketplace/e2e -- --grep CORE06`.
web-3.log (фактический browser2): FAIL21.9s, operatorChat.getByLabel("Сообщение").
web-4.log (фактический browser3): FAIL21.5s; диагностический DOM подтвердил
panelPresent/inputPresent=true, корректные label/id, hiddenAncestors=['DIV'].
Screenshot operator-failure.png показывает видимый, но скрытый от accessibility
tree чат после unmount открытого DmDialog. Проверенная гипотеза разнести переход
через useEffect не помогла, этот product patch снят. Больше запусков не было.
Точный следующий шаг: в SupportTicketPanel управляемо закрывать Dialog (open=false)
и завершать его modal/focus cleanup до unmount/перехода к ConversationWorkspace;
повторить этот же browser regression после отдельного разрешения продолжения.
Не обходить aria-hidden/Tabster, не использовать force/hidden locator и не повышать
таймаут. 54 остальных browser PASS переиспользуются при неизменённых входах.
CORE07–09 не начаты; публикация/итоговый аудит не выполнены. Dev восстанавливается
штатным dev:local; новая рабочая миграция для этого не требуется.

Последний запрос02.10: исправить unit configuration, завершить проверки CORE06,
затем сразу CORE07/08/09 и итоговый аудит всех задач. Разрешён дополнительный
цикл проверки известного unit blocker; прежние3 запуска сохранены. Следующий
root unit запуск4 (возобновлённый цикл1), максимум ещё2 обоснованных повтора.
Исправление: isolated environment mock как в соседних domain unit suites,
отдельная проверка pilot/go_live очереди акций; БД для unit не нужна.
Dev13212 потребуется временно остановить для canonical browser/build; восстановить
после проверок. Рабочие миграции применены по отдельному разрешению ниже.

02.10 отдельный запрос владельца: поднять dev; явное «да» разрешило применение
трёх pending миграций к local marketplace/public и запуск. Применены140000
offer_promotion_versions,120000 internal_conversations,121000 operator_queue_domains;
prisma migrate deploy PASS. До/после:505products,510offers,32orders,17users.
Без seed/reset. `npm run dev:local` из canonical root, go_live, launcher PID13212,
API4012, unified frontend3000; health/root/catalog-search HTTP200, каталог непустой.
Логи .tmp/core06/dev-20261002-2.{out,err}.log. Первая попытка фонового запуска
завершилась до npm из-за пробела в пути; вторая с quoted path успешна.
Dev оставлен работающим. Это не приёмка CORE06 и не разрешение продолжать CORE07–09;
unit blocker и незавершённые web gates выше/ниже сохраняются. Commit/push не было.

Остановка02.10 после третьего запуска root unit gate по AGENTS§7.1.
typecheck3 PASS13/13,80.327s. unit3 FAIL60.622s: единственный failed API test
`OperationsService > aggregates actionable business blockers into one queue`,
`environment()` на operations.service.ts363 требует DATABASE_URL, отсутствующий
в unit fixture. API96files/486tests PASS,1file/1test FAIL; полный root набор
прерван turbo. Логи .tmp/core06/typecheck-3.log и unit-3.log.
Всего root unit запусков3: FAIL(static import count), PASS, FAIL(new queue
environment dependency). Это не три одинаковых failure; лимит gate не сброшен
новыми изменениями. Повтор4 не запускался, failed test не ослаблен.
Следующий точный шаг после разрешения продолжить проверку: задать изолированную
конфигурацию environment в operations.service.spec.ts (без реального подключения),
проверить pilot/go_live ветвь очереди. Затем оставшиеся web gates/review/publication.
Новых commit/push нет. Последний опубликованный0021438 — CORE05, не CORE06.
CORE07–09 не начаты; итоговый аудит всей последовательности ещё не выполнен.
Все собственные команды завершены, dev/API/browser servers не запущены.

Актуальный checkpoint 02.10 04:57+05: main0021438, исходные5 WIP сохранены.
Реализованы contracts/API/client, диалоги и support/notifications UI, очередь9
доменов с assignment/CAS/history и object view. Обе новые миграции120000/121000
применены только к disposable audit DB. Рабочая БД не менялась.
Root typecheck2 PASS, unit2 PASS; после дополнительных UI/регрессий идут
typecheck3 и unit3 (.tmp/core06/*-3.log). Первая ошибка unit была static expected
18 dynamic imports: добавлены две поверхности, проверено20. TC1 — nullable
JSON/offer, исправлены guards. Счётчик не сброшен.
verify:core-contract1 PASS:320operations/172components; schema/API prerequisites
собраны. PostgreSQL1 PASS: `npm run db:test -- exec -- node
scripts/verify-postgres-integration.mjs`, включает новые real HTTP/PG сценарии
tenant/replay/personal read/escalation/CAS/private notes/projection dedup и весь
существующий purchase regression. `.tmp/core06/postgres-1.log`, exit0.
Runtime1 PASS: `node scripts/verify-runtime-split.mjs` после того же API build,
три роли и entrypoint/production guards; `.tmp/core06/runtime-1.log`.
Добавлен canonical browser regression conversations.spec.ts (три роли,390px,
keyboard, network failure/draft/retry, escalation/assignment/support), пока NOT_RUN.
Исправлены retry context lookup и сохранение старых страниц при chat polling.
Далее: окончательные TS/unit, web build/bundle/browser, review/docs/push/CI.
CORE07–09 не начаты; продолжать только после зелёного CORE06. Процессов dev нет.
Основание: разрешение владельца02.10 выполнить CORE05–09 последовательно.
CORE05 завершён на main0021438ea9f25b7543d8f12a28af14c1ff2bad67;
CI36936601972 и Security36936601908 completed/success. Remote SHA подтверждён.

## Граница

Оператор: очередь с причиной/приоритетом/ответственным/сроком/историей и переходом
к объекту; обращения/споры через защищённые операции. Клиника и поставщик:
текстовые диалоги по предложению или supplier order по Product22.12, персональные
непрочитанные/прочтение организацией, resolve/reopen, эскалация с причиной.
In-app projection CORE02/03 событий без дублей; отсутствующий внешний адаптер
не означает доставку. Проверить существующий guarded import rollback, не rewrite.
Контракты → API/client → общий Fluent UI → synthetic проверки трёх ролей.

Никаких внешних каналов/вложений/голоса/холодных рассылок, arbitrary SQL или
коммерческого подтверждения сообщением. Рабочая БД и pending140000 вне scope;
новые migrations только disposable dentmarket_audit_20260914 через db:test.
Пять прежних WIP сохранить (.codex/project-session.json, четыре legacy next-env).
Own docs receipt CORE05 допустим в текущем наборе; других product WIP нет.

## Inventory и минимальные изменения

OperationsService/work-queue агрегирует семь очередей, UI выводит первые задачи;
не хватает workflow metadata и истории. Outbox dead-letter replay уже защищён.
SupportTicket/Message/Link, SLA/assignee и service есть; нужны проверенные workflow
контракты/UI, причина/история, проверка assignee и связанные обращения диалогов.
Notifications generic projection пропускает lowercase organizationId и содержит
mock success при отсутствии email/SMS provider. Resolve адаптера стоит вне try;
исправить false success и recovery, проверить recipient scope/idempotency.
Диалогов buyer/supplier не найдено; существующий AI conversation — другой домен.
Новые модели должны сохранять организационную историю и персональные read cursors.

## DoD / gates / лимиты

Root typecheck/unit/diffcheck; schema/API build и core-contract; Prisma validate
и upgrade на разрешённой test DB; PostgreSQL tenant/replay/rollback/concurrency;
runtime split; canonical web build/bundle/browser и targeted трёхролевая проверка
desktop/390px. Изменённые notification/operations tests и worker projection.
Self-review, scoped commit/push main, remote SHA и фактический CI/Security.
Набор уточняется по реальным changed paths; успешные неизменённые gates reuse.
Попытки всех новых gates0; probe2m/server5m/command20m/suite45m/diagnosis15m,
максимум3 на gate/блокер, остановка на повторном одинаковом failure без гипотезы.

## Вопросы

Q01 из CORE05 решён владельцем: production guards CORE08 сохранить, реальные
сервисы и запуск отдельно. Для CORE06 новых обязательных решений пока нет.

## Checkpoint

Проверены root/main/HEAD0021438/dirty scope; CI CORE05 зелёный. Процессов dev нет.
Добавлены (ещё NOT_VERIFIED) contracts/client/OpenAPI, Prisma models
BusinessConversation/ConversationMessage/ConversationRead, API в SupportModule.
Доступ через действующие support.ticket.view/create, operator дополнительно
manage + capability + существующая эскалация. Transaction row lock, sequence,
scoped message replay, CAS resolve, personal monotonic read cursor; организация
сохраняет историю. Новый SQL только параметризованный серверный query, не UI SQL.
Notification lowercase recipient и missing adapter catch исправлены; локальный
mock success убран, regression tests добавлены. Gates ещё0, миграция не создана
и не применялась. Следующее: workflow очереди/поддержки, UI, migration и проверки.

### Checkpoint реализации и первых проверок

Контракты/client/OpenAPI, четыре модели/миграция20261002120000, API диалогов,
операторское назначение/CAS/history, защищённое support workflow и UI трёх ролей
добавлены, пока NOT_VERIFIED. Персональные cursor/company-read, отсутствующие
email/SMS adapters дают FAILED, retry DEAD сохраняет номера попыток; projection
учитывает organizationId/opt-out и dedup через createMany(skipDuplicates).
UI сообщения/счётчик/offer+order entry, support section, queue assignments и
object context. Рабочая БД не менялась. Пять прежних WIP сохранены.
Prisma validate1 FAIL только missing DATABASE_URL; validate2 PASS с фиктивным
URL (без подключения); после добавления ticket.version/requestHash schema
проверена генератором, требуется финальный validate. Generate PASS.
Schema build1/2 PASS при изменённых contracts. Узкий API/UI tsc1 PASS до
новых workflow UI. Root typecheck1 FAIL44.8s: Json reasons.join/null offer в
operation-workflow.service. Исправлены explicit array/string guard и optional
relation; повтор ещё не запускался. .tmp/core06/typecheck-1.log.
Миграция сгенерирована из HEAD schema без подключения и reviewed: только новые
таблицы/FK/checks, nullable Notification.requestHash и SupportTicket.version1.
Новые unit/schema regressions подготовлены; unit gate0. Далее migration upgrade
на approved audit DB, realHTTP/PG tenant/replay/read/escalation/races и UI gates.

### Публикация02.10

40238812d4b7b0014ec23cd50a11825cfe0b0099 опубликован обычным push origin/main;
remote SHA совпал. Outgoing range был ровно1 commit, fetch показал0/1,
staged diffcheck PASS,66 проверенных файлов,5 прежних WIP исключены.
CI36976595298 и Security36976595308 IN_PROGRESS; это ещё не CI_PASS.
GitHub CLI отсутствует, статусы прочитаны штатным GitHub connector по точному SHA.
Рабочий web next-env имеет только нормализацию окончаний строк, product diff пуст;
его не включали в commit. CORE07 пока только read-only сверка требований.

CI receipt02.10: CI36976595298 и Security36976595308 completed/success на
40238812d4b7b0014ec23cd50a11825cfe0b0099. Все4 CI jobs и оба Security jobs зелёные.
CORE06 CLOSED/CI_PASS; далее CORE07 в прежнем согласованном scope.

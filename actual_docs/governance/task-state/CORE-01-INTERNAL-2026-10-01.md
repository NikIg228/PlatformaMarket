# CORE-01-INTERNAL — договорные версии, акцепт и допуск

Обновлено01.10.2026. Состояние: CLOSED / internal scope CI_PASS.
Владелец: primary01a0f302-2d38-75d1-b79c-141e7428b533, единственный writer.
Основание: новый запрос владельца после371aa9d — приступить по списку к
внутренней реализации без внешних интеграций и боевых данных. Это разрешённая
последовательность Foundation6.2; сначала CORE01, следующий пункт только после
его обязательных gates/review/публикации/CI. Отдельные mixed/proposal/EXT и
нерешённые policy/legal вопросы не превращаются в автоматический scope.

Checkout: C:\Users\user\Desktop\dentmarket-kz-main, main@371aa9d5915786e25d94926f69db44c24730bba2.
Исходный WIP: .codex/project-session.json и четыре legacy next-env.d.ts;
сохранить без изменений и не stage. Новые worktrees/агенты не разрешены.

## Результат и граница

Источники: [Foundation6.2](../../backend/DENTMARKET_BACKEND_FOUNDATION_V2.md),
[Product9.7](../../product/DENTMARKET_PRODUCT_V2.md),
[ADR013](../../architecture/adr/013-supplier-common-terms-and-admission.md).
Сначала проверить существующие supplier terms/admission, marketplace agreement,
onboarding и optional buyer–supplier agreement paths. Не заменять общие условия
новыми индивидуальными договорами/двумя обязательными ЭЦП.

DoD CORE01: version/actor/organization/time/evidence согласованы; DRAFT нельзя
принять; новый текст сохраняет прежний акцепт и snapshot заказа; повтор
идемпотентен; акцепт и операторский допуск раздельны; отсутствующий/истёкший/
недействующий gate не даёт публикацию/покупку там, где обязан блокировать.
Опциональный buyer–supplier contract: ONE_TIME доступен без него, чужой или
истёкший нельзя использовать как FRAMEWORK_AGREEMENT. Загруженный PDF/ручной
учёт/акцепт/квалифицированная подпись не подменяют друг друга.
Реализовать только обнаруженные пробелы и недостающие доказательства.
Юридические тексты, реальные организации/подписи и внешние вызовы вне scope.

## Проверки и исполнение

Пока выполнены только чтение/preflight; gate attempts0. Development Toolkit
execution/backend/verification и Market profile прочитаны. Agency Backend
Architect применён к границам контрактов; перед review — профильный checklist.
Точный change-dependent набор уточнить после inventory, до запуска:
TS минимум typecheck/full unit/diff; core-contract и PostgreSQL для договорных
purchase/publication/tenant/version/replay границ. API runtime change добавляет
build/runtime-split; затронутый UI — build и canonical browser; schema change —
migration/validate/upgrade на disposable DB. Не повторять прежний выпуск целиком.
Тестовая среда: предназначенная disposable audit DB после нового guard/preflight,
только синтетические fixtures, штатные local/mock transports. Рабочую БД не читать
как источник fixtures и не reseed. До runtime проверить принадлежность процессов.
Лимиты Workflow: до3 попыток на gate;20мин отдельная команда,45мин full suite,
15мин диагностика блокера. На stop сохранить причину/попытки/следующий шаг.

Следующий шаг: прочитать ADR013, supplier-terms schema/service/spec и имеющиеся
PG fixtures; составить таблицу contract → implementation → evidence → exact gap.
Commit/push отсутствуют в этом этапе; прежний кодовый CI75e0e21 остаётся только
baseline, не доказательством будущих изменений CORE01.

## Inventory и точный change set

- ADR013: supplier-terms schema/service/unit и старый synthetic API harness уже
  реализуют DRAFT rejection, actor/tenant, replay, отдельное approval/suspension,
  скачивание старой редакции. Переписывание не требуется.
- Checkout уже выбирает framework по exact buyer/supplier, ACTIVE/NON_RENEWING,
  startsAt/endsAt внутри транзакции; ONE_TIME и immutable commercial snapshot
  уже существуют. Existing PostgreSQL snapshot/replay gate остаётся применимым.
- Найден concrete gap: BuyerSupplierAgreementsService.current не проверял
  startsAt, поэтому будущий договор показывался доступным раньше checkout.
  Добавлена проверка effective interval; публичная форма ответа не меняется.
- Добавлены unit regression и PostgreSQL helper verify-contract-lifecycle:
  synthetic draft/replay/reacceptance, неизменяемое evidence первой редакции,
  новый PENDING вместо переноса допуска, stale organization/review и suspension;
  effective framework/foreign parties/expiry при доступном ONE_TIME.
  Helper встроен в штатный verify:postgres с cleanup своих fixtures.
- Runtime legal sources остаются пустыми DRAFT. Миграций/UI/внешних вызовов нет.

Gates выбраны до запуска: typecheck (attempt1 PASS13/13), npm test, API build,
verify:postgres, verify:core-contract, verify:runtime-split, docs links/diff.
UI/build браузера не требуется для неизменённых UI inputs. PostgreSQL wrapper
подтверждает loopback isolated audit DB, отличается от dev; родительский harness
применяет test seed только туда.

Gate attempts: typecheck1 PASS; npm test1 FAIL из-за5000ms timeout
неизменённого buyer order-profile/pilot, остальные11 tasks PASS (API448 tests).
Обоснованный targeted retry2 без изменения inputs/timeout: оба profile tests
PASS за826ms, исходный pilot746ms; composite unit evidence PASS с transient
таймаутом первого запуска. Полный набор повторно не запускался.
verify:postgres attempt1 RUNNING, включая schemas/API build prerequisites.
Логи: outputs/core-01-internal-20261001/{typecheck-1,unit-1,unit-retry-2,postgres-1}.log.

Следующее обновление: PG1 FAIL в новой фикстуре (warehouse FK: supplierProfile
не создан); parent cleanup завершился без ошибки. Добавлен synthetic профиль.
Schemas/API build из PG1 PASS, код после него не менялся. PG2 запускается через
db:test underlying verify-postgres-integration.mjs с переиспользованием build.
runtime1 FAIL до probe: повторная prisma generate получила EPERM на DLL,
занятой PG-процессом. Это ошибка запуска проверки, не приложения.
runtime2: underlying script на том же готовом dist; повторный build не нужен
по Workflow4.2. Core-contract также использует выполненные prerequisites.

## Локальный итог перед публикацией

PG2 PASS с cleanup: contract lifecycle, прежние checkout snapshot/tenant/replay/
rollback/race gates; runtime2 PASS api/worker/all и entrypoint guards.
Core-contract1 PASS:119 schemas,301 OpenAPI operations,43 core operations,
response/error contract. Typecheck13/13 PASS; unit composite PASS с одним
transient timeout/retry, описанным выше. Docs1 PASS:436 активных ссылок,
481 архивная,305 archive entries, пять прежних WIP hashes сохранены.
API build PASS из PG1 переиспользован для PG2/core/runtime; повторных builds нет.
UI/browser/production/migrations не запускались: эти inputs не менялись.

Self-review: изменена только effective-date фильтрация существующего API,
форма контракта/permissions прежние; новые fixtures охраняются parent DB guard,
изолированы runId и убираются до parent cleanup. Legal DRAFT не изменён.
Применены Development Toolkit (backend/security/review/verification),
Agency Backend Architect для границ, Code Reviewer для lifecycle/tenant/evidence,
Git Workflow Master для точного staging/обычного push. Это self-review без агентов.
Новых блокирующих замечаний в этом change set нет. Публикация и CI пока PENDING;
до их результата CORE02 не начинать.

Публикация:831f7e0f6289d5efdb6cfa952daa7bccdf710d6a отправлен обычным push
в origin/main, remote SHA совпал. CI36844329689 и Security36844329678 RUNNING
на этом SHA, hosted attempt1. Собственных тестовых процессов больше нет.
После локальных gates обнаружены новые чужие dev listeners3000/4012
(PID16188/8696, старт14:39+05, Next dev и API node dist); не останавливать и
не считать их тестовой средой. Кодовые dirty paths сверх пяти исходных не появились.

CI attempt1: web container job110310718695 FAIL на чистом build, TS2307
@marketplace/schemas в packages/ui. API image build успешен по шагам.
Причина подтверждена package.json/Turbo graph: UI использует schemas в исходниках,
но workspace dependency отсутствовала, ^build не задавал порядок. Это блокер
обязательного gate текущей публикации; минимальная поправка явно сообщена владельцу.
Добавлена только существующая внутренняя dependency0.0.0 в packages/ui/package.json
и соответствующий lockfile entry (две строки; external versions без изменений).
Offline package-lock consistency PASS; Turbo dry-run подтверждает schemas#build
в dependencies ui#build; scoped UI build PASS. Полный canonical Docker build
проверяет hosted CI attempt2: локального Docker engine нет, чужой dev не трогаем.
Typecheck2 / unit3 запущены заново из-за изменения workspace graph; не из-за docs.
Runtime/core/PG inputs кода/версий зависимостей прежние, их evidence переиспользуется.
Счётчик unit не сброшен: это третья попытка с новой гипотезой/изменённым graph.
Typecheck2 PASS13/13; unit3 full npm test PASS12/12 tasks (50.2s), без timeout.
Состав поправки проверен: только workspace edge и её lockfile запись плюс checkpoint;
никаких изменений внешних версий, бизнес-логики или данных. Staged/diff checks PASS.
Поправка опубликована:df1f3993981f264af446568aee8de85351d98c9f, origin/main
SHA подтверждён. CI36845016859 / Security36845016749 RUNNING на новом SHA.
Не запускать ещё один экземпляр checks/CI без нового основания. CI budget45мин.
Старый CI36844329689 сохранён как FAIL(web build), новый результат пока PENDING.

## Окончательный результат

Внутренний CORE01 закрыт на df1f3993981f264af446568aee8de85351d98c9f
(831f7e0 — договорный change set, df1f399 — обязательная поправка build graph).
[CI36845016859](https://github.com/NikIg228/PlatformaMarket/actions/runs/36845016859)
и [Security36845016749](https://github.com/NikIg228/PlatformaMarket/actions/runs/36845016749)
SUCCESS на точном SHA. Hosted typecheck13/13, unit12/12, build7/7,
контейнеры api/web, PostgreSQL lifecycle/authority/backup-restore, core/runtime/
production checks, FlowB3 7/7 и canonical browser38/38 PASS. CodeQL/dependencies PASS.
Первый hosted web build FAIL устранён; локальные попытки сохранены выше.
Юридическое утверждение DRAFT, реальные организации, внешняя подпись/банки
и production deploy не выполнялись и не объявляются принятыми.
Итоговый docs-only receipt переиспользует runtime evidence df1f399 по Workflow4.2.
Следующий разрешённый внутренний пункт — CORE02; исторические шаги inventory/
RUNNING выше не являются текущим статусом. Новых CI retries не требуется.

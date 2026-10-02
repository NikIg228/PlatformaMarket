# CABINET-UX — содержание и новые компоненты кабинетов

02.10 ROLES — CLOSED / CI_PASS. Код4aa1e004ca534cc8916bfbc99511ffb1e7122acb
опубликован в origin/main, remote SHA проверен. CI37011303819 и Security37011303920
completed/success (attempt1), включая canonical и FULL_ACCESS browser.
Локальное окружение оставлено работающим: go_live/JWT/FULL_ACCESS,
API4012/web3000, clinic8/supplier13 страниц PASS; все три capability проверены
real JWT/no-role fixtures. Роли/назначения сохранены; tenant/identity действуют.
Финальная запись только docs: runtime gates REUSED_PASS с4aa1e00 по Workflow4.2;
новый CI для receipt намеренно NOT_RUN [skip ci]. Redesign/референсы отложены.
Foreign7 WIP сохранены. Следующей фазы и передачи задачи нет.

02.10 ROLES — LOCAL_PASS: временный FULL_ACCESS действует во всех трёх кабинетах.
Сохранены роли/назначения, JWT, активная membership, tenant/capability boundaries;
production требует ROLE_BASED. Redesign/референсы отложены решением владельца.
Root types13/unit12/build7/lint PASS; PG/core-contract322/runtime/config/bundle PASS;
canonical RBAC browser57/57 и full-access real JWT3/3 PASS. Локальный smoke:
clinic8 + supplier13 страниц, policy200/FULL_ACCESS/91 permissions, без role-denied.
Supplier smoke1: ошибочный h1-only waiter на h2 странице; после исправления
инструмента smoke2 PASS, продукт не менялся. Dev go_live/JWT оставлен работающим
из canonical root (launcher9468, API17428:4012/web16912:3000). Working reseed нет.
Review: Frontend Developer, Code Reviewer, Git Workflow Master;
контракты, границы доступа, обратимость и scoped publication проверены.
Публикация и actual CI ещё PENDING; полный журнал в CABINET-UX-2026-10-02.md.

## Последнее решение владельца — 02.10, роли в первую очередь

Текущий разрешённый scope СУЖЕН: завершить только временную деактивацию
ролевых ограничений clinic/supplier/admin, чтобы просмотреть весь контент.
Редизайн, генерация референсов и общая актуализация CORE документации отложены.
Собственные начатые визуальные правки удалены; снимки остаются evidence аудита.
DoD текущего этапа: переключаемая серверная политика FULL_ACCESS, UI управления
сотрудниками без назначения ролей, сохранение identity/membership/tenant/capability,
negative tests + обязательные root/contract/PG/runtime/config/web gates,
review/scoped commit/push/actual CI и работающий canonical local dev.
Новая продуктовая фаза после этого не начинается.

FULL_ACCESS browser1 PASS3/3 (16.8s): BUYER, SUPPLIER390px и OPERATOR1440px
без назначенных ролей, roleless invitation с клавиатуры, canEdit/profile,
supplier legal/payment assignee и operator assignee, foreign tenant/operator403,
blocked member403/empty permissions. E2E types2 PASS. Новый gate включён в CI.
Self-review Code Reviewer + Git Workflow Master: scope только roles/contract/tests/
обратимый local flag; прежние roles и foreign WIP сохранены, секретов в diff нет.
Осталось local dev smoke и commit/push/CI. Никакого redesign после завершения.

Последующие gates: PostgreSQL1 PASS, core-contract1 PASS322 operations/60 explicit
contracts включая AccessPolicy; runtime1/config1 PASS, web-bundle PASS.
Canonical browser ROLE_BASED1 PASS57/57 (3.9m), реальные identity flows всех3 кабинетов
и UI revocation/draft tests сохранены. Full-access browser1 запущен через новый
npm run verify:full-access (только disposable DB), этот gate добавлен в CI.
Canonical delivery2 tests PASS; targeted lint скрипта/spec PASS.
Полный доступ browser дополнен profile.canEdit, supplier legal/payment eligible
member, operator assignee и roleless invite assertions; E2E types2 идёт по этим
новым inputs. Root types/unit/build не повторять: runtime inputs не менялись.

17:54 evidence: serial unit2 PASS12/12 tasks (9 exact cache, buyer/admin/UI fresh);
root build1 PASS7/7 API+canonical web; lint1 PASS; E2E types1 PASS после новых
full-access specs/mocks. Logs .tmp/cabinet-{unit-2,build-1,lint-1,e2e-types-1}.log.
PG1 идёт через db:test wrapper; schemas/API build из root build1 переиспользован
для underlying verify-postgres-integration.mjs и verify-runtime-split.mjs по4.2.
Production config1 идёт с новым negative FULL_ACCESS. Canonical/full-access browser
ещё NOT_RUN, затем self-review/publication/CI/dev. Working DB не меняется.

17:47 checks: schemas build PASS; access-control focused18 PASS; local profile6 PASS;
root typecheck1 PASS13 tasks. Root npm test1 FAIL: buyer order-profile.test.tsx
pilot case timeout5s during simultaneous root typecheck/API suite (19 other buyer
files/96 tests PASS, API suite PASS). No assertion mismatch; CPU contention
hypothesis. Retry2 будет serial turbo test concurrency1 без concurrent types/build;
не менять timeout или assertion. Dev owned tree4476 stopped before checks.
Full-access browser config +3 real JWT/no-role fixtures добавлены; исходные
RBAC browser mocks обновляются под новый policy response, assertions сохраняются.

Первоначальная запись реализации (до приведённых выше проверок): schema/access-policy, API policy endpoint и typed client;
local launcher FULL_ACCESS (остальные defaults ROLE_BASED), production restriction;
центральная permission policy и прямые SQL permission filters; role mutations
заморожены, сохранённые роли не изменены. UI provider/member/admin частично готов.
Gates ещё 0. UI screenshot audit supplier attempt1 остановился на постоянном
onboarding progressbar (инструментальная причина); исправлен selector,
attempt2 исходных settings/notifications/messages/support/analytics PASS.
Последние ancillary screenshots после начала правок не baseline: API policy
ещё не скомпилирован, поэтому виден временный load error. Dev restart впереди.

## Отложенный первоначальный scope — не выполнять в текущей задаче

Исходная запись02.10.2026. Владелец primary01a0f302-2d38-75d1-b79c-141e7428b533.
Основание: владелец запросил актуализацию техдокументации после CORE01–09,
полную переработку содержания внутренних страниц клиники/поставщика,
полировку новых компонентов, screenshot audit и единый удобный UI/UX.
Дополнение подтверждено владельцем: временно деактивировать логику ролей
во всех кабинетах, включая admin; сохранить для последующего включения.
Организационная изоляция и действующая membership сохраняются.

## Checkout / исходное состояние

Единственная папка C:/Users/user/Desktop/dentmarket-kz-main, main,
HEAD a62046a8a4c4a2c69e5bd4cb0658951b02962927. Один writer, без агентов/worktrees.
Foreign7 WIP: .codex/project-session.json, AGENTS.md, Workflow.md,
apps/{admin,buyer,landing,supplier}-web/next-env.d.ts. Не включать в коммит.
Dev go_live/JWT из canonical root работает: launcher4476/API13224/web1228,
3000/4012; working150000 применена по отдельному разрешению,505/510/508/32 сохранены.
CORE09 код принят на64591bc, итоговыйd1c1bd3 CI/Security PASS; это functional
acceptance, не полная визуальная приёмка внутренних страниц.

## Граница / DoD

1. Сделать и просмотреть исходные снимки desktop/mobile clinic/supplier:
cart, orders/list/detail/payment/returns, documents/upload/details, settings/
members/sessions, notifications, messages/support, analytics; supplier dashboard,
products/import/inventory/corrections/proposals/promotions и связанные формы.
2. Устранить визуальные/информационные проблемы: общий page header/toolbar,
компактные списки/таблицы/status, понятные действия/иерархия, предметные empty/
error/loading states. Notifications — компактная лента и колокольчик вместо
гигантских карточек/текстовой шапки. Настройки — логические разделы, заказ —
сводка/товары/оплата/исполнение, документы — рабочий архив. Не скрывать бизнес-факты.
3. Новые компоненты CORE привести к общей Fluent/CSS системе и существующим
semantic tokens. Нативные ссылки навигации сохраняют семантику и получают
оформление; не превращать их в onClick-only controls. Иконки Fluent, без пакетов.
4. Исправить найденную недоступность функций в согласованном full-access режиме,
сохраняя identity/tenant boundary; сначала contract/policy, затем API/UI при
изменении модели доступа. Не выдавать доступ через подмену frontend checks.
5. Актуализировать рабочую документацию/Matrix/Foundation и UI стандарт:
CORE завершённые функции, working migration/dev, различие functional/UI acceptance.
6. Проверить реальные взаимодействия, recovery, keyboard/focus и390/1440px,
сделать и визуально проверить after screenshots. Все выбранные gates PASS,
self-review, scoped commit/push main, actual CI, dev восстановлен в конце.

## Дизайн-контракт

Аудитория — сотрудники клиники/поставщика. Цель — быстро понять состояние
закупки/заказа/документа и выполнить следующий шаг. Сохранить sidebar/маршруты,
бренд, Fluent v9, суммы/версии/согласования, server authority, drafts/idempotency.
Основной текст14px, метаданные12–13px, секции16–18px, h1 24–28px;8px ритм,
белые рабочие поверхности, зелёный brand для главных действий, semantic statuses.
Группировать по задачам, вторичное раскрывать по запросу, без декоративных
метрик/фальшивого контента. Mobile — последовательные блоки/карточки, доступные
touch controls, без горизонтального overflow страницы. Обработчики по возможности
сохраняются; большие route files не наращивать. Taste не применяется к кабинетам.

## Проверки / ограничения

Итерации: focused UI tests по поведению; final root typecheck/lint/unit, canonical
build/budget и verify:web с disposable DB. Новые visual fixtures в test DB,
рабочую БД не reseed. Permission policy change потребует unit/schema/API-client,
negative tenant/operator/production checks и core/runtime/PG по фактическому риску.
До build/test остановить только собственный dev; не build одновременно с Next dev.
Attempt max3 per gate; command20m/browser45m, probe2m/server5m. Сейчас gates0.
Playwright CLI для осмотра; existing Playwright regression suite для приёмки.
Артефакты output/playwright/cabinet-ux, secrets не сохранять в screenshots/logs.
Роли прочитаны: Agency UI Designer, UX Architect, Frontend Developer;
Development Toolkit frontend/execution/verification; Playwright skill.

## Первые findings

- Notifications использует голые h1/h2 и inline border/padding, subject растёт
  до крупного заголовка; нет компактного событийного списка.
- Новые shared компоненты и legacy CSS смешиваются с workspace.module.css;
  требуется проверить computed styles/снимки, не ограничиться цветами.
- Local dev accounts созданы со старым узким permission preset: у clinic нет
  support.ticket.*, у supplier нет notification.view/support.ticket.*. Это
  подтверждённая причина части denied страниц, а не отсутствие компонентов.
- Browser cabinet-polish открыт; login1 TOOL_ERROR из-за передачи CLI code,
  бизнес login не был проверен, состояния приложения не менять ради инструмента.

Следующий шаг: screenshots audit и точная карта общих компонентов/стилей.

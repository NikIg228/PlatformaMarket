> ARCHIVE · снимок до пересборки06.10.2026. Старые статусы, команды и следующие шаги не являются текущим поручением. Требования: [описание проекта](../../../../../PROJECT_OVERVIEW.md); остаток: [roadmap](../../../../../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md). Приёмка ограничена указанными в исходном тексте версиями.

# CORE-05 — внутренний identity/access цикл

Статус: CLOSED / CI_PASS. Владелец: primary 01a0f302-2d38-75d1-b79c-141e7428b533.
Основание02.10: владелец явно поручил последовательную реализацию CORE05–09,
полный функционал backend/frontend, проверки, push после PASS и краткий аудит
в конце последовательности. Вопросы — отдельный список ниже.

## Scope и исходный снимок

Canonical root C:/Users/user/Desktop/dentmarket-kz-main, main@4f93f10f5c33c397e420f3302dfc2886ff864a47.
Сохранить пять прежних WIP: .codex/project-session.json и next-env.d.ts в
admin-web/buyer-web/landing-web/supplier-web. Единственный writer, без агентов.
Рабочая БД и pending140000 не входят в разрешение; все проверки с записью
только на существующей disposable test DB через db:test. CORE04 и тема приняты.

CORE05: регистрация/verification/reset; приглашения, роли и disable;
revoke/MFA/multi-tab и доступ трёх ролей. Существующие identity/services,
contracts/client/Fluent UI переиспользовать. Внешняя доставка и реальные
организации не входят. CORE06–09 продолжаются последовательно после PASS/CI.

## Обнаруженный маршрут и пробелы

- AuthSessionsService реализует email registration/verification/reset, refresh,
  logout/handoff, workspace context и social exchange; проверить atomic replay,
  inactive membership, session invalidation и текущие browser flows.
- InvitationsService/create+accept, RoleManagementService и operator foundation
  surface существуют. У buyer/supplier не найден интерфейс сотрудников.
  Проверить безопасное принятие приглашения, expiry/replay, доставка через
  controlled transport, повторное приглашение, блокировка/роль и отзыв сессий.
- MfaService и operator login UI существуют; проверить recovery/concurrency,
  enrollment/challenge и запрет обхода после отключения/отзыва.

## Поведение и UI

Уполномоченный сотрудник своей организации управляет приглашениями/сотрудниками
в настройках; посторонние организации и превышение собственных прав запрещены.
Приглашение одноразовое, привязано к email и сроку; ошибки/повторы не повышают
доступ и не раскрывают credentials. Отключение прекращает доступ и соответствующие
сессии. Разделы используют Fluent UI/общую тему: loading/empty/error/success,
disabled, сохранение ввода, keyboard/desktop/390px. Новые компоненты отдельно
от больших workspace-файлов. Схемы → сервер/API-клиент → UI.

## DoD и проверки

- Матрица CORE05 закрыта кодом и доказательствами, а не только наличием endpoints.
- npm run typecheck; npm test; git diff --check.
- verify:core-contract, verify:postgres (tenant/replay/revoke/races),
  verify:runtime-split; production-config при затронутых правилах.
- canonical web build, verify:web и targeted identity/member browser flow
  с синтетическими fixtures desktop/390px; bundle при изменении frontend.
- Prisma validate/upgrade на disposable DB только если нужна новая схема.
- Self-review, scoped commit/push main, remote SHA и фактические CI/Security.
Gates пока NOT_RUN; попытки0. Preflight до запуска; максимум3 на gate/blocker.
Budget: probe2m/server5m/command20m/full suite45m/diagnosis15m по Workflow.
Нет собственных запущенных процессов. Следующее действие: закончить inventory
контрактов/auth path и уточнить минимальный связный change set CORE05.

## Отдельный список вопросов

- Q01, CORE08 production profile: задан владельцу02.10 асинхронно. Сохранить
  текущие fail-closed требования внешних сервисов с отдельным EXT/deploy этапом
  либо отдельно спроектировать ограниченный production-пилот с ручной оплатой?
  Источник: Foundation6.5/production-deployment. RESOLVED02.10: владелец выбрал
  сохранить текущие требования; подключение сервисов и production-запуск —
  отдельный этап. CORE08 согласует docs/tests с действующими guards, без ослабления.
- Юридические внешние решения остаются отдельными; текущие synthetic scenarios
  от них не зависят. Новые вопросы добавлять сюда с источником/влиянием/решением.

## Execution02.10 — реализация и первые проверки

Добавлены shared identity-management schemas/client/OpenAPI, invitation
details/list/deliver/revoke и страница принятия. Повторная доставка меняет proof;
expired/revoked/replay не дают membership, существующий аккаунт требует password
или trusted identity и активный MFA; имя/password не перезаписываются.
Принятие сериализовано по organization/email, отключённое membership не возрождается.
Email verification/reset используют atomic claim. Disable/role removal/MFA disable
отзывают сессии. Ответ revoke больше не возвращает refresh hashes.
Settings clinic/supplier и operator settings используют общий MemberManagement
и SessionManagement с явными состояниями, подтверждением и typed client.
Финальный review/проверки ещё PENDING; это не приёмка результата.

typecheck1 FAIL: обязательное description у DmFeedback пропущено; исправлено.
typecheck2 PASS13/13 (2m15), затем добавлены browser tests и MFA proof в invite:
нужна проверка последних изменённых inputs, pass не переносить вслепую.
npm test1:11/12 PASS, API94files/471tests, schemas19/161, UI9/61.
Buyer order-profile dynamic import timeout5000ms под одновременной нагрузкой
(transform69s), assertion failure нет. Один обоснованный повтор buyer отдельно
без параллельной компиляции PASS20files/97tests (30s), пороги не менялись.
Логи .tmp/core05-typecheck-{1,2}.log, core05-unit-1.log,
core05-buyer-unit-retry.log. Поздний MFA proof потребует affected unit checks.
verify:core-contract попытка1 RUNNING (.tmp/core05-contract-1.log).
Добавлен scripts/verify-core05-identity.mjs: realHTTP synthetic concurrent proofs,
invites/roles/disable/MFA. Ещё НЕ запускался. Browser identity-management.spec.ts
включён в canonical config, desktop1440/390, реальные local mail + invitation
acceptance + role/disable; trace/screenshots automatic отключены для секретов,
снимки только после очистки ввода. Также пока НЕ запускался.
Рабочая БД/dev не затронуты; source main4f93f10, никакого commit/push пока нет.

## Практики

Прочитаны Toolkit execution/backend/frontend/security/verification/review,
Agency Backend Architect, Frontend Developer, UI Designer, Code Reviewer,
Git Workflow Master. Применение: единые контракты, tenant/replay/transaction,
функциональный доступный UI, review рисков и scoped публикация. Без новых
сервисов/стека и без копирования внешних примеров.

### Checkpoint: диагностика и продолжение gates

verify:core-contract1 PASS:307 operations/41 request bodies/99 success schemas/
139 components/45 verified operations; .tmp/core05-contract-1.log.
identity realHTTP1 FAIL [500,500] вместо [201,400]. Узкая диагностика на той же
isolated DB подтвердила Prisma P2010: unsupported void результата advisory lock.
Исправлен только queryRaw→executeRaw; транзакционная блокировка сохранена.
API rebuild2 PASS; identity2 PASS13 checks, включая concurrent accept/reset/
verification/recovery, tenant denial, delivery rotation, disable/revoke/profile.
Логи core05-api-build-2.log/core05-identity-2.log; внешних отправок нет.
web build1 RUNNING .tmp/core05-web-build-1.log (owned session59157).
Postgres1 RUNNING .tmp/core05-postgres-1.log (owned session44277), underlying
script через db:test: prerequisites schema build из contract1 + API rebuild2 PASS.
Runtime/production config/browser/bundle/review/publication пока PENDING.

### Checkpoint: review и браузерная регрессия

web build1 PASS, bundle1 PASS; PostgreSQL1 PASS; runtime1 PASS; production-config1
PASS. Каждый underlying gate использовал предварительно собранные schema/API.
Browser1:49/53 PASS. BUYER fixture не имела organization.view для profile gate;
добавлено только право чтения. Два route mocks дополнены /auth/sessions.
Logout regression: новый safe revoke ответ потерял id/status, которые проверяет
существующий API-client. Восстановлен узкий контракт {id,status:REVOKED}, без
refreshTokenHash; shared schema/OpenAPI/client синхронизированы, regression test.
Browser2 affected5/5 PASS25s; прочие48 неизменённых tests из browser1 переиспользуемы.
Self-review: повторная проверка полномочий под org lock для role/invite writes;
MFA enrollment сериализован и подтверждает только тот же pending secret.
typecheck3 PASS13/13; после него добавлен только mfa-enrollment.spec.ts и расширены
E2E fixtures. API build в contract2 проверил новый unit-файл.
Affected API unit2 PASS46/46; schema unit2 PASS3/3. Contract2 PASS после safe revoke.
Identity3 PASS14 checks, включая чужой revoke404, безопасный ответ и JWT401.
Local-auth1 PASS: operator TOTP enrollment/relogin/expiry/reset/revocation.
Снимки invitation1440/members390 просмотрены, layout без обрезания/overflow.
Browser3 RUNNING: тот же flow трёх ролей, теперь добавлен MARKETPLACE_OPERATOR.
Authority1 RUNNING: scripts/verify-platform-authority.mjs через db:test.
Логи всех запусков .tmp/core05-*.log. Ни commit/push, ни рабочая БД не затронуты.

### Итог локальной проверки перед публикацией

Browser3 PASS3/3: BUYER1440, SUPPLIER390, MARKETPLACE_OPERATOR1440. Проверены
приглашение/локальное письмо/принятие, ограниченные права коллеги, disable/JWT401,
restore, назначение/снятие роли, keyboard submit, отсутствие overflow. API fixtures
настоящие, scoped disposable DB; автоматические trace/secret screenshots отключены.
Authority1 PASS7 scenarios без privilege escalation; E2E types final PASS;
API-client unit final PASS15files/53tests (refresh/logout/handoff в том числе).
В сумме canonical54 сценария покрыты browser1 + исправленный browser2 + новый
оператор browser3; успешные неизменённые сценарии не перезапускались.
Runtime evidence после contract2 переиспользуется: изменённый ответ revoke,
проверки прав и MFA не меняют composition/production profile/commerce transaction.
Web production artifact/bundle переиспользуются: после build1 frontend runtime
не менялся, только TypeScript тип ответа revoke и тестовые fixtures.
Новых миграций/зависимостей/стека нет. Legacy builds/full release/deploy не запускались:
canonical web собирает импортируемые admin/landing UI, полный CORE09 ещё впереди.
Self-review завершён: tenant/actor, secrets, CAS, роли/сессии, контракты, состояния UI,
обратная совместимость logout. Проверенные дефекты исправлены; следующий шаг —
scoped commit/push main и фактический CI. Остаток CORE06–09 не объявлен завершённым.

Публикация02.10: commit0021438ea9f25b7543d8f12a28af14c1ff2bad67 на main,
обычный push выполнен, ls-remote подтвердил тот же SHA. Остались только5 исходных
WIP. CI36936601972 и Security36936601908 запущены, IN_PROGRESS; PASS не заявлен.
До их результата CORE06 код не изменяется; допустим read-only inventory очередей,
notifications/support и утверждённого Product22.12. Новых процессов dev нет.

CI receipt02.10: CI36936601972 и Security36936601908 completed/success на
0021438ea9f25b7543d8f12a28af14c1ff2bad67. Все4 CI jobs (verify, PG и2Docker)
SUCCESS; Security CodeQL/dependencies SUCCESS. CORE05 CLOSED / CI_PASS.
Следующий разрешённый этап CORE06 начат отдельной карточкой; рабочая БД неизменна.

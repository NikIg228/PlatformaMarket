# Авторизация, переходы между кабинетами и завершение сессий

Дата: 14.10.2026. Основание: сообщение владельца о переходе `/clinic` →
`/supplier`, возврате через login в клинику и поручение подробно документировать
исправление всех связанных сценариев. После спецификации primary продолжил
реализацию по постоянному поручению исполнения roadmap от14.10.

Статус: **IMPLEMENTED / LOCAL_PASS / PUBLISHED 37fa69a / CI_FAILURE**.

14.10 dependent fixtures: пять mismatches исправлены без изменения production auth:
полная mock Admin identity, семантическая ссылка раздела, `/auth/session-logout`
с точным captured session/proof и receipt, exact signedOut и safe-return URL.
`npm run db:test -- exec -- node .tmp/admin-shell-2026-10-14/auth-fixtures.mjs`:
attempt1 3PASS/2FAIL (strict fixture assertion пропустил accessToken в ожидаемом
body), attempt2 5/5PASS17.3s. E2E types/scoped lint PASS, read-only review READY.
Изолированный build59d944a/ports3103+4113/auditDB, без rerun catalog BLOCKED6.
CORE02 payment-policy success-feedback failure пока не объяснён и не закрыт.
Общий CI остаётся отдельным фактическим receipt, тестовые правки ещё не подтверждены CI.

Actual CI после fixture fix4d60acb и docs b197d8d: run38469520118 FAILURE,
verify job115544652416: Flow B3 7/7PASS, verify:web95PASS/12FAIL.
Security38469520083, PostgreSQL и container jobs SUCCESS. Receipt передан primary
14.10; прежние catalog failures и зависимые auth fixture/URL expectations
не считаются закрытыми локальным PASS. R7.2.1 остаётся LOCAL_PASS, checkbox открыт.
Реестр исполнения — [Main Roadmap, R7.2.1](../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md).
Операторская часть связана с R7.7.1.1/3; это один объём работы, не два backlog.
Документ не закрывает прежние CI failures, не разрешает менять полномочия,
рабочие данные, MFA, запускной профиль или автоматически начинать реализацию.

## Цель и границы

Клиника, поставщик и оператор должны понимать, под каким аккаунтом и в какой
организации они работают. Прямой URL, изменение маршрута вручную, ссылка,
обновление страницы, Back/Forward, истечение сессии и кнопка выхода должны
приводить к согласованному результату без смены личности, выдачи новых прав,
возврата в неожиданную роль или ложного сообщения об успешном выходе.

Основной runtime — единый origin `apps/web`: `/clinic`, `/supplier`, `/admin`.
Изменение этих частей URL — смена маршрута, не домена. Legacy entry points
сохраняются; если затронут их общий код, нужны соответствующие проверки callers.
Не вводить другой auth stack или второй механизм определения полномочий.

Источники: [описание продукта](../PROJECT_OVERVIEW.md),
[функциональная карта](../FUNCTIONAL_AUDIT_AND_ROADMAP_2026-10-08.md),
[ADR014](../architecture/adr/014-local-workspace-sessions.md),
[ADR015](../architecture/adr/015-unified-frontend.md),
[Admin roadmap](admin-roadmap.md),
[Workflow](../governance/DEVELOPMENT_WORKFLOW.md),
[дизайн-система](../ui-ux/DESIGN_SYSTEM.md).

## Основание анализа и пределы доказательства

Исходный снимок: `main@2885f6fb91ddc221c42e9e3fdccc5ae8d9167800`.
Первый сценарий сообщил владелец. Остальные выводы получены чтением исходников
и существующих тестов; в этом анализе браузерные сценарии не воспроизводились,
тесты не запускались. Условный сценарий из кода не выдаётся за наблюдавшийся
инцидент с рабочими аккаунтами. Перед исправлением сверить актуальные inputs.
Наличие ниже корректных защит не является полной сертификацией авторизации.

## Проблемы, причины и требуемый результат

### 1. Возврат в прежний кабинет при запросе другой роли

Воспроизведение: войти в клинику, вручную открыть `/supplier`, нажать предложение
войти в кабинет поставщика. Открывается `/login?returnTo=/supplier`; форма на
короткое время видна, затем происходит возврат в авторизованную клинику.
Та же цепочка возможна для поставщика, имеющего только SUPPLIER, при запросе
`/clinic`. При наличии нескольких доступных кабинетов появляется выбор, но
запрошенная роль не участвует в первоначальном отборе/выборе.

Причина: [LoginPage](../../apps/landing-web/app/login/page.tsx) восстанавливает
общую login-сессию и автоматически открывает единственный доступный workspace.
`continueSession` не проверяет его соответствие запрошенному кабинету.
[workspaceHandoffUrl](../../apps/landing-web/app/auth-client.ts) отклоняет
несовместимый `returnTo` через allowlist и использует корень выбранной роли.
Защита роли срабатывает, но пользователь получает неверный сценарий восстановления.

Исправление: сначала разобрать безопасное назначение и требуемый кабинет,
затем сверить его с серверным списком доступных организаций/capabilities.
Если подходящий кабинет один — открыть именно его; если несколько — предложить
явный выбор соответствующей организации. Если доступа нет — остаться на понятном
экране отказа с действиями «Вернуться в доступный кабинет» и «Войти другим
аккаунтом». Не отправлять пользователя в несовместимый кабинет автоматически.
Обычный `/login` без назначения может сохранять прежнее допустимое автопродолжение.

### 2. Незаметная смена оператора при восстановлении Admin

Сценарий по коду: во вкладке A открыт оператор A; во вкладке B выполняется вход
оператором B и меняется общая cookie Admin. При обновлении access token вкладка A
вызывает `restoreAdminSession`, который сохраняет текущую cookie-сессию без
сверки с прежними `sessionId`, пользователем и организацией. Старое содержимое
экрана может остаться, а последующие запросы уже выполняться от другой личности.
Защита `generation` отсеивает часть поздних ответов, но не заменяет эту сверку.
Источник: [admin-auth](../../apps/admin-web/app/admin-auth.ts).

Исправление: различать первоначальное восстановление пустой вкладки и продление
уже выбранной сессии. Во втором случае ожидать ту же identity/session/organization.
При несовпадении остановить действия старого экрана, показать «Аккаунт изменён
в другой вкладке» и предложить явное продолжение либо новый вход. До продолжения
сбросить данные, запросы и кэши прежнего контекста; поздний ответ не восстанавливает
старую сессию. Не переносить черновики между пользователями/организациями.

### 3. Выход из старой вкладки затрагивает новый общий login

Кабинет клиники вызывает `logoutPrimarySession`, затем отзыв своей workspace
сессии. В основном `Workspace` поставщика также сначала завершается общий login.
Helper читает текущий `/auth/current` и отзывает найденную cookie-сессию, не
сопоставляя её с аккаунтом инициировавшего выход кабинета. Если во второй вкладке
уже вошёл другой пользователь, выход A может завершить общий login B.
Источники: прежний `logout-primary-session.ts` (удалён в R7.2.1;
замена — [self-logout helper](../../packages/api-client/src/session-logout.ts)),
[клиника](../../apps/buyer-web/app/workspace-session.ts),
[основной Workspace](../../apps/web/app/workspaces/workspace.tsx).

Исправление: операция выхода имеет явно определённую целевую сессию и actor.
Отзывать именно выбранную workspace-сессию. Связанный общий login завершать
только после проверки его принадлежности этому аккаунту/цепочке входа, чтобы
исключить автоматическое воссоздание только что закрытого кабинета.
Нельзя отзывать другой аккаунт из-за совпадения browser cookie jar.
Если текущих контрактов недостаточно для связи, сначала определить серверный
контракт и безопасную связь сессий, затем общий клиент и UI.
Не приравнивать все сессии одной роли или одной организации к одной сессии.

### 4. Повтор выхода после потери ответа сервера

Сценарий по коду: сервер отозвал workspace-сессию, но успешный ответ потерялся.
UI сохраняет локальную сессию и предлагает повторить. Повтор с прежним bearer
может получить `401`, который [revokeWorkspaceSession](../../packages/api-client/src/index.ts)
снова трактует как неподтверждённый выход. Текст предлагает retry, но этот путь
сам по себе не различает уже выполненный отзыв и другую причину отказа.

Исправление: предусмотреть безопасную проверку терминального состояния именно
целевой сессии и повторяемое завершение logout. Отдельно обработать: отзыв не
начался; отзыв подтверждён; ответ потерян; cookie отсутствует; сессия уже истекла;
вкладка успела войти заново. Не считать любой `401` успехом и не очищать новую
сессию по позднему ответу старой. При недоступном сервере честно показать, что
серверный отзыв не подтверждён; не обещать завершение всех сессий.

### 5. Admin logout после нового входа в другой вкладке

`logoutAdmin` отправляет CSRF из sessionStorage, сервер сравнивает его с общей
cookie Admin. После нового входа во второй вкладке значения могут различаться;
повтор той же команды не исправляет конфликт. Источники:
[admin-auth](../../apps/admin-web/app/admin-auth.ts),
[operatorLogout](../../apps/api/src/modules/identity/auth-sessions.controller.ts).

Исправление: согласовать цель выхода с identity/session и актуальным контекстом
cookie. Не подставлять новый CSRF вслепую: иначе можно завершить другую сессию.
Конфликт должен приводить к явному восстановлению контекста, не к циклу ошибки.
После подтверждённого logout очистить только соответствующий локальный контекст,
уведомить вкладки той же сессии, перейти на операторский вход.

### 6. Потеря исходной страницы Admin после входа

[useAdminAccess](../../apps/admin-web/app/use-admin-access.ts) отправляет на
`/admin/login` без назначения; [AdminLogin](../../apps/admin-web/app/login/page.tsx)
после входа всегда открывает корень. При истечении сессии теряется объект/раздел.

Исправление: сохранять безопасный разрешённый Admin return path и восстанавливать
его после проверки операторских полномочий. Сохраняется согласованная схема
`?section=` и deep links `queueType/object`, `ticketId/conversationId`.
Не допускать внешние адреса, login-loop, токены в URL или переход к запрещённому
объекту. Недоступный/удалённый объект имеет явное состояние и безопасный возврат.

## Единые инварианты и UI-поведение

- URL задаёт намерение навигации, но не роль, actor, tenant или разрешение.
  Запрещённые страницы и API не открываются подстановкой пути, query или storage.
- Пустая, истёкшая, отозванная сессия, недостаток прав и сетевой отказ — разные
  состояния. Не показывать отсутствие полномочий как пустой список или сбой сети.
- При проверке доступа не показывать защищённый контент даже на один кадр.
  При смене identity блокировать старые действия и исключать смешение данных.
- Return URL валидируется общей allowlist: внутренний разрешённый маршрут,
  совместимая роль, разрешённые параметры. Покрыть encoded/protocol-relative,
  вложенные return hints, неизвестные маршруты и параметры; не расширять allowlist
  до произвольного URL ради устранения потери контекста.
- Ручной переход на `/login` не означает logout. Ручной переход на `/supplier`
  не означает назначение роли. Browser Back после выхода не восстанавливает доступ.
- «Войти другим аккаунтом» — явный сценарий, подавляющий автопродолжение текущего
  login; он не отзывает несвязанные сессии других пользователей без основания.
- Сохранить HttpOnly/Secure/SameSite, CSRF, одноразовый handoff/TTL, проверку
  membership/capability, отзыв на сервере и MFA обычных сессий. Отдельный password
  operator login остаётся по решению владельца; операторский handoff в участника
  не разрешается. Не ослаблять guards для устранения redirect-loop.
- Refresh не меняет identity/organization молча. Только safe reads допускают
  существующий ограниченный повтор; бизнес-запись после `401` не повторяется
  автоматически. Logout — отдельный контракт повторяемого завершения.
- Pending блокирует двойную отправку; ошибка доступна screen reader, retry
  работает с клавиатуры. Меню выхода доступно на desktop/mobile. Controls и
  состояния реализуются через shared adapters и DESIGN_SYSTEM.

## Матрица приёмки будущей реализации

| Сценарий | Обязательное доказательство |
| --- | --- |
| BUYER-only → supplier; SUPPLIER-only → clinic | Понятный отказ/смена аккаунта, нет автоматического возврата в другую роль и выдачи прав |
| Две capabilities одной организации; несколько организаций | Выбор доступного кабинета/организации соответствует назначению; сервер подтверждает доступ |
| Прямой URL гостем; refresh; Back/Forward; закладка | Вход и разрешённый return, защищённые данные не мелькают, история не возвращает отозванный доступ |
| Клиника/поставщик ↔ Admin | Разделение сессий; отсутствуют неявный вход участника как оператора и обратный handoff |
| Истечение access; refresh; истечение refresh; отзыв membership | Сохранение identity либо явный новый вход; отказ API и понятное состояние UI |
| Logout каждой из трёх ролей | Подтверждённый отзыв целевой сессии; старые access/refresh отклоняются; настоящий login не воссоздаёт её автоматически |
| Logout offline/5xx/CSRF error | Нет ложного успеха, двойной отправки и потери возможности восстановить сценарий |
| Отзыв выполнен, ответ потерян | Повтор безопасно подтверждает завершение; не бесконечный цикл `401` |
| Две вкладки одной сессии | Подтверждённый выход распространяется на эту сессию; поздний refresh не воскрешает её |
| Аккаунт A в старой вкладке, B в новой | Выход A не отзывает B; refresh A не превращает вкладку в B; UI/данные не смешиваются |
| Повторный вход тем же пользователем; новая организация | Новый sessionId не очищается поздним logout/сообщением старого; смена организации явная |
| Admin deep link после истечения сессии | Возврат к разрешённому section/объекту, корректные forbidden/not-found и Back |
| Подмена URL/returnTo/sessionId/organizationId; обычный token в Admin | Negative API tests подтверждают отказ, без open redirect и расширения полномочий |
| Desktop/mobile/keyboard | Доступный выход, focus/retry, понятные тексты, нет бесконечного spinner или мерцания закрытого экрана |

Не обещать «невозможность любых ошибок»: принятие требует измеримых сценариев
выше на конкретной revision и сохранения известных ограничений.

## Порядок исправления и проверки

1. Сверить снимок, текущие контракты, callers и evidence; воспроизвести дефекты
   на синтетических аккаунтах в disposable DB. Записать риск и gates до изменений.
2. Определить session identity и область logout/recovery. При изменении API:
   Zod/request-response-error → backend/OpenAPI → client → необходимый UI.
   После каждого связного backend-перехода выполнить целевые positive/negative
   tests до построения зависимого UI. Не менять schema без отдельной необходимости.
3. Исправить согласованно login destination, явную смену аккаунта, Admin restore,
   logout/retry и safe return. Переиспользовать готовую авторизацию, не переписывать
   её целиком; сохранить ADR и существующие утверждённые входы.
4. Проверить точные затронутые identity/client/navigation tests, типы/build/lint
   изменённых consumers и целевые browser flows матрицы. Session isolation/revoke
   доказывать реальным API на изолированной БД; mocks подтверждают только UI.
   Дополнительные gates, включая `verify:postgres`, выбирать по фактически
   изменённым tenant/idempotency/DB границам Workflow. Общий E2E не минимум.
5. Сохранить revision, manifest, команды/результаты, screenshots/computed styles
   изменённых UI состояний и отдельно local/CI/publication статусы. Закрыть только
   выполненный scope R7.2.1; R7.7.1 ссылается на то же evidence.

Важный пробел текущего evidence: [workspace-logout.spec.ts](../../apps/e2e/tests/workspace-logout.spec.ts)
подменяет конечный `/login` синтетической страницей. Такой тест не доказывает
отсутствие повторного автоматического входа через настоящий LoginPage.
Сохранить полезные assertions, добавить целевой реальный сценарий возврата.
Просмотренные [workspace session tests](../../packages/api-client/src/workspace-session.test.ts)
и [operator auth tests](../../apps/api/src/modules/identity/operator-auth.spec.ts)
покрывают часть защит; наличие файлов не означает новый PASS.

## Первоначальная документационная фиксация

Первоначальное поручение UI-исполнителя: спецификация и связь с roadmap без runtime исправлений.
Основной writer R7.2 и его PRIMARY-SESSION/generation этим документом не заменяются.
Прежние dirty docs/tests/output сохраняются. Документационные проверки:
локальные ссылки, уникальность нового ID, сохранение прежних checkbox states,
diff hygiene и содержательная сверка. Build/DB/browser для Markdown не запускаются.
На момент этой фиксации реализация и матрица были NOT_RUN; старые FAIL/attempts не сбрасываются.

Проверка документа14.10:22 локальные ссылки существуют;106 прежних ID/state
roadmap сохранены, добавлен один unchecked R7.2.1 (всего107). Проверка
`git diff --check` roadmap и `git diff --no-index --check -- NUL` нового документа
не выявила whitespace ошибок. Публикация/commit этой документации не выполнялись.

## Реализация и локальная приёмка14.10

Primary реализовал R7.2.1 на `main a0e0671` с собственным auth diff; UI-исполнитель
выполнил read-only review серверной границы. Нового auth stack нет. Общая allowlist
выделяет требуемую capability из маршрута; login предлагает только совместимые
организации. При отсутствии доступа показаны общий DmFeedback и явные действия
возврата/смены аккаунта. Admin сохраняет допустимый `section` и объектные параметры,
сравнивает session/user/organization при восстановлении; чужой cookie не меняет
текущую identity. Generation guards не позволяют позднему ответу очистить новый вход.

`AuthSession.originLoginSessionId` хранит доказанный исходный login: новый login
ссылается на себя, handoff наследует root, legacy null остаётся неизвестным.
Additive migration `20261014000000_session_origin_login` проверена на audit DB.
`POST /auth/session-logout` принимает строгие `{sessionId, accessToken}` и возвращает
`{sessionId, status, loginStatus}`. Подпись доказывает только указанную сессию;
ambient cookies/identity headers не используются, Set-Cookie отсутствует.
В одной транзакции отзываются target и его подтверждённый root. Другие login и
существующие sibling destination не отзываются каскадом. Истёкший proof разрешён
только для receipt уже terminal состояния; active revoke требует свежего proof.
Повтор после потерянного ответа не дублирует audit и не меняет timestamp.
Handoff consume/create и logout сериализуются по source/root row locks.

Shared client отправляет proof без credentials/Authorization, проверяет точный
receipt и делает один refresh только по `SESSION_LOGOUT_PROOF_EXPIRED`.
Клиника/поставщик/Admin очищают только выбранный sessionId; broadcast адресован
той же сессии. Возврат участника на настоящий `/login?signedOut=1` подавляет
автоматическое продолжение входа. Обычные cookie/CSRF/MFA guards сохранены.

### Проверки и попытки

Окружение: canonical checkout, pilot, реальный JWT API и PostgreSQL
`127.0.0.1:5432/dentmarket_audit_20260914`; рабочая БД не менялась.
Сборка/API не переустанавливались. Все тестовые процессы принадлежали текущему
run, завершены; синтетические записи сохранены, их сессии отозваны, письма удалены
только после проверки владения. Пользовательские3000/4012 не останавливались.

| Проверка | Команда / результат |
| --- | --- |
| Схемы navigation/logout | targeted Vitest62 PASS; schema build PASS |
| Identity/security/logger | targeted16 files123 PASS; после новых root/legacy/class cases session-logout/workspace24 PASS; logger5 PASS с accessToken redaction |
| Клиенты | `npm exec --workspace=@marketplace/api-client -- vitest run src/session-logout.test.ts src/workspace-session.test.ts` —28 PASS; Admin auth/navigation12 PASS; landing auth/unified-navigation17 PASS |
| Реальный self logout | `npm run db:test -- exec -- node scripts/verify-session-logout.mjs` — PASS target/root, new login, foreign proof, Admin, expired receipt, stable audit, real rollback, concurrency, legacy и оба порядка handoff/logout. Первоначально FAIL из-за разных ключей test fixture; после scoped sessionProof PASS. Новые детерминированные cases проверены отдельно после review |
| Refresh/logout | `npm run db:test -- exec -- node scripts/verify-session-refresh-logout.mjs` — PASS обоих порядков и конкуренции, выданный до revoke token не восстанавливает доступ |
| Migration / API | Prisma validate, migrate deploy (45 migrations) и API build/types PASS. Generate EPERM из-за занятой DLL: повтор с копией того же engine под отдельным basename PASS; чужой процесс не остановлен |
| Обязательные DB/runtime gates | `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs` и `node scripts/verify-runtime-split.mjs` PASS; prerequisites schema/API build переиспользованы на неизменённых исходниках |
| Core contract | `npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only` PASS:340 operations,60 core operations,216 schemas. Попытка1 FAIL:35/50 pilot products; read-only preflight доказал500 expired test balances. Штатный pilot seed только audit DB обновил freshness; попытка2 PASS50 products/500 offers. Catalog browser gate R7.2 не запускался |
| Frontend | typecheck api-client/ui/landing/admin/buyer/supplier/web PASS; единая production webpack build PASS, включает изменённые legacy features. Отдельные legacy browser builds не запускались; callers проверены типами и целевыми unit tests |
| UI policy / lint | targeted ESLint PASS; `npm run verify:ui-contract` PASS366 files; `git diff --check` PASS |

Новый реальный browser gate: `npm run db:test -- exec -- node
scripts/verify-auth-navigation-browser.mjs` —5 групп PASS. Попытка1 FAIL на exact
label обязательного пароля, попытка2 FAIL на неоднозначном Next route announcer;
после исправлений селекторов попытка3 PASS. Сценарии: обе несовместимые роли на
1440/390, keyboard switch account; обе роли — network/503/lost response/retry,
sibling broadcast, target/root revoke, настоящий login без auto-resume, прямой
возврат без защищённого UI; Admin deep return и logout A при cookie нового B.
Этот gate не является повтором исчерпанного catalog gate.

Дополнительные, ранее не запускавшиеся группы на том же build:
`--identity` —3 PASS (workspace A/B refresh, Admin changed-session notice с return,
выбор между двумя организациями при нескольких capabilities);
`--lifecycle` —2 PASS (expired access refresh, pending control/keyboard, Back после
выхода, отзыв membership). Выполнялись только новые группы, ранее зелёные не повторялись.
Local screenshots/results и manifest: `output/playwright/auth-navigation-2026-10-14`,
соседние каталоги `-identity` и `-lifecycle`. Screenshots просмотрены, новые controls
на1440/390: Manrope14/600,44px,radius8; mobile Admin notice и pending menu помещаются.
Секреты в UI artifacts замаскированы; raw trace/HAR не создавались.

### Воспроизведение изолированной browser-сборки

`node scripts/prepare-auth-navigation-browser.mjs` создаёт только generated
adapter/tsconfig. Сохранить текущий `apps/web/next-env.d.ts`; выполнить
`npm run build --workspace=@marketplace/web` с `NEXT_ADAPTER_PATH`, указывающим
на `.tmp/auth-navigation-2026-10-14/next-adapter.mjs`,
`INTERNAL_API_URL=http://127.0.0.1:4113/api`, `DEPLOYMENT_PROFILE=pilot`.
После сборки восстановить exact backup next-env. Source остаётся canonical;
отдельные distDir/tsconfig не являются копией приложения. Browser runner проверяет
свободные3103/4113, запускает свои процессы и завершает их. Для API предварительно
нужны schema/API build и migration только в согласованной disposable DB.

Ограничения: рабочая migration и перезапуск пользовательского runtime не выполнялись;
это локальная приёмка реализации на изолированном окружении, не deploy.
Обычный браузерный delayed Set-Cookie после нового login не симулировался отдельно:
проверены server revoke/refresh race и отказ восстановления при cookie другой сессии.
Старый catalog gate остаётся BLOCKED, прежний общий CI FAILURE не превращается в PASS.
Опубликовано в `main`: `37fa69abec2bb5a8ef94d0eee1d9ba6a21bd159a`;
remote SHA проверен. [Security38466389627](https://github.com/NikIg228/PlatformaMarket/actions/runs/38466389627)
завершён SUCCESS. В [CI38466389600](https://github.com/NikIg228/PlatformaMarket/actions/runs/38466389600)
PostgreSQL и обе container builds SUCCESS; общий job verify завершился FAILURE:
Flow B3 —5 PASS/2 FAIL CSV/Excel publication. Dependent operator fixture сохранял
неполную session identity и больше не проходит sameIdentity перед /organizations.
Адресная правка fixture сохраняет sessionId/user.id/activeOrganizationId/expiresAt;
типовой login уже записывал эти поля. E2E types и targeted ESLint PASS.
`npm run db:test -- exec -- node .tmp/auth-navigation-2026-10-14/flow-b3.mjs`:
два исправленных publication flow PASS на попытке2 (попытка1 — import.meta в
временном CommonJS Playwright config, до запуска тестов). Использована неизменная
production build auth, owned3103/4113 и проверенная audit DB; canonical flow config
сохранён, изменены только isolated ports/output/storage. Test unified URL теперь
берётся из Playwright baseURL, опциональный FLOW_B3_STORAGE_ROOT задаёт disposable
upload storage. Это не расширяет права auth и не является logout/refresh evidence.
Публикация исправления fixture и новый CI фиксируются отдельно;37fa69a остаётся FAIL.
Также web-bundle сообщил превышение budget (27files/2020134raw/550629gzip);
оно существовало до auth change: CI38453834830, job115491315486 —27/2017227/549923.
Pipeline с tee продолжил работу; это не PASS. Последующие общие browser gates
после Flow B3 в этом run не выполнялись. Старый R7.2/BLOCKED6 остаётся открытым.

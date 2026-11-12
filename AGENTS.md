# PlatformaMarket: правила работы агентов и разработчиков

Этот файл обязателен для любой задачи в репозитории. Он не заменяет
продуктовое ТЗ или архитектурные ADR: он определяет, **как** безопасно
менять проект и как доказывать готовность результата.

Правила сокращены и согласованы 2026-11-12; маршрут документации от 2026-11-04. Главный принцип: **одна согласованная
задача → минимальное изменение → достаточные проверки → остановка**.
Наличие backlog, skill или команды в runbook само по себе не разрешает её выполнять.

## Единственная рабочая папка — решение владельца 2026-09-21

- Код Platforma.Market изменяется только в
  `C:\Users\user\Desktop\dentmarket-kz-main`. До записи проверить фактический
  корень репозитория, ветку, HEAD, dirty files и владельца текущей задачи.
- Не создавать и не использовать другие worktrees, клоны и копии для разработки.
  Старые деревья — только read-only источники консолидации/восстановления до
  отдельной приёмки и уборки. Это отменяет прежнее правило отдельного clean worktree.
- При конкретном конфликте в затронутых файлах приостановить эту операцию
  и сообщить пользователю; сохранить несвязанные изменения.
- Сохранять пользовательские изменения. Не переключать грязный checkout;
  изменение ветки только в согласованной Git-операции. Ветка не требует новой папки.
- Dev API/frontend/workers запускаются из этой папки; проверять источник
  процесса и профиль, а не только localhost. Не останавливать чужие процессы.
  Изолированные тестовые БД и generated build artifacts допустимы, но не являются
  альтернативным исходным кодом и не разрешают изменения рабочей БД.
- Commit/push выполняются по постоянному разрешению из §8 после проверок.
  Изменение рабочих данных и удаление деревьев требуют отдельного scope.
  Само правило не является технической блокировкой.
- Контекст выбранной задачи: `actual_docs/governance/task-state/PRIMARY-SESSION.md`.

## Task scope and continuity

The current user task defines scope; clarifications/status questions supplement it,
not replace it. Keep unfinished requirements until explicit cancellation/change of
goal. Instructions, skills, old plans and chat names grant no new work. Report in
this chat; no inter-chat assignments, polling, writer registry, approval chains,
reminders, automation or delegation without an explicit request. Unrelated WIP or
an open chat is not a blocker; stop only a concrete conflicting operation.

After compaction, restore the selected checkpoint, Git delta, evidence and attempt
history, then continue the same authorized scope. Do not restart closed work or
create/transfer/archive chats. On explicit handoff include scope/decisions, done/
remaining work, exact files, branch/HEAD/dirty ownership, checks/failures/blockers,
owned processes and next step without secrets. Incomplete work can be handed off;
no green CI/publication/ownership handshake is required. The sender stops that work
until newly instructed; chat creation/archival/schedules are separate actions.

## 1. Источники правды — решение владельца 04.11.2026

Текущая задача и явные решения владельца определяют scope. Источники:

- [README](README.md): продукт, участники, сценарии, устройство и границы реализации.
- [Roadmap](actual_docs/MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md): единственный реестр
  принятых требований R0–R9, П01–П40 и исправлений аудита.
- [OPEN_QUESTIONS](actual_docs/OPEN_QUESTIONS.md): нерешённые условия и внешние входы;
  не спрашивать повторно уже выбранные правила.
- [Workflow](actual_docs/governance/DEVELOPMENT_WORKFLOW.md): процедура и проверки;
  [индекс](actual_docs/DOCUMENTATION_INDEX.md): профильные ADR/API/UI/runbooks;
  [Matrix](actual_docs/governance/PROJECT_ACCEPTANCE_MATRIX.md): evidence конкретного
  scope/версии. Технические справочники не создают альтернативный backlog.

Читать только запись выбранной задачи/checkpoint, нужный раздел README, пункт
roadmap и его OPEN_QUESTIONS, затем применимые Workflow/контракт/код/ADR/evidence.
Не загружать всю историю. Старые PROJECT_OVERVIEW, функциональная карта, ТЗ,
свод правил, журнал решений и анкеты являются COMPAT-переходами, не обязательным
входом. Архив открывать лишь для названного вопроса/версии, если текущих источников
недостаточно; исключать history, датированные references и snapshot .md.txt из
обычного поиска. Архив 04.11 хранит трассировку, не действующие поручения.

Принятое решение переносить со смыслом/условиями/датой в существующий roadmap;
при изменении продукта обновлять README, закрытый вопрос убирать из активного
списка, исходный ответ сохранять в истории. Конфликт оставить в OPEN_QUESTIONS;
код или дата файла не выбирают бизнес-политику. Не создавать второй backlog.
Различать требование, реализацию, scoped acceptance и внешнюю готовность; принятие
текста или старый PASS не подтверждают новую версию/production.

ERP подключается самостоятельно в кабинетах клиники/поставщика, не через
обязательную заявку в поддержку; нужный UI входит в задачу вместе с логикой.
CORE-01–09 имеют историческую внутреннюю приёмку: архив не открывает их заново.
Production с реальными участниками остаётся целью. Профили pilot/go_live,
договор площадка–поставщик и production guards сохраняются. Roadmap не разрешает
подключать сервисы, менять рабочие данные, писать партнёрам, начинать этапы или deploy.

## 2. Карта репозитория

- `apps/api` — NestJS API, Prisma schema и доменная логика.
- `apps/web` — основной единый Next.js frontend: public/clinic/supplier/admin.
- `apps/buyer-web`, `apps/supplier-web`, `apps/admin-web` — импортируемые features
  и отдельные legacy entry points; не удалять как неиспользуемые.
- `apps/landing-web` — импортируемые public/auth features и legacy entry point.
- `apps/e2e` — Playwright критических сценариев.
- `packages/schemas` — общие Zod-схемы и типы контрактов.
- `packages/api-client` — типизированный клиент core API.
- `packages/ui` — общие UI-примитивы на Fluent UI v9.
- `scripts` — обслуживающие и проверочные сценарии. Перед изменением или
  удалением скрипта проверьте его вызовы в `package.json`, CI и runbooks.

## 3. Обязательный маршрут задачи

1. Follow the targeted reading route in §1 and check Git before editing.
2. Record user/scenario, inputs/output, constraints, task ID, DoD, risk, exact gates,
   environment/fixtures and stopping criterion. A short brief suffices for a small
   task; no new specification or repeated approval of clear scope is needed.
3. Domain/HTTP changes proceed schema/contract → implementation/client → required UI
   under one DoD. Trace scenario → entities/API → route/component → states → evidence.
   Backend-only cannot close a feature needing a user action/state/result; justify
   any "no UI needed" decision. R7 does not defer UI required by R2–R6.
4. Make the smallest coherent change; do not mix unrelated refactoring, redesign,
   deletion and new features. Check existing code/contracts/tests first; if already
   implemented, supply only missing evidence or the necessary fix, not a rewrite.
5. Add targeted regression coverage for changed behavior. Reversible copy/styles
   need affected UI verification, not tests mirroring CSS. Run applicable Workflow
   gates, update changed contracts/rules/commands/operations/architecture docs, then
   review working/staged diff and `git diff --check` before commit.

### 3.1 Граница исполнения

Preserve the original task and unfinished requirements; clarifications/status
questions supplement it. Replace the goal only on explicit cancellation/change.
"Continue" covers the current card/authorized sequence, not all backlog. Auditing
rules does not start backend work. New functions/integrations/dependencies/stack,
redesign, broad cleanup and infrastructure require task authorization.

Record an unrelated defect once in the existing card/Acceptance Matrix, not an
automatic follow-up. Report critical risk and stop only its affected path. Do not
spawn agents/tasks without explicit delegation; Agency roles are guidance, not
permission to launch agents. Stop at DoD; another phase needs an explicitly
authorized sequence and the current phase's required passed gates.

## 4. Backend и данные

- Сохраняйте modular monolith. Не выделяйте микросервис без независимого
  владения, развёртывания или масштабирования.
- Любое изменение Prisma schema требует migration, `prisma validate` и
  проверки upgrade-path. Не редактируйте применённые migration-файлы.
- Каждая запись и чтение с организационными данными проверяет tenant context и
  разрешение до обращения к данным. Нельзя принимать tenant/actor из
  недоверенного заголовка как источник авторизации.
- Деньги храните в minor units; не используйте JavaScript `number` для
  точных денежных вычислений. Проверяйте инварианты в транзакции.
- Внешние вызовы, checkout, резервы и webhooks должны иметь идемпотентность и
  контролируемую компенсацию. Не выдавайте успех до фиксации нужной транзакции.
- Изменение цены, остатка или доступности обязано проходить revalidation перед
  checkout. Интерфейс обязан показать пользователю существенный diff до
  подтверждения новой версии.
- Seed-данные не являются бизнес-логикой. Используйте существующие отдельные
  reference/operator/pilot/test profiles. Проверки с записями выполняйте только
  на проверенной disposable test DB; не reseed рабочий demo-каталог ради зелёного теста.

## 5. Контракты API

- Новая или изменённая core-операция начинается с Zod-схемы в
  `packages/schemas` и явных request/response/error типов.
- Обновляйте OpenAPI и `@marketplace/api-client` вместе с сервером; не
  дублируйте незадокументированные DTO в Next.js приложениях.
- Сохраняйте безопасный error envelope (`code`, `requestId`, `path`,
  `details`). Ошибки не должны раскрывать секреты, SQL или внутренние токены.
- Для write-операции укажите авторизацию, validation, conflict semantics,
  идемпотентность и audit/outbox effect там, где они применимы.

## 6. Frontend, UI и UX

Read `actual_docs/ui-ux/UI_UX_IMPLEMENTATION_STANDARD.md` and
[DESIGN_SYSTEM](actual_docs/ui-ux/DESIGN_SYSTEM.md) before UI implementation or
reference generation (owner decision 07.10.2026). Follow its mandatory workflow,
both JSON contracts and the current screen. Before generation record the parameter
passport, pass it to the generator and inspect the image before calling it an
approved reference. Image approval/"one-to-one" does not override shared contracts
without an explicit decision. Resolve actual conflicts before implementation;
no repeated approval when there is no conflict. Acceptance includes screenshots
and computed styles, not static/tests alone.

- Buyer/supplier/operator use Fluent UI v9 and `packages/ui`. Standard controls and
  states use shared adapters/tokens only: no local copies/overrides, second design
  system or icon library for one page. Feature CSS is for composition; extend a
  missing shared variant and verify consumers under DESIGN_SYSTEM, without an
  unauthorized change to shared parameters.
- Async surfaces require loading/empty/error/success-action feedback. Explain
  recoverable actions and preserve form input; keyboard, labels, visible focus
  and inline validation are mandatory.
- Changed/new UI uses `LoadingState` from `@marketplace/ui/loading-state` (06.11.2026):
  spinner plus localized action/object, e.g. «Загружаем остатки…». No bare loading
  text, local spinners or «Проверяем вход» for content loading. Initial workspace:
  «Загружаем кабинет…»; section loading preserves the shell, background refresh
  preserves data in the same context. Block/inline/error/accessibility variants:
  [Единые лоадеры](actual_docs/ui-ux/DESIGN_SYSTEM.md#единые-лоадеры).
- Work screens prioritize hierarchy, filters, tables, status and responsiveness
  over decorative motion. Do not grow oversized route files; put new logic in
  feature components, hooks, services or tested pure utilities.
- Taste Skill guides public/landing art direction; preserve accessibility, IA,
  SEO, analytics and brand. Do not copy external SKILL.md files or apply marketing
  patterns to workspaces. Preserve the established product design system.

## 7. Проверки

Полная политика пропорциональных проверок и точные gates находятся в
[Workflow §4](actual_docs/governance/DEVELOPMENT_WORKFLOW.md#4-матрица-проверок),
включая поэтапные backend-тесты, shared consumers и переиспользование PASS.
Она обязательна и без персональных инструкций Codex. Проверять риск изменения,
не весь проект при каждом TypeScript change. Обязательны `git diff --check`, проверка типов
затронутого приложения/пакета и применимые целевые тесты. Проверить реальные
scripts/конфигурацию перед выбором команды; если scoped typecheck отсутствует,
использовать существующий общий typecheck. Общий `npm test` не является минимумом
для любой правки UI. Точные границы — матрица Workflow §4.

Дополнительно выбирайте проверку по риску, а не по удобству:

- контракт покупки — `npm run verify:core-contract`;
- checkout, tenant isolation, rollback или конкурентный остаток —
  `npm run verify:postgres`;
- runtime API/worker — `npm run verify:runtime-split`;
- production environment — `npm run verify:production-config`;
- затронутый UI critical flow — целевые browser-тесты с необходимыми fixtures;
  общий `npm run verify:web` — для composition/release границ по Workflow §4;
- релизная готовность — `npm run verify:release`.

Docs-only: ссылки/согласованность правил, сохранность истории и `git diff --check`;
не запускать TS/build/DB/browser/security suites без соответствующего изменения.

Не ставьте `[x]` без фактического pass выбранного gate. Успешная проверка
переиспользуется для тех же входов по Workflow §4.2; истечение времени или
новый чат сами по себе не требуют полного rerun. Исторический pass без
проверяемых входов не сертифицирует новый checkout.

### 7.1 Защита от циклов

[Workflow §4.3](actual_docs/governance/DEVELOPMENT_WORKFLOW.md#43-ограниченные-повторы-и-время)
владеет лимитом: 3 попытки на тот же воспроизводимый блокер, не на имя gate за
всю задачу. Содержательное исправление подтверждённой причины требует целевой
проверки; история не стирается. Смена CLI/браузера/чата или гипотеза без изменения
предпосылок не сбрасывает лимит. После исчерпания остановить затронутый путь,
сохранить диагностику и следующий шаг; продолжать независимую разрешённую работу.
Не повторять PASS без изменения входов. Ошибка инструмента не доказывает дефект
продукта; не обходить permissions/auth/CSP/freshness ради теста. Таймауты,
preflight, журналы и cleanup — Workflow §4.1–4.4; бизнес-retries не меняются.

## 8. Git и безопасность

- Согласованная владельцем цель: `origin`
  (`https://github.com/NikIg228/PlatformaMarket.git`), ветка `main`.
- Перед работой смотрите `git status --short --branch` и сохраняйте чужие
  незакоммиченные изменения.
- Одна логическая задача — один понятный conventional commit
  (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`).
- Решение владельца 2026-09-21: после каждой разрешённой задачи реализации
  или документации, review её состава и PASS обязательных gates сразу сделать
  понятный commit и обычный push в согласованную remote/ветку. Это постоянное
  разрешение: повторно спрашивать о каждом push не требуется. Read-only и явное
  «без commit/push» имеют приоритет. Точный порядок — Workflow §5.1.
- Перед staging отделить собственный scope от чужого/незавершённого WIP,
  проверить весь outgoing range, секреты и приватные данные. Добавлять только
  проверенные пути/hunks; не использовать бездумный `git add .`.
- Сохранять текущую ветку; `main` — согласованная remote-цель, не разрешение
  переключить checkout. После fetch доказать fast-forward и разрешённость всего
  outgoing range. При чужих/непроверенных коммитах сохранить свой локальный commit
  и сообщить блокер: не публиковать чужое, не обходить историю cherry-pick/rebase
  или новой копией. Общая интеграция требует явного решения и нужных checks.
- Неоднозначная цель, конфликт, расхождение истории, failed gate или конкурентная
  запись в публикуемый scope блокируют push. Несвязанный dirty diff сам по себе
  не блокирует задачу. Не сливать чужой код молча.
- После push сверить remote SHA с ожидаемым локальным commit и отдельно CI.
  При ошибке сохранить commit и сообщить «локально закоммичено, не отправлено».
  Новые PR, release/tag/deploy и рабочие миграции этим правилом не разрешаются.
- npm — выбранный package manager. Не возвращайтесь к выбору npm/pnpm и не
  меняйте lockfiles в несвязанной задаче; остаточный housekeeping имеет свой scope.
- Не используйте `git reset --hard`, принудительный push, удаление данных или
  production migration без явной задачи и проверки точной цели.
- Секреты, `.env`, production URLs, customer data и реальные ключи не
  попадают в git, логи, фикстуры или ответы.
- Push в ветку сам по себе не доказывает CI: проверить запуск и результат.
  Если CI не настроен на ветку — сообщить NOT_RUN, не открывать PR и не менять
  workflow без соответствующего запроса. Pending CI не означает PASS.

## 9. Формат завершения задачи

Report the requested outcome, ensured invariants, exact checks/results/skips and
reasons, branch/commit, actual publication/CI and remaining risks. Do not call a
known unverified critical result complete. For unfinished work preserve blocker,
attempts and next step in the selected checkpoint; resume after checking changed
inputs, not by restarting the entire audit. Rule-only maintenance records evidence
in the final response, without product-status or other-task checkpoint edits.

## 10. Обязательные project playbooks

Every task uses AGENTS and relevant sections of
`actual_docs/governance/DEVELOPMENT_WORKFLOW.md`; UI tasks also use
`actual_docs/ui-ux/UI_UX_IMPLEMENTATION_STANDARD.md`.

Select relevant professional guidance from
`C:\Users\user\Desktop\Agentic Skills\agency-agents-main`: backend architect
for domain boundaries, frontend developer for implementation, UI designer/UX
architect for UI, code reviewer for risks, Git workflow master for history and
testing roles for evidence. Read the selected instruction fully, not the entire
catalog; reuse unchanged instructions in the same context. Report only roles/
practices actually read and applied, with their purpose. If unavailable, make one
targeted search, then disclose the limitation and use an applicable fallback.

Use installed Taste Skill/Anti Slop for UI under personal preferences; apply the
app-screen route and existing design system to B2B workspaces, tables and forms.
`Leonxlnx/taste-skill` brief-first/art direction serves public pages and redesign
within authorized scope. External stack commands, "NEVER SKIP", mandatory redesign
cycles, screenshots for every task or ideal scores do not override project scope
or risk-based Workflow gates. A role checklist never authorizes spawning agents.

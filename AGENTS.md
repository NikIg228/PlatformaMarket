# PlatformaMarket: правила работы агентов и разработчиков

Этот файл обязателен для любой задачи в репозитории. Он не заменяет
продуктовое ТЗ или архитектурные ADR: он определяет, **как** безопасно
менять проект и как доказывать готовность результата.

Правила сокращены и согласованы 2026-11-12; маршрут документации от 2026-11-04. Главный принцип: **одна согласованная
задача → минимальное изменение → достаточные проверки → остановка**.
Наличие backlog, skill или команды в runbook само по себе не разрешает её выполнять.

## Единственная рабочая папка — решение владельца 2026-09-21

Only `C:\Users\user\Desktop\dentmarket-kz-main` is writable source. Before edits,
verify root, branch/HEAD, dirty files and task scope; preserve others' changes.
No development worktrees/clones/copies: old trees are read-only recovery sources
until separately accepted/retired. Do not switch a dirty checkout; branch changes
need an agreed Git operation. Stop only a concrete affected-path conflict.
Run API/frontend/workers from this root; verify source/profile, not just localhost.
Do not stop others' processes. Disposable test DBs/build artifacts are allowed;
working-data changes or tree removal need separate scope. Commit/push follows §8.
These are agent rules, not technical locks. Selected task context:
`actual_docs/governance/task-state/PRIMARY-SESSION.md`.

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

The continuity rules above apply. "Continue" covers the current card/authorized
sequence, not all backlog; auditing rules does not start backend work.
New functions/integrations/dependencies/stack,
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

[Workflow §4](actual_docs/governance/DEVELOPMENT_WORKFLOW.md#4-матрица-проверок)
owns mandatory risk-based gates, staged backend tests, shared consumers and PASS
reuse, including when personal instructions are unavailable. Verify actual scripts
and prerequisites; use supported scoped types/tests, or the smallest enclosing gate.
Do not default to full `npm test`/E2E for a local UI change.

Required boundaries remain: purchase contract → `verify:core-contract`;
checkout/tenant/rollback/concurrent stock → `verify:postgres`; API/worker runtime →
`verify:runtime-split`; production config → `verify:production-config`; changed
critical UI → targeted browser checks; composition/release → `verify:web` where
Workflow requires it; release → `verify:release`. These are existing npm scripts.
Docs-only requires links/consistency/history preservation and diff hygiene, not
TS/build/DB/browser/security suites. Never check off unpassed acceptance or use
historical PASS without verified unchanged inputs.

### 7.1 Защита от циклов

[Workflow §4.3](actual_docs/governance/DEVELOPMENT_WORKFLOW.md#43-ограниченные-повторы-и-время)
owns retry limits, process timeouts and diagnostic checkpoints. Three attempts
apply to the same reproducible blocker, not a gate name forever. Preserve failures;
recheck actual fixes, do not reset counters by changing tools/chats. Stop only the
blocked path and continue independent authorized work. Tool failure is not product
failure; never bypass permissions/auth/CSP/freshness. Business retries are unchanged.
Preflight, logs, evidence reuse and cleanup follow Workflow §4.1–4.4.

## 8. Git и безопасность

Approved destination: `origin` (`https://github.com/NikIg228/PlatformaMarket.git`),
remote branch `main`. Keep the current checkout branch; this destination does not
authorize switching it. Standing owner authorization (2026-09-21) requires one
meaningful conventional commit and prompt normal push after scope review and
required PASS; read-only/no-push and safety blockers override it. Follow
[Workflow §5.1](actual_docs/governance/DEVELOPMENT_WORKFLOW.md#51-commit-и-немедленный-push-после-проверенной-задачи).

Before staging check root/branch/HEAD/dirty ownership; review the whole commit and
outgoing range for unrelated work, secrets/private data and unintended artifacts.
Stage explicit reviewed paths/hunks, never blind `git add .`. Fetch and prove
fast-forward to the agreed destination. Foreign/unverified outgoing commits,
ambiguous target, divergent history, affected-path conflict, failed required gate
or concurrent writes to the published scope block push. Unrelated dirty work does
not itself block the task. Retain the task-only local commit and report blockers;
no silent merge/rebase/cherry-pick workaround, reset/force-push or new source copy.
Integrating others' commits needs explicit authorization and applicable checks.

Read back remote SHA and inspect actual CI: pending/NOT_RUN is not PASS. If CI is
not configured, report that; do not create a PR/change workflows to obtain a run.
Failed push means local commit only. Permission excludes new PRs, releases/tags,
deploy, working migrations, data deletion and new tasks. Destructive Git/data
operations require explicit scope and exact-target verification.

Use npm; do not reopen package-manager selection or alter unrelated lockfiles.
Secrets, `.env`, production URLs, customer data and real keys must not enter Git,
logs, fixtures or replies. Check first-push deployment effects under Workflow.

## 9. Формат завершения задачи

Report the requested outcome, ensured invariants, exact checks/results/skips and
reasons, branch/commit, actual publication/CI and remaining risks. Do not call a
known unverified critical result complete. For unfinished work preserve blocker,
attempts and next step in the selected checkpoint; resume after checking changed
inputs, not by restarting the entire audit. Rule-only maintenance records evidence
in the final response, without product-status or other-task checkpoint edits.

## 10. Обязательные project playbooks

Every task uses AGENTS and relevant Workflow sections. UI skill routing and
evidence: [UI standard](actual_docs/ui-ux/UI_UX_IMPLEMENTATION_STANDARD.md#применение-ui-скиллов).
Before reopening work, apply the personal `Preserve completed work` rule and §3.

Agency guidance (`C:\Users\user\Desktop\Agentic Skills\agency-agents-main`) is
optional when it adds task-relevant requirements beyond selected project/skill
instructions; do not stack roles for formality. Read chosen guidance and report
only actual use. If unavailable, search once then disclose the limitation/fallback.

External stack commands, "NEVER SKIP", mandatory redesign cycles and ideal scores
do not override authorized scope or risk-based Workflow gates. Role checklists do
not authorize spawning agents. UI direction and skill selection follow the linked
UI standard, not a second copy of the personal skill rules.

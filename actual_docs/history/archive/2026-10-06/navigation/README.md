> ARCHIVE · навигация из commit 2fe8c1fdb91496c1fa32293e81f71a0dcc14f59e; не текущий маршрут чтения. Поздние чужие staged-дополнения не включены в этот снимок.

# PlatformaMarket

B2B-маркетплейс закупок стоматологических клиник Казахстана. Текущий локальный
frontend — единое Next.js приложение; backend — NestJS modular monolith.
Актуализировано01.10.2026 для согласованного выпуска PERFORMANCE-CI-DELIVERY.
Название DentMarket сохраняется в исторических и стабильных технических ID.

## Запуск

После установки зависимостей через `npm ci` и настройки локального окружения:

`npm run dev` — API4012 и единый web3000, вход через http://127.0.0.1:3000.
По умолчанию локально используется go_live/JWT; `npm run dev:pilot` включает
ограниченный профиль. Это не production-допуск и не включение внешних провайдеров.

API сначала собирается и работает без watcher; для backend-разработки есть
`npm run dev:watch-api`. Launcher не создаёт/не мигрирует/не reseed базу.
Подготовка данных — отдельная явно выбранная процедура:
[локальная БД](../../../../runbooks/LOCAL-DEV-DATABASE.md).
Пароли и environment берутся из локальной конфигурации, не из документации.
Перед запуском проверить владельца процессов и свободные порты.

[Единый frontend](../../../../runbooks/UNIFIED-FRONTEND.md) описывает rewrites,
сборку, origins и откат. `npm run build` собирает API/shared и apps/web;
четыре прежних frontend исключены. `dev:legacy` / `build:legacy` сохранены.
Основной CI, browser, release matrix и production compose используют api/web;
прежние Docker targets/compose сохранены для явно выбранного legacy rollback.
Конфигурация не означает принятого production rollout.

## Код

| Путь | Фактическая роль |
| --- | --- |
| apps/api | API, domain services, Prisma/migrations и worker entry point |
| apps/web | Единственный основной web: public, clinic, supplier, admin |
| apps/buyer-web, supplier-web, admin-web, landing-web | Импортируемые компоненты и отдельные legacy entry points; удалять пока нельзя |
| apps/e2e | Unified и legacy Playwright configurations; их покрытие различается |
| packages/schemas | Общие Zod request/response contracts |
| packages/api-client | Типизированный API client и frontend profile |
| packages/ui | Общие Fluent UI v9 примитивы и workflow UI |
| packages/eds-client, one-c-agent | Клиентские границы внешних интеграций, не live acceptance |

## Документация и проверки

Начать с [актуальной документации](../../../../README.md),
[AGENTS.md](../../../../../AGENTS.md) и [Workflow](../../../../governance/DEVELOPMENT_WORKFLOW.md).
Требования — Product V2, незакрытые обязательства — Foundation,
фактическая приёмка — Acceptance Matrix. Архив не является очередью реализации.

Для TypeScript-изменений минимум: `npm run typecheck`, `npm test`,
`git diff --check`; остальные gates выбираются по затронутому риску.
Docs-only не требует запуска runtime suites.

Выпуск01.10 имеет локальные проверки canonical web/API/worker и dependency audit
с нулём advisories; подробные команды, попытки и публикация/CI — в
[карточке выпуска](../governance/task-state/PERFORMANCE-CI-DELIVERY-2026-09-30.md).
Отдельный legacy buyer bundle budget остаётся FAIL.
Это не production-ready release; [статусы и ограничения](../../../../governance/PROJECT_ACCEPTANCE_MATRIX.md).

# Документация PlatformaMarket

Рабочий маршрут с 6 октября 2026: описание продукта → выбранный результат roadmap
→ профильный контракт/справочник → evidence. Старые Product V2 и Foundation
перенесены в архив; прежние адреса служат только переходами.

## Основные документы

| Нужно понять | Читать |
| --- | --- |
| Что за проект, для кого, какие правила и интеграции | [PROJECT_OVERVIEW](PROJECT_OVERVIEW.md) |
| Где находимся и что осталось до production | [Main Roadmap to Production](MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md) |
| Как выполнять задачу и выбирать проверки | [AGENTS](../AGENTS.md), [Workflow](governance/DEVELOPMENT_WORKFLOW.md) |
| Что принято на конкретной версии | [Acceptance Matrix](governance/PROJECT_ACCEPTANCE_MATRIX.md) |
| Текущее владение и состояние выбранной задачи | [Реестр сессии](../.codex/project-session.json), [primary](governance/task-state/PRIMARY-SESSION.md), актуальная карточка задачи |
| Классификация всех материалов | [Documentation index](DOCUMENTATION_INDEX.md) |

Запрос пользователя определяет разрешённый scope. Наличие R0–R9 не поручает
выполнить все этапы. Старый PASS ограничен своими inputs, незавершённый WIP
не считается принятым или опубликованным. Текущая задача пересборки:
[DOCS-REFRESH](governance/task-state/DOCS-REFRESH-2026-10-06.md).

## Справочники по необходимости

| Область | Адрес |
| --- | --- |
| Архитектурное решение | [ADR](architecture/adr) — выбрать относящийся к задаче |
| API и данные | [Schemas](../packages/schemas/src), [API client](../packages/api-client/src), [Prisma](../apps/api/prisma), [OpenAPI](../apps/api/src/platform/openapi/core-openapi.ts) |
| UI | [Стандарт](ui-ux/UI_UX_IMPLEMENTATION_STANDARD.md), [общая тема](ui-ux/SHARED_SEMANTIC_THEME.md); конкретный новый UI-контракт — по карточке его владельца |
| Ролевой code map | [Клиника](applications/buyer-web.md), [поставщик](applications/supplier-web.md), [оператор](applications/admin-web.md); маршруты сверять с кодом |
| Обращения в поддержку | [Общий экран и контракты](applications/support-workspace.md) |
| Запуск | [Unified frontend](runbooks/UNIFIED-FRONTEND.md), [local database](runbooks/LOCAL-DEV-DATABASE.md) |
| Интеграции | [Readiness registry](integrations/connector-readiness.md), [канальные runbooks](integrations/runbooks) |
| Production и эксплуатация | [Deployment](operations/production-deployment.md), [live readiness](operations/live-provider-readiness.md), [наблюдаемость](operations/observability-runbook.md), [восстановление](operations/backup-restore-runbook.md) |
| Безопасность | [Security](security/security.md) |

Нормативный ADR или runbook не архивируется лишь потому, что соответствующий
код уже написан. Команды из всех справочников не суммируются в обязательный suite.
Датированный статус справочника не заменяет текущий roadmap и evidence.

## Архив

[Архив 06.10 и карта сохранённых материалов](history/archive/2026-10-06/README.md)
нужны только для конкретного вопроса о прошлом решении, версии или доказательстве.
Открывать их последними, если действующие источники не отвечают на этот вопрос.
Не включать `history/` и датированные UI references в обычный поиск реализации.
Архивные планы, старые «следующие шаги» и незакрытые чекбоксы не создают задач.
Сохраняемый остаток сопоставлен с R0–R9 в roadmap; архивирование не означает DONE.

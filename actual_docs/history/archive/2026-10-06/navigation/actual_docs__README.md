> ARCHIVE · навигация из commit 2fe8c1fdb91496c1fa32293e81f71a0dcc14f59e; не текущий маршрут чтения. Поздние чужие staged-дополнения не включены в этот снимок.

# Техническая документация PlatformaMarket

Сверка документации30.09; обновление реализации01.10.2026 —
[PERFORMANCE-CI-DELIVERY](../governance/task-state/PERFORMANCE-CI-DELIVERY-2026-09-30.md).
Это вход в действующие документы. Исторические планы и выполненные карточки
исключены из рабочего маршрута; незакрытые результаты перенесены в Foundation.

| Нужно узнать | Действующий документ |
| --- | --- |
| Требования и решения владельца | [Product V2](../product/DENTMARKET_PRODUCT_V2.md), в особенности §9.7 и §23.6 |
| Незавершённые обязательства | [Foundation](../backend/DENTMARKET_BACKEND_FOUNDATION_V2.md) |
| Что можно без интеграций; внешний техдолг и решения | [Foundation §6](../backend/DENTMARKET_BACKEND_FOUNDATION_V2.md#6-разделение-остатка-внутренний-контур-и-техдолг-внешней-готовности) — разделение01.10, без запуска реализации |
| Что доказано и что не принято | [Acceptance Matrix](../../../../governance/PROJECT_ACCEPTANCE_MATRIX.md) |
| Кто работает и что разрешено сейчас | [Primary](../../../../governance/task-state/PRIMARY-SESSION.md), [handoff](../../../../PROJECT_HANDOFF.md) |
| Порядок работы и проверок | [Workflow](../../../../governance/DEVELOPMENT_WORKFLOW.md) и корневой AGENTS.md |
| Фактическое устройство системы | [Архитектура](../architecture/architecture.md), [ADR](../../../../architecture/adr) |
| Результаты аудита и предложения | [Аудит архитектуры и frontend](../architecture/CODEBASE-AUDIT-2026-09-30.md) |
| Запуск web / базы | [Unified frontend](../../../../runbooks/UNIFIED-FRONTEND.md), [Local DB](../../../../runbooks/LOCAL-DEV-DATABASE.md) |
| Ролевые маршруты | [Клиника](../../../../applications/buyer-web.md), [поставщик](../../../../applications/supplier-web.md), [оператор](../../../../applications/admin-web.md) |
| UI-инварианты | [UI/UX standard](../../../../ui-ux/UI_UX_IMPLEMENTATION_STANDARD.md) |
| Production и внешние условия | [Deployment](../../../../operations/production-deployment.md), [live readiness](../../../../operations/live-provider-readiness.md), [connector registry](../../../../integrations/connector-readiness.md) |
| Полный реестр рассмотренных документов | [Documentation index](../../../../DOCUMENTATION_INDEX.md) |

Архив и визуальные reference snapshots доступны только для восстановления
истории/evidence. Не читать их как инструкции новой реализации и не переносить
оттуда незакрытые чекбоксы в задачи. Отложенное не считается выполненным:
единственный текущий перечень остатка — Foundation. Наличие runbook не разрешает
запуск команд, миграции, провайдера или production.

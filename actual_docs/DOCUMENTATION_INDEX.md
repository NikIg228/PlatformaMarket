# Индекс действующей документации

Актуализация 04.11.2026. Это навигация, не отдельное описание продукта или backlog.

## Основной маршрут

| Источник | Роль |
| --- | --- |
| [README](../README.md) | Паспорт проекта, сценарии, архитектура, состояние функций |
| [Roadmap](MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md) | Единственный реестр требований/исполнения R0–R9, пакетов и исправлений аудита |
| [OPEN_QUESTIONS](OPEN_QUESTIONS.md) | Единственный активный список нерешённых условий |
| [AGENTS](../AGENTS.md), [Workflow](governance/DEVELOPMENT_WORKFLOW.md) | Правила исполнения, рисковые проверки, Git и сохранение чужого WIP |
| [Проектные skills](../.agents/skills) | 12 прикладных workflows Market: продукт, домен, доступ, review, frontend/UI-аудит, интеграции/AI, performance, observability, инциденты и проверки. Выбирать по задаче; не заменяют AGENTS, персональные правила или контракты и не разрешают дополнительные действия |

## Технические справочники по выбранной задаче

| Область | Адрес и граница |
| --- | --- |
| Общие контракты | [schemas](../packages/schemas), [api-client](../packages/api-client), [OpenAPI](../apps/api/src/platform/openapi/core-openapi.ts): исполняемые API; сверять до нового DTO |
| Проекты контрактов и приёмка | [MARKET_TARGET_CONTRACTS](architecture/MARKET_TARGET_CONTRACTS.md): логические операции/paid-part/document states, расчётные примеры, 42 AT и отрицательные варианты; не готовый API |
| Архитектура | [ADR](architecture/adr): решения 001–017, только относящиеся к задаче; принятое решение не означает реализованный контракт |
| Данные | [Prisma schema/migrations](../apps/api/prisma), [ER](architecture/er.mmd): фактическая структура и модель |
| Домены | [Каталог доменных справочников](domains/README.md): подробные сценарии/код/таблицы; продуктовые решения и статусы берутся из трёх основных документов |
| Документооборот | [MARKET_DOCUMENT_WORKFLOW](domains/MARKET_DOCUMENT_WORKFLOW.md), [EDS_IMPLEMENTATION_SPEC](domains/EDS_IMPLEMENTATION_SPEC.md): формы, версии, authority/signing; проекты и исторические срезы не подменяют открытые входы |
| Оператор | [Admin](applications/admin-roadmap.md): техническая декомпозиция ADM-00–11; исполнение только в R7.7 основного roadmap |
| Карты приложений | [Buyer](applications/buyer-web.md), [supplier](applications/supplier-web.md), [admin](applications/admin-web.md), [support](applications/support-workspace.md), [auth](applications/auth-session-navigation.md): маршруты/consumers, сверять с кодом |
| UI | [DESIGN_SYSTEM](ui-ux/DESIGN_SYSTEM.md), [UI/UX](ui-ux/UI_UX_IMPLEMENTATION_STANDARD.md), [component-contract.json](../packages/ui/src/component-contract.json), [semantic-light.json](../packages/ui/src/semantic-light.json): обязательные shared controls/tokens и приёмка |
| Интеграции | [Readiness](integrations/connector-readiness.md), [runbooks](integrations/runbooks): выбранный канал/версия/receipt, не обещание live любого адаптера |
| Локальный запуск | [Единый frontend](runbooks/UNIFIED-FRONTEND.md), [локальная БД](runbooks/LOCAL-DEV-DATABASE.md) |
| Deployment | [Профили](operations/deployment-profiles.md), [production](operations/production-deployment.md), [go-live](operations/production-go-live-checklist.md), [live readiness](operations/live-provider-readiness.md) |
| Эксплуатация | [Operations](operations/operations.md), [backup/restore](operations/backup-restore-runbook.md), [observability](operations/observability-runbook.md), [incidents](operations/sla-incident-response.md), [auth](operations/production-auth-runbook.md), [load](operations/b4-6-load-profile.md): процедуры; target RPO/RTO до разрешения DOC008 не выбирать по старой цифре |
| Безопасность | [Security](security/security.md): профильная практика; [remediation status](security/SECURITY_REMEDIATION_STATUS_2026-10-28.md) — evidence версии, не blanket PASS |

## Проверки и текущая работа

| Источник | Роль |
| --- | --- |
| [Acceptance Matrix](governance/PROJECT_ACCEPTANCE_MATRIX.md) | Доказательства конкретного scope/SHA, failures, публикации и CI; не второй план |
| [PRIMARY-SESSION](governance/task-state/PRIMARY-SESSION.md) | Незавершённая выбранная задача, attempts/blockers/процессы; не назначение владельца другим чатам |
| [Evidence](governance/evidence) | Подробные результаты проверок и границы версий |
| [Перенос ответов Q01–Q50, 13.11](governance/evidence/production-answers-preparation-20261113.md) | Источник, сопоставление, внесённые ясные решения и нерешённые границы; не приёмка реализации |
| [Лог документов](domains/document-workflow-implementation-log.md), [лог Admin](applications/admin-implementation-log.md) | Датированные результаты соответствующих R-пунктов |
| [Аудит 04.11](governance/evidence/full-audit-20261104/audit-report.md) | Исходные находки и ограничения аудита; актуальные исправления в roadmap/evidence |
| [Консолидация 04.11](governance/evidence/docs-consolidation-20261104.md) | Проверка переноса требований, ссылок и истории |

## История и старые адреса

PROJECT_OVERVIEW, FUNCTIONAL_AUDIT_AND_ROADMAP, UNIFIED_SPEC, BUSINESS_RULES,
ROADMAP-QUESTIONS-AND-DECISIONS, MARKET-IMPLEMENTATION-QUESTIONNAIRE и
BUSINESS-LOGIC-QUESTIONS-2026-10-16 — COMPAT-переходы к основным документам.
[Исходные редакции 04.11](history/archive/2026-11-04-docs/README.md) сохранены побайтно
с SHA-256; [трассировка](governance/evidence/docs-consolidation-20261104/coverage.md)
показывает адрес назначения каждого ID. Архивы 06.10/03.11, Product V2/Foundation,
старые task cards и reference gallery не становятся очередью реализации.

Читать историю последней, для названного вопроса об основании/версии.
Новая принятая функция изменяет roadmap и при необходимости README; нерешённое
условие — OPEN_QUESTIONS; технический контракт — соответствующий справочник;
результат проверки — evidence/Matrix. Одно событие не требует нового свода.

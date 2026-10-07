# Реестр документации PlatformaMarket

Актуализировано 6 октября 2026. Начать с [описания](PROJECT_OVERVIEW.md)
и выбранного пункта [roadmap](MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md).
Этот реестр классифицирует материалы; его не нужно читать целиком перед задачей.

## Классы документов

- **CURRENT** — рабочие требования, очередь, правила или evidence с границей версии.
- **REFERENCE** — действующий профильный справочник; открывать по затронутой области.
- **EXECUTION** — состояние выбранной задачи/передачи; старые записи не поручения.
- **WIP** — материал другого незавершённого или неопубликованного change set;
  наличие файла не означает приёмку. Путь сверять с карточкой владельца.
- **COMPAT** — старый адрес с переходом в архив; не источник новой реализации.
- **ARCHIVE** — прошлые планы/снимки, только адресная историческая справка последней очереди.

## Текущий набор

| Документ | Класс | Назначение |
| --- | --- | --- |
| [Корневой README](../README.md) | CURRENT | Краткий вход |
| [AGENTS](../AGENTS.md) | CURRENT | Границы и порядок работы |
| [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) | CURRENT | Рабочий источник по назначению |
| [MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md](MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md) | CURRENT | Рабочий источник по назначению |
| [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md) | EXECUTION | Читать только для выбранного scope/владения |
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | CURRENT | Рабочий источник по назначению |
| [README.md](README.md) | CURRENT | Рабочий источник по назначению |
| [applications/admin-web.md](applications/admin-web.md) | REFERENCE | Карта кода; маршруты и статус сверять с текущим кодом |
| [applications/buyer-web.md](applications/buyer-web.md) | REFERENCE | Карта кода; маршруты и статус сверять с текущим кодом |
| [applications/supplier-web.md](applications/supplier-web.md) | REFERENCE | Карта кода; маршруты и статус сверять с текущим кодом |
| [architecture/adr/001-modular-monolith.md](architecture/adr/001-modular-monolith.md) | REFERENCE | Принятое решение; реализация проверяется отдельно |
| [architecture/adr/002-hybrid-catalog.md](architecture/adr/002-hybrid-catalog.md) | REFERENCE | Принятое решение; реализация проверяется отдельно |
| [architecture/adr/003-access-model.md](architecture/adr/003-access-model.md) | REFERENCE | Принятое решение; реализация проверяется отдельно |
| [architecture/adr/004-provider-independent-integrations.md](architecture/adr/004-provider-independent-integrations.md) | REFERENCE | Принятое решение; реализация проверяется отдельно |
| [architecture/adr/005-transactional-outbox-delivery.md](architecture/adr/005-transactional-outbox-delivery.md) | REFERENCE | Принятое решение; реализация проверяется отдельно |
| [architecture/adr/006-platform-authority-policy.md](architecture/adr/006-platform-authority-policy.md) | REFERENCE | Принятое решение; реализация проверяется отдельно |
| [architecture/adr/007-outbound-request-gateway.md](architecture/adr/007-outbound-request-gateway.md) | REFERENCE | Принятое решение; реализация проверяется отдельно |
| [architecture/adr/008-production-outbound-transport-policy.md](architecture/adr/008-production-outbound-transport-policy.md) | REFERENCE | Принятое решение; реализация проверяется отдельно |
| [architecture/adr/009-deployment-profile-composition.md](architecture/adr/009-deployment-profile-composition.md) | REFERENCE | Принятое решение; реализация проверяется отдельно |
| [architecture/adr/010-frontend-deployment-profile.md](architecture/adr/010-frontend-deployment-profile.md) | REFERENCE | Принятое решение; реализация проверяется отдельно |
| [architecture/adr/011-local-full-feature-demonstration.md](architecture/adr/011-local-full-feature-demonstration.md) | REFERENCE | Принятое решение; реализация проверяется отдельно |
| [architecture/adr/012-offer-data-authority.md](architecture/adr/012-offer-data-authority.md) | REFERENCE | Принятое решение; реализация проверяется отдельно |
| [architecture/adr/013-supplier-common-terms-and-admission.md](architecture/adr/013-supplier-common-terms-and-admission.md) | REFERENCE | Принятое решение; реализация проверяется отдельно |
| [architecture/adr/014-local-workspace-sessions.md](architecture/adr/014-local-workspace-sessions.md) | REFERENCE | Принятое решение; реализация проверяется отдельно |
| [architecture/adr/015-unified-frontend.md](architecture/adr/015-unified-frontend.md) | REFERENCE | Принятое решение; реализация проверяется отдельно |
| [architecture/adr/016-commerce-metric-facts.md](architecture/adr/016-commerce-metric-facts.md) | REFERENCE | Принятое решение; реализация проверяется отдельно |
| [architecture/adr/017-temporary-local-full-access.md](architecture/adr/017-temporary-local-full-access.md) | REFERENCE | Принятое решение; реализация проверяется отдельно |
| [architecture/er.mmd](architecture/er.mmd) | REFERENCE | Профильная справка |
| [governance/DEVELOPMENT_WORKFLOW.md](governance/DEVELOPMENT_WORKFLOW.md) | CURRENT | Рабочий источник по назначению |
| [governance/PROJECT_ACCEPTANCE_MATRIX.md](governance/PROJECT_ACCEPTANCE_MATRIX.md) | CURRENT | Рабочий источник по назначению |
| [governance/SESSION_ROLLOVER.md](governance/SESSION_ROLLOVER.md) | EXECUTION | Читать только для выбранного scope/владения |
| [governance/task-state/DOCS-REFRESH-2026-10-06.md](governance/task-state/DOCS-REFRESH-2026-10-06.md) | EXECUTION | Читать только для выбранного scope/владения |
| [governance/task-state/PRIMARY-SESSION.md](governance/task-state/PRIMARY-SESSION.md) | EXECUTION | Читать только для выбранного scope/владения |
| [integrations/connector-readiness.md](integrations/connector-readiness.md) | REFERENCE | Контракт/процедура выбранного канала |
| [integrations/runbooks/custom-api.md](integrations/runbooks/custom-api.md) | REFERENCE | Контракт/процедура выбранного канала |
| [integrations/runbooks/external-adapters.md](integrations/runbooks/external-adapters.md) | REFERENCE | Контракт/процедура выбранного канала |
| [integrations/runbooks/file-import.md](integrations/runbooks/file-import.md) | REFERENCE | Контракт/процедура выбранного канала |
| [integrations/runbooks/manual-supplier.md](integrations/runbooks/manual-supplier.md) | REFERENCE | Контракт/процедура выбранного канала |
| [integrations/runbooks/moysklad.md](integrations/runbooks/moysklad.md) | REFERENCE | Контракт/процедура выбранного канала |
| [integrations/runbooks/one-c-agent.md](integrations/runbooks/one-c-agent.md) | REFERENCE | Контракт/процедура выбранного канала |
| [operations/b4-6-load-profile.md](operations/b4-6-load-profile.md) | REFERENCE | Процедура/условия эксплуатации; не live PASS |
| [operations/backup-restore-runbook.md](operations/backup-restore-runbook.md) | REFERENCE | Процедура/условия эксплуатации; не live PASS |
| [operations/deployment-profiles.md](operations/deployment-profiles.md) | REFERENCE | Процедура/условия эксплуатации; не live PASS |
| [operations/live-provider-readiness.md](operations/live-provider-readiness.md) | REFERENCE | Процедура/условия эксплуатации; не live PASS |
| [operations/observability-runbook.md](operations/observability-runbook.md) | REFERENCE | Процедура/условия эксплуатации; не live PASS |
| [operations/operations.md](operations/operations.md) | REFERENCE | Процедура/условия эксплуатации; не live PASS |
| [operations/production-auth-runbook.md](operations/production-auth-runbook.md) | REFERENCE | Процедура/условия эксплуатации; не live PASS |
| [operations/production-deployment.md](operations/production-deployment.md) | REFERENCE | Процедура/условия эксплуатации; не live PASS |
| [operations/production-go-live-checklist.md](operations/production-go-live-checklist.md) | REFERENCE | Процедура/условия эксплуатации; не live PASS |
| [operations/sla-incident-response.md](operations/sla-incident-response.md) | REFERENCE | Процедура/условия эксплуатации; не live PASS |
| [runbooks/LOCAL-DEV-DATABASE.md](runbooks/LOCAL-DEV-DATABASE.md) | REFERENCE | Профильная справка |
| [runbooks/UNIFIED-FRONTEND.md](runbooks/UNIFIED-FRONTEND.md) | REFERENCE | Профильная справка |
| [security/security.md](security/security.md) | REFERENCE | Профильная справка |
| [ui-ux/DESIGN_SYSTEM.md](ui-ux/DESIGN_SYSTEM.md) | REFERENCE | Единый нормативный вход: компоненты, токены, тема, визуальная приёмка |
| [ui-ux/SHARED_SEMANTIC_THEME.md](ui-ux/SHARED_SEMANTIC_THEME.md) | REFERENCE | Переход и исторический аудит |
| [ui-ux/UI_UX_IMPLEMENTATION_STANDARD.md](ui-ux/UI_UX_IMPLEMENTATION_STANDARD.md) | REFERENCE | UI-инварианты и общая тема |

## Материалы текущего WIP

Публикация этих материалов и связанного продукта не входит в docs-пересборку.
Записи ниже не назначают исполнителя и не закрывают чужой DoD.

| Адрес | Класс | Ограничение |
| --- | --- | --- |
| `actual_docs/applications/support-workspace.md` | WIP | Сверить собственную карточку, local/CI/publication и изменённые inputs |
| `actual_docs/governance/task-state/ORDERS-NOTIFICATIONS-UX-2026-10-06.md` | WIP | Сверить собственную карточку, local/CI/publication и изменённые inputs |
| `actual_docs/governance/task-state/SUPPORT-UX-2026-10-06.md` | WIP | Сверить собственную карточку, local/CI/publication и изменённые inputs |
| `actual_docs/governance/task-state/UI-CONTRACT-2026-10-06.md` | WIP | Сверить собственную карточку, local/CI/publication и изменённые inputs |
| [ui-ux/COMPONENT_CONTRACT.md](ui-ux/COMPONENT_CONTRACT.md) | REFERENCE | Переход к единой дизайн-системе |
| [ui-ux/COMPONENT_CONTRACT_AUDIT.md](ui-ux/COMPONENT_CONTRACT_AUDIT.md) | REFERENCE | Исторический аудит; не текущий контракт или blanket PASS |
| actual_docs/applications/support-workspace.md | [CURRENT · поддержка](applications/support-workspace.md) | Общий экран обращений, черновики, поиск, уведомления и повторное открытие; scope/evidence SUPPORT-UX |

Ссылки этого раздела описывают материалы рабочего дерева. Название прежней
ссылки не является доказательством публикации или полной приёмки.

## Архив и совместимые адреса

[Карта архива06.10](history/archive/2026-10-06/README.md) содержит26 источников:
23 прежних документа/плана и3 снимка навигации из committed baseline.
Исходные адреса23 документов оставлены как COMPAT-переходы. Весь прежний архив
и датированные визуальные references остаются ARCHIVE, не очередью задач.
Контрольные суммы — [manifest](history/archive/2026-10-06/MANIFEST.json).

| Старый адрес | Класс |
| --- | --- |
| [architecture/CODEBASE-AUDIT-2026-09-30.md](architecture/CODEBASE-AUDIT-2026-09-30.md) | COMPAT |
| [architecture/architecture.md](architecture/architecture.md) | COMPAT |
| [backend/DENTMARKET_BACKEND_FOUNDATION_V2.md](backend/DENTMARKET_BACKEND_FOUNDATION_V2.md) | COMPAT |
| [governance/task-state/CABINET-UX-2026-10-02.md](governance/task-state/CABINET-UX-2026-10-02.md) | COMPAT |
| [governance/task-state/CI-DATABASE-2026-09-30.md](governance/task-state/CI-DATABASE-2026-09-30.md) | COMPAT |
| [governance/task-state/CORE-01-INTERNAL-2026-10-01.md](governance/task-state/CORE-01-INTERNAL-2026-10-01.md) | COMPAT |
| [governance/task-state/CORE-02-INTERNAL-2026-10-01.md](governance/task-state/CORE-02-INTERNAL-2026-10-01.md) | COMPAT |
| [governance/task-state/CORE-03-INTERNAL-2026-10-01.md](governance/task-state/CORE-03-INTERNAL-2026-10-01.md) | COMPAT |
| [governance/task-state/CORE-04-INTERNAL-2026-10-01.md](governance/task-state/CORE-04-INTERNAL-2026-10-01.md) | COMPAT |
| [governance/task-state/CORE-05-INTERNAL-2026-10-02.md](governance/task-state/CORE-05-INTERNAL-2026-10-02.md) | COMPAT |
| [governance/task-state/CORE-06-INTERNAL-2026-10-02.md](governance/task-state/CORE-06-INTERNAL-2026-10-02.md) | COMPAT |
| [governance/task-state/CORE-07-INTERNAL-2026-10-02.md](governance/task-state/CORE-07-INTERNAL-2026-10-02.md) | COMPAT |
| [governance/task-state/CORE-08-INTERNAL-2026-10-02.md](governance/task-state/CORE-08-INTERNAL-2026-10-02.md) | COMPAT |
| [governance/task-state/CORE-09-INTERNAL-2026-10-02.md](governance/task-state/CORE-09-INTERNAL-2026-10-02.md) | COMPAT |
| [governance/task-state/DOCS-ARCHITECTURE-AUDIT-2026-09-30.md](governance/task-state/DOCS-ARCHITECTURE-AUDIT-2026-09-30.md) | COMPAT |
| [governance/task-state/PERFORMANCE-CI-DELIVERY-2026-09-30.md](governance/task-state/PERFORMANCE-CI-DELIVERY-2026-09-30.md) | COMPAT |
| [governance/task-state/SHARED-THEME-2026-10-02.md](governance/task-state/SHARED-THEME-2026-10-02.md) | COMPAT |
| [integrations/eds-and-1c-integration-technical-spec.md](integrations/eds-and-1c-integration-technical-spec.md) | COMPAT |
| [product-cards/CATALOG_MEDIA_PIPELINE_AUDIT.md](product-cards/CATALOG_MEDIA_PIPELINE_AUDIT.md) | COMPAT |
| [product-cards/pilot-catalog.md](product-cards/pilot-catalog.md) | COMPAT |
| [product/DENTMARKET_OUT_OF_PILOT_FEATURES.md](product/DENTMARKET_OUT_OF_PILOT_FEATURES.md) | COMPAT |
| [product/DENTMARKET_PRODUCT_V2.md](product/DENTMARKET_PRODUCT_V2.md) | COMPAT |
| [product/PILOT-OPEN-QUESTIONS.md](product/PILOT-OPEN-QUESTIONS.md) | COMPAT |

Открытый остаток перенесён по исходным ID в roadmap. Лицензии, font provenance,
машинные JSON/evidence templates и контрактные исходники не архивированы как
«устаревшая текстовая документация» и сохраняют прежнее назначение.

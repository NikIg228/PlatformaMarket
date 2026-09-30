# Фактическая архитектура PlatformaMarket

Baseline: main@2a816c337bae15f6684318cf26d21bf6f71cb3c5, 30.09.2026;
обновлено01.10 для PERFORMANCE-CI-DELIVERY.
Описание кода отделено от целевых требований. Наличие модуля или теста не означает
принятый полный бизнес-сценарий. Статусы — [Acceptance Matrix](../governance/PROJECT_ACCEPTANCE_MATRIX.md).

## Исполняемые границы

`apps/web` — основной Next.js frontend: public/catalog/auth, /clinic,
/supplier и /admin на одном origin. Значительная часть routes — adapters к
компонентам прежних apps. Admin использует собственный login; общий origin не
даёт пользователю полномочий оператора. Legacy apps остаются source dependencies
и отдельным rollback runtime. Основной CI, release и ingress теперь используют
api/web; живой rollout/rollback требует отдельной приёмки.

PublicCatalog имеет собственный entry/hook без buyer-workspace graph. Auxiliary
supplier corrections/inventory используют server cursor pages; lots/reservations
читаются по раскрытию строки. SupplierOperations разделён внутри прежней lazy
границы. Workspace GET поддерживают отмену транспорта, записи не повторяются.
createActiveCart выделен из CommerceService с прежним transaction/audit boundary.

`apps/api/src/app.module.ts` собирает NestJS modular monolith. API и worker
используют один код и БД, но разные process roles/entry points; production
запрещает all. Состав optional modules определяется deployment profile.
pilot — безопасный default прямого API; локальный launcher явно выбирает go_live.

`packages/schemas` определяет Zod contracts, `packages/api-client` — клиент,
`packages/ui` — Fluent UI v9 primitives и повторно используемые surfaces.
Модули API используют общий PrismaService. Ограничение связности доменов является
архитектурным правилом; отдельные схемы БД или технический запрет cross-module
Prisma reads сейчас не реализованы. Не описывать их как существующую изоляцию.

## Данные и коммерческий путь

PostgreSQL — источник доменного состояния. Prisma schema и migrations являются
исполняемой моделью. [ER](er.mmd) — обзор отношений, не полная схема всех таблиц.
Redis/BullMQ — доставка работ; durable outbox/integration records остаются в БД.
Object storage хранит файлы; uploads проходят отдельный quarantine/scan workflow.

Catalog различает Product, ProductVariant, SupplierOffer, publication, price,
warehouse balance, lot и reservation. Импорт хранит raw rows, результаты matching
и модерации; неоднозначный товар проходит ProductCandidate workflow.
ADR012 определяет authority цены/остатка. Наличие demo/media JSON не превращает
их в подтверждённые коммерческие данные и не отменяет freshness.

Cart/reprice/checkout, условные резервы, split supplier orders, компенсация
неудачного checkout и отдельное восстановление корзины существуют в commerce.
WorkspaceReadsService возвращает ограниченные cursor pages и сводные counts.
OrderWorkflowService добавляет versioned/idempotent manual invoice → claim →
supplier confirmation, отмену и buyer receipt. Квитанция сама не устанавливает
PAID. Денежные инварианты проверяются в транзакции; wire money — точные строки.
Продуктовая полнота частичного исполнения, повторной закупки и §23.6 не следует
из одного LOCAL_PASS набора: остаток перечислен в Foundation.

Старый provider payment path с PaymentIntent/Allocation, ledger и mock/external
adapters сосуществует с manual workflow. Его расчёт platform fee не является
реализацией утверждённой владельцем комиссии10% для нового внутреннего пилота.
Product §23.6 задаёт целевое правило; изменение комиссии/расчётов отложено.

## Доступ и договоры

JWT/session validation и permissions предшествуют tenant data access. Клиентский
organization header сам по себе не даёт прав. Общие версионные условия поставщика,
акцепт и отдельный допуск оператора — текущая модель ADR013; пустой DRAFT не
принимается. Новый поставщик не обязан создавать индивидуальный договор с двумя
ЭЦП. Исторические подписанные договоры и их проверки сохраняются.

## Внешние границы и эксплуатация

Outbound gateway ограничивает host/protocol/DNS/redirect/размер и timeout.
МойСклад использует фиксированный официальный origin. 1C agent инициирует
исходящие запросы; доступ к реальной infobase и подписанный installer — EXT.
Gateway verification ЭЦП не доказывает наличие собственного квалифицированного
NCA verifier. PSP/email/SMS/adapters не считаются LIVE_VERIFIED по mock-тестам.

Документы, логистика, notifications, operations, metrics и optional AI/trust/
promotions/billing/recommendations уже имеют код. Это основание сначала искать
конкретный пробел, а не повторно строить модули. Полнота optional продукта,
реальный rollout, live evidence и POST-BE/POST-FULL остаются отдельной приёмкой.

## Направление развития

Сохранять modular monolith, выносить use cases и read models внутри модулей,
сокращать frontend import graph по измерениям. Отдельные микросервисы, новый
framework или новый design system текущим аудитом не предлагаются.
[Аудит с кодовыми основаниями](CODEBASE-AUDIT-2026-09-30.md) содержит конкретные
кандидаты, измерения и проверки без разрешения автоматически их реализовывать.

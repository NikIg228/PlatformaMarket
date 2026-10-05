# Кабинет поставщика

Актуально30.09.2026 для apps/web на2a816c3. Основной runtime один; исходные
features apps/supplier-web импортируются новым приложением. Старый page.tsx
не является основной новой supplier page и не должен определять приоритет
оптимизации только по длине файла.

| URL | Текущий маршрут |
| --- | --- |
| /supplier | workspaces/dashboard, сводка |
| /supplier/products | Компактный список; карточки на мобильном; детали и редактирование в панели |
| /supplier/products/new | Поиск в мастер-каталоге → упаковка → цена/склад → проверка и отдельная публикация |
| /supplier/products/import | CSV/XLSX: шаблон, столбцы, просмотр, явное подтверждение обработки, история |
| /supplier/products/proposals | История заявки нового товара и повтор после отказа |
| /supplier/products/corrections | Исправления мастер-карточки; bounded correction-offers с поиском и сохранением draft |
| /supplier/products/inventory | Остатки/партии/резервы, фильтр склада; детали загружаются при раскрытии |
| /supplier/products/promotions | Все/действующие/запланированные/архив; условия, предпросмотр и согласование |
| /supplier/orders, /supplier/orders/[id] | Orders/detail, confirmation/invoice/manual payment/shipment |
| /supplier/documents | Общий document workspace |
| /supplier/settings, /supplier/settings/sources | Организация и источники товаров |
| /supplier/legal/[code] | Версионные условия; DRAFT нельзя принять |

Shell использует подтверждённую supplier session и permissions. Sidebar/mobile
menu соответствует решению владельца30.09. Новые общие условия принимаются
отдельно от операторского допуска (ADR013); две ЭЦП не обязательный onboarding.
Публикация по-прежнему требует допуска и готового offer/цены/fresh stock.

Обновление05.10.2026: шесть отдельных разделов товаров используют существующие
операции записи. Импорт не публикует предложения; сохранение акции не отправляет
её на согласование. Отклонённая заявка сохраняется в истории после новой подачи.
Акционная цена вводится в тенге и переводится в фиксированную скидку в minor units
без вычислений денег через floating point; оператор проверяет новую версию условий.

`GET /workspaces/supplier/offers` принимает `publication=published|hidden` и
`attention=required`; фильтры применяются до пагинации и входят в scope cursor.
`GET /workspaces/supplier/inventory` принимает `warehouseId`; склад другой
организации не раскрывает остатки. Резервы возвращают nullable `order` с `id` и
`orderNumber` только для заказа того же поставщика. История собственных заявок
возвращает сохранённое описание, без произвольного raw payload.
`GET /promotions` принимает `phase=ACTIVE|SCHEDULED|ENDED`; count и список используют
одинаковые ограничения. Архив включает истёкшие и исчерпанные акции.

Целевые проверки: `supplier-capabilities.spec.ts` в
`apps/e2e/playwright.workspaces.config.ts` (mocked API, без записей в рабочую БД);
`node scripts/verify-supplier-product-reads.mjs` после сборки API проверяет реальные
PostgreSQL фильтры/tenant/paging в изолированном test profile, откатывая fixtures.

Редактирование цены/остатка versioned/atomic; смена склада не переносит
количество другого склада. Supplier confirmation фактического банковского
поступления отличается от покупательской квитанции и внешнего PSP.

Основные offers/orders и вспомогательные inventory/corrections используют
cursor reads. Новые auxiliary страницы показывают25 записей, API допускает1–100;
курсор привязан к tenant/filter/parent. Ручные overrides тоже имеют страницы.
Legacy full reads сохранены для прежних callers и не используются этими страницами.
Доступ к деталям проверяется по владельцу balance до чтения, отмена GET не
повторяет и не отменяет write-операции. Статус текущего выпуска —
[PERFORMANCE-CI-DELIVERY](../governance/task-state/PERFORMANCE-CI-DELIVERY-2026-09-30.md).
[Аудит](../architecture/CODEBASE-AUDIT-2026-09-30.md),
[приёмка](../governance/PROJECT_ACCEPTANCE_MATRIX.md),
[оставшиеся требования](../backend/DENTMARKET_BACKEND_FOUNDATION_V2.md).

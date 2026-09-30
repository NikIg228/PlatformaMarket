# Оператор площадки

Актуально30.09.2026 для apps/web на2a816c3. /admin переиспользует
apps/admin-web/app/page.tsx, /admin/login — отдельный операторский вход.
Обычный пользовательский login/переключение организации не выдаёт operator
authority. Привилегированная сессия/MFA и серверные permissions сохраняются.

[admin-section-components.tsx](../../apps/admin-web/app/admin-section-components.tsx)
уже динамически загружает разделы: организации/каталог, заявки/корректировки,
договоры/поставщики, integration operations, assurance/settings/audit/trust.
SupplierOperations разделён на setup/import/offers/inventory панели с общим
hook внутри прежнего lazy section. Устранён измеренный двойной GET при выборе
первого поставщика; устаревшие GET отменяются. Остальные крупные sections сами
по себе не доказывают загрузку всех панелей на первом экране. Канонические
требования панели — Product §23.4; полнота продукта не следует из этого refactor.

Операторский UI не является SQL-console, не подтверждает деньги на чужом
банковском счёте по квитанции и не акцептует договор за клиента. Действия
проходят защищённый API с actor/tenant/reason/audit.

Полнота всех панелей, аналитики/обращений и product metrics ещё не принята.
Старые AUD-FIX08/09 не закрыты одним наличие UI.
[Foundation](../backend/DENTMARKET_BACKEND_FOUNDATION_V2.md),
[Matrix](../governance/PROJECT_ACCEPTANCE_MATRIX.md),
[аудит](../architecture/CODEBASE-AUDIT-2026-09-30.md).

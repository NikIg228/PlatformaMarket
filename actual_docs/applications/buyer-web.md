# Клиника и публичный каталог

Актуально30.09.2026 для apps/web на2a816c3. apps/buyer-web содержит
переиспользуемые components и legacy entry point, а не отдельный обязательный
процесс основного dev. Нельзя удалять каталог исходников как «неиспользуемый».

| URL | Реализация / поведение |
| --- | --- |
| / и /catalog | Marketplace route adapters → buyer-workspace publicCatalog; общая шапка, фильтры/URL, карточки/сравнение |
| /products/[id] | Переиспользуемая product page buyer-web; вход сохраняет контекст |
| /clinic | Redirect на /clinic/cart; обычный вход и public catalog имеют свои return rules |
| /clinic/catalog | Redirect на общий /catalog с нормализованными query params |
| /clinic/cart | workspaces/cart, validation/reprice/checkout и recovery |
| /clinic/orders, /clinic/orders/[id] | workspaces/orders/order-detail, manual workflow и receipt |
| /clinic/documents, /clinic/settings | Общие документы и настройки организации |

[Workspace shell](../../apps/web/app/workspaces/workspace.tsx) проверяет сессию,
организацию и permissions. На desktop навигация слева по решению30.09; на mobile
меню с Escape/focus return. Отзыв доступа не должен терять черновик. UI не
заменяет серверный guard, error проверки сессии не означает login/logout.

Каталог/public session и кабинет клиники не одна роль для гостя/поставщика.
Публичная цена за единицу продажи не гарантирует наличие при checkout:
revalidation и явное принятие diff обязательны. Квитанция не означает PAID.

Основные lists ограничены сервером; полный public buyer-workspace остаётся
кандидатом на разделение, см. [аудит](../architecture/CODEBASE-AUDIT-2026-09-30.md).
[Статусы](../governance/PROJECT_ACCEPTANCE_MATRIX.md),
[остаток продукта](../backend/DENTMARKET_BACKEND_FOUNDATION_V2.md).

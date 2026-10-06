# Клиника и публичный каталог

Карта маршрутов сверена06.10.2026; это справочник, не очередь задач. apps/buyer-web содержит
переиспользуемые components и legacy entry point, а не отдельный обязательный
процесс основного dev. Нельзя удалять каталог исходников как «неиспользуемый».

| URL | Реализация / поведение |
| --- | --- |
| / и /catalog | Marketplace route adapters → отдельный public catalog; общая шапка, фильтры/URL, карточки/сравнение |
| /products/[id] | Переиспользуемая product page buyer-web; вход сохраняет контекст |
| /clinic | Страница быстрых ссылок на /catalog, /clinic/cart и /clinic/orders; обычный вход имеет отдельные return rules |
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

Основные lists ограничены сервером; public catalog уже имеет отдельный entry.
Не повторять старое предложение разделить его по архивному аудиту.
[Статусы](../governance/PROJECT_ACCEPTANCE_MATRIX.md),
[остаток продукта](../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md).

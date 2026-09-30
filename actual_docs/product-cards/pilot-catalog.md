# Пилотный каталог: fixture и текущий runtime

Сверено30.09.2026 по JSON и scripts, без чтения/изменения рабочей БД.
Активный public-catalog-fallback.json содержит total500; media manifest total429.
Это статический fixture, не текущее число опубликованных товаров в PostgreSQL.
Builder выбирает500 карточек,10 demo suppliers и50 продуктов на поставщика;
технический sample500 offers не является реальными коммерческими данными.

## Источники

- data/archive/public-catalog-full.json и public-catalog-media-full.json — полный источник отбора.
- apps/buyer-web/app/data/public-catalog-fallback.json и public-catalog-media.json — активные JSON snapshots.
- data/pilot/pilot-catalog-report.json — результат deterministic selection.
- scripts/build-pilot-catalog.mjs — policy отбора: название/описание/вариант/media, category/reuse limits.

Основной frontend — apps/web, использующий buyer-web features и подготовленные
assets. Live API, публикация/freshness и JSON fallback — разные уровни. Ошибка
API не даёт разрешения незаметно reseed базу или продлить остатки.

## Команды по отдельному scope

npm run catalog:build-pilot пересоздаёт JSON fixture, а не рабочую БД.
npm run catalog:prune-media — dry run; вариант :apply удаляет assets и требует
отдельно выбранной области. Это не команда обычной UI-проверки.

Подготовка local marketplace описана в [Local DB](../runbooks/LOCAL-DEV-DATABASE.md).
Она сохраняет заполненный каталог и делает backup перед согласованной подготовкой.
Reference/operator/pilot/test seed profiles раздельны. Проверки с DB writes
выполняются только на verified disposable test DB. Старую последовательность
migrate/seed/sync-production не запускать над текущей рабочей БД из этого файла.

Root npm run build собирает canonical apps/web, legacy сборки отдельны.
Наличие фото/цены/fixture не подтверждает supplier ownership, фактический stock,
media rights и юридический допуск. Реальные данные — отдельная приёмка.

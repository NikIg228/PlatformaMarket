# Восстановление демо-каталога — 29.09.2026

Владелец явно разрешил обновить и возобновить каталог после объяснения причины.
Canonical main646dab5, primary; исходный код и прежний WIP не изменялись.
DB: только локальная dentmarket_audit_20260914, hostname127.0.0.1 проверен.

Scope выбран по audit inventory.freshness.recomputed за09:47:45–09:47:47 UTC:
ровно500 pausedOfferIds; дополнительно проверены PAUSED, blockedReason=null,
ACTIVE offer и demo supplier BIN980*. Подтверждены500 остатков и50 товаров.
До записи сохранён ignored snapshot
outputs/unified-application-20260928/catalog-restore-before-20260929.json.

Одна Serializable transaction:500 остатков STALE→FRESH, lastSuccessfulSyncAt
обновлён, freshnessExpiresAt=2026-10-06T10:41:44.121Z (семь дней), version+1;
500 публикаций PAUSED→PUBLISHED/marketplaceVisible=true. По каждой из10 demo
организаций записан audit demo.catalog.publication_restored. Цены и количества
до/после сверены SHA256 и совпали. Иные paused/blocked предложения не затронуты.
После фиксации существующий SearchProjectionService перестроил только50 товаров.

Проверка актуального /catalog-search с priceBasis=SALE_UNIT и filter options:
total50, первая страница24, все24 имеют предложения. Это тот запрос, который
ранее возвращал0. Данные не reseed, глобальная freshness policy не отключена.
Полные TS/unit/build/browser не запускались: исходный код не менялся.
Dev сохранён; пользователю достаточно обновить страницу. Запись БД — один
успешный запуск, без повторных изменений. Публикация смешанного WIP не выполнялась.

# Ограниченный стенд Market

Этот профиль предназначен только для синтетических данных. Основание и границы:
[ADR019](../../actual_docs/architecture/adr/019-limited-test-stand.md).

На общей ВМ используются отдельные `/opt/platformamarket`, Compose project
`platformamarket-stand`, сеть, PostgreSQL, Redis, хранилище и секреты. Общий
`platformamarket.slice` ограничивает Market до 4 GiB RAM и 2 CPU. Не запускайте
сборки на общей ВМ и не используйте данные или сервисы CRM.

## Подготовка и запуск

1. Сохранить состояние процессов CRM и контрольные суммы её конфигурации.
2. Собрать API, web и stand-access вне ВМ. Перенести образы через `docker save/load`.
3. Поместить файлы профиля в `/opt/platformamarket/releases/limited-20261106`.
   Установить `platformamarket.slice`, выполнить `systemctl daemon-reload`.
4. От root выполнить `STAND_ORIGIN=https://market.example.test node prepare.mjs /opt/platformamarket/shared`,
   подставив согласованный адрес вместо примера.
   Скрипт отказывается перезаписывать существующие секреты.
5. Выполнить `MARKET_ORIGIN=https://market.example.test sh pin-images.sh` с тем же
   адресом: приватный `images.env` фиксирует origin и локальные SHA256 image ID.
   Перед запуском проверить `docker compose --env-file images.env config --quiet`.
6. Запустить `docker compose --env-file images.env up -d`. Миграции выполняет API;
   worker ожидает готовности API. Подготовить синтетические аккаунты через
   `seed-accounts.mjs` внутри API image с доступом только к Market DB.
7. Выполнить `verify-runtime.mjs` внутри закрытой сети с Market env и CA.
   Проверка создаёт MFA для тестовых buyer/supplier и сохраняет секреты только в
   приватный `accounts.json`. Проверить очередь через `verify-worker-recovery.mjs`
   (`prepare` при остановленном только Market worker, затем `check` после запуска).
8. `backup-restore-check.sh` сохраняет БД/файлы/секреты и восстанавливает БД под
   отдельным временным именем. Проверка удаляет только созданную ею restore DB.
9. Добавить Market site через `enable-ingress.sh` после DNS и проверки кандидата
   Caddy. Скрипт подставляет домен из `images.env` и сохраняет исходный блок CRM.
   Проверить HTTPS, пароль стенда,
   JWT/MFA/роли и вход из браузера, затем сверить состояние CRM с исходным.

У всех служебных скриптов фиксированы пути этого стенда. До повторного применения
прочитайте проверки существования: это защита от повторного seed/перезаписи.
Секреты находятся в `/opt/platformamarket/shared` с закрытыми правами, не в Git.

## Обновление web и откат

Сохранить приватную копию `images.env`, загрузить проверенный образ, заменить
только `WEB_IMAGE` его SHA256 image ID. Выполнить
`docker compose --env-file images.env up -d --no-deps web`, дождаться запуска
и проверить ответ web и вход через HTTPS. Для отката вернуть прежний `WEB_IMAGE` и повторить
эту же команду. БД и остальные сервисы не пересоздаются.

`sh switch-web.sh sha256:<image-id>` выполняет это переключение с резервной копией
`images.env` и возвратом прежнего образа при ошибке Compose. После успешного
запуска всё равно обязательны проверка HTTPS и браузерный вход.

Для выключения стенда: `docker compose --env-file images.env stop` из его release
каталога. Не использовать `down -v`, общие prune-команды или команды CRM.
Удаление Market site из Caddy требует сохранения всех остальных актуальных блоков,
`caddy validate` и reload. Не восстанавливать старый общий Caddyfile вслепую.

Резервная копия приёмки хранится на этой же ВМ; она не защищает от потери ВМ.
Автоматическое внешнее резервирование и обновление AV-сигнатур в закрытой сети
не настроены. Для реальных данных и коммерческого запуска нужен обычный
production-профиль и отдельная приёмка подключённых сервисов.

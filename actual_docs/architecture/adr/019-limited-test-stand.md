# ADR019: закрытый стенд без внешних интеграций

Решение владельца 06.11.2026: отдельный ограниченный тестовый Market на ВМ CRM.
Реальные платежи и внешние отправки выключены; защита входа сохраняется.

`LIMITED_TEST_STAND=true` допустим только с `NODE_ENV=production` и
`DEPLOYMENT_PROFILE=go_live`. JWT, ROLE_BASED, обязательная MFA, TLS PostgreSQL
и Redis, AV, encryption/media/metrics keys остаются обязательными. Локальные
auth-инструменты и demo headers не разрешаются. За Caddy работает отдельный
stand-access; API, web и gate доступны Caddy по отдельной внутренней Docker-сети
со статическими адресами, без публикации портов на интерфейсах хоста.

Платёжный режим `disabled` разрешён только здесь. Provider admission, прямые
платёжные операции и обработка callbacks возвращают отказ до внешних эффектов.
Внешние EMAIL/SMS/WEBHOOK, подписи (включая MOCK/SIMPLE), OAuth и общие outbound
интеграции заблокированы. AI использует существующий ответ без внешней модели.
Фальшивые результаты «оплачено», «отправлено», «подписано» не генерируются.
Внутренние уведомления сохранены; внешние записи не выбираются из очереди.
Настройка внешних provider credentials/endpoints в этом режиме — ошибка старта.

Саморегистрация/сброс пароля с email недоступны. Тестовые учётные записи
создаются отдельно только в новой синтетической БД. Штатные password login,
tenant/role/session/MFA проверки не меняются.

Только для синтетических файлов допускается private local storage с явно
заданным абсолютным `LOCAL_STORAGE_PATH`, отдельным volume и закрытыми правами.
Публичный file-server отсутствует; выдача остаётся через авторизованный API.
Fallback к public fixtures отключён. Это исключение не означает S3/SSE,
отказоустойчивость или пригодность для персональных/рабочих данных.

Release validator требует HTTPS origin и go_live; при явно выбранном limited
mode Google/Apple параметры должны отсутствовать. Обычный production по
умолчанию сохраняет прежние provider/storage/telemetry требования.

Развёртывание: отдельные DB/Redis/AV, сеть, volumes, secrets и cgroup лимиты;
внешний egress приложений запрещён дополнительной сетевой границей. Образы
собираются вне ВМ. CRM не используется как источник тестовых данных. Откат
останавливает только Market; изменения Caddy ограничиваются Market site block.

Приёмка: отрицательная конфигурационная матрица, прямые adapter calls без сети,
отказы callbacks до DB/settlement, сохранение IN_APP, private storage, обычные
production guards; далее isolated container и live HTTPS/role/tenant/AV/recovery,
backup/restore/rollback и независимая проверка CRM. CI не заменяет live evidence.

Результаты: [приёмка ограниченного стенда](../../governance/evidence/limited-stand-20261106.md).

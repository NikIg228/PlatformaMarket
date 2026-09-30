# ADR 010: frontend deployment profile

## Статус

Принято и локально проверено 2026-09-13. Production deployment не заявлен.

Дополнение 2026-09-14: локальный launcher из [ADR 011](011-local-full-feature-demonstration.md)
явно передаёт go_live; отсутствие профиля в shared config по-прежнему означает
pilot. Закрытый task card ниже — evidence исторического slice, не задание
повторить его. Выбор и reuse gates — Workflow §4.

## Решение

Frontend приложения получают публичный профиль при сборке из
`DEPLOYMENT_PROFILE` через общий контракт `packages/schemas`. Отсутствующее
значение выбирает `pilot`; неизвестное значение или конфликт с явно заданным
`NEXT_PUBLIC_DEPLOYMENT_PROFILE` останавливает конфигурацию. Самостоятельный
публичный флаг не может включить `go_live` при отсутствующем backend-профиле.
Turbo включает оба значения в cache key. Смена профиля требует новой сборки
web и согласованного профиля API; изменение env после сборки не переключает UI.

Общий inventory закрывает AI, trust/reviews, promotions, billing и smart
recommendations. Pilot UI не монтирует эти панели и не загружает их данные.
`MarketplaceApiClient` дополнительно отвергает такие запросы до `fetch`;
backend module graph из ADR 009 остаётся границей авторизации и доступности.
Geo/address, procurement budgets, support, documents и core commerce сохраняются.


## Уточнение30.09.2026

ADR015 заменяет число основных frontend артефактов: теперь apps/web один.
Build-time profile/default/mismatch/cache правила сохраняются и для legacy.
Закрытая task card и локальный результат13.09 перенесены в архив: повторная
реализация не требуется. Текущие limits/evidence — Acceptance Matrix.

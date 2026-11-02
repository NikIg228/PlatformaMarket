# ADR 018: Личная корзина и проверенный личный контекст

Статус: реализовано; scoped local PASS первого пакета R7.1.1 от02.11.2026.
Evidence: [приёмка П01](../../governance/evidence/personal-cart-20261102.md).
Публикация/CI учитываются отдельно; личный checkout не входит в этот ADR.

## Основание

Пользователь разрешил первый пакет из orders.md#b2c-first-package. Cart,
Checkout и финансовые сущности сейчас принадлежат организации. Распространение
nullable buyerOrganizationId на commerce увеличило бы риск всей покупки.

## Решение

- Отдельные PersonalCart/PersonalCartItem, один current cart на User (unique FK).
  Организационные Cart/Checkout/Order/PaymentIntent и их связи сохраняются.
- Владелец выводится из bearer, выпущенного по действующей sign-in HttpOnly
  сессии. Личный bearer содержит personal=true и пустой organization context,
  принимается только personal cart API; обычный bearer там не принимается.
  Проверки подписи, MFA по конфигурации, срока и отзыва сессии сохраняются.
  Development headers не являются личной авторизацией.
- Personal session restoration не требует membership и не переключает ЮЛ.
  Потеря сессии/смена аккаунта обнуляет состояние клиента и отменяет применение
  запоздалых ответов. Токен не хранится в persistent browser storage.
- Общий resolver предложения с явным nullable buyerOrganizationId: null означает
  публичные условия без contractPrices и allowedBuyerIds. Общие money/UOM/stock/
  promotion snapshots переиспользуются; нет резерва или promotion redemption.
- Мутации требуют expectedVersion и сериализуются CAS родительской строки в
  транзакции с audit. Добавление задаёт абсолютное количество; stale/replay
  отклоняется409 и не дублирует запись. Unique(cartId,offerId) сохраняет одну строку.
  Quantity edit сохраняет принятые условия; validate показывает актуальный diff.
  Reprice сверяет переданный показанный snapshot с актуальным внутри транзакции.
- DTO возвращает только личный snapshot и публичные названия, не raw offer graph.
  Checkout отсутствует; организационный checkout не находит PersonalCart.

## Миграция и проверка

Expand-only: новые таблицы/FK/index/check constraints без backfill существующих
корзин. Рабочая миграция не входит в поручение. Upgrade-path проверяется на
disposable DB с сохранением B2B rows. Откат приложения оставляет новые таблицы
и данные; их удаление не автоматизируется. Gates перечислены в карточке пакета.

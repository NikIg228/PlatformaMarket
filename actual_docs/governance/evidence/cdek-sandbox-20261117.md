# СДЭК: песочница и блок доставки в заказе

## Scope и проверки

Поручение владельца 17.11.2026: подключить песочницу и разрабатывать модуль
доставки на странице заказа Market без перехода в ЛК СДЭК.
До задачи: внутренняя логистика без адаптера СДЭК → подтверждены официальный
учебный API и отсутствие ключей в ЛК → отдельный sandbox adapter и блок заказа.
Baseline main c2b04d49631e9f730e44d11e41963b95d17bb258; существующие изменения
commerce/payment/schema и audit evidence не принадлежат этой задаче.

Первый проверяемый сценарий: доступ участника к своему заказу, поиск городов,
расчёт учебных тарифов по грузовым местам, выбор варианта внутри Market.
Учебный расчёт не меняет коммерческие условия, не открывает оплату и не создаёт
реального отправления. Production activation и юридическая гарантия цены открыты.
Отдельные тестовые credentials берутся из официального SDK, не из боевого ЛК.

Риск: tenant isolation, утечка credentials, ошибочное представление учебной цены
как окончательной, устаревший ответ после изменения формы. Проверки: focused
schema/adapter/access/client/UI regressions; types/build затронутых пакетов;
runtime-split; targeted browser desktop/mobile/keyboard и screenshot review;
diff hygiene. Проверка sandbox только на синтетическом маршруте, без контактов
из ЛК и без реальных отправлений. Завершение: результаты и ограничения ниже.

UI: skills market-review-frontend, market-build-integration-reliability,
market-run-verification, antislop (during, persisted owner preference), human,
copywriting, layoutmobile. Существующий Fluent UI, controls44px, body14px,
card12px, spacing16/24px; component-contract market-components-v1 и
semantic-light platforma-semantic-light-v1. Аналог: offer-delivery-editor.tsx;
маршруты /clinic/orders/[id] и /supplier/orders/[id], общий order-detail.tsx.
Сохраняются shell/tokens. Поля с подписями, LoadingState, ввод сохраняется при
ошибке, учебные результаты явно отделены от суммы заказа. Direction: рабочая
форма Market для клиники/поставщика, ENERGY1/RHYTHM1/MOTION1. Исходная страница
и изменённый runtime осмотрены через Chrome extension, без изменения общего дизайна.

## Результаты

LOCAL_PASS первого сценария. Полная интеграция R5.1 остаётся открыта.

- Внешний sandbox: OAuth, справочник KZ и 12 тарифов для Алматы → Караганда,
  упаковка 1000 г / 20×20×10 см. Запрос валюты `2` (KZT); точные minor units.
  Receipt: `.tmp/cdek-sandbox-20261117/live-receipt.json`, 17.11.2026 09:55 UTC.
- 29 focused tests PASS: adapter 12, controller 4, schema 8, client 1, UI 4.
  Команды: workspace vitest run соответствующих `cdek-sandbox*.spec.ts`;
  web `vitest run app/workspaces/cdek-sandbox-panel.test.tsx`.
  UI повторно PASS после исправления длинного тарифа и заголовка ошибки.
- HTTP на отдельном API: свой заказ 200, без сессии 401, чужой заказ 404,
  подмена организации 401, нет `delivery.view` 403, неверная упаковка 400,
  восстановленные права 200. `.tmp/cdek-sandbox-20261117/http-receipt.json`.
  Изменялось только право созданной для проверки роли в disposable DB, восстановлено.
- Builds schemas/api-client, API typecheck и Nest build PASS. Первый wrapper
  API build остановлен EPERM при замене используемой Prisma DLL; generated
  schema сверена с source без различий кроме форматирования, повторён Nest build
  с существующим клиентом. Ошибка порядка OpenAPI import обнаружена runtime-проверкой,
  исправлена; повторные build и `verify-runtime-split.mjs` PASS.
- Next production build/types PASS после финальной UI-правки, отдельный артефакт
  с `NEXT_PUBLIC_CDEK_SANDBOX=true`, API 4098, web 3098. Scoped ESLint и
  `npm run verify:ui-contract` PASS (лог `ui-contract.log`).
  Логи: `.tmp/cdek-sandbox-20261117/{api-build-recheck,web-build-final,lint-final}.log`.
- PostgreSQL integration script PASS на разрешённой disposable DB, после build
  prerequisites; рабочая база и заказы не изменялись. Лог `postgres.log` там же.
  Базовые foreign WIP не включаются в результат этой задачи.

## UI delivery gate

Chrome: supplier order, нормальный вход тестовой учёткой; desktop 1536 px,
mobile 390×844, tablet 768×1024. Скриншоты получены и визуально осмотрены
в инструменте: геометрия, длинный тариф, пустой поиск, ошибка, RU/KK.
Горизонтального overflow на desktop/mobile нет; кнопка 44 px, input wrapper
43.6 px (масштабирование), текст 14 px; shared Fluent controls без overrides.
Длинный выбранный тариф дополнительно выведен с переносами, цена видна на телефоне.

PASS: поиск с различением регионов, LoadingState города/расчёта, пустая Астана,
валидация до API, выбор тарифа, сброс тарифа при изменении упаковки, Enter/Tab и
видимый keyboard focus. После контролируемой остановки только task API ввод
сохранился, показана безопасная ошибка; после запуска повтор вернул тарифы.
Сумма тестового заказа не изменилась. KK labels/validation проверены на 768 px.
Диалоги и focus return N/A: модуль диалогов не добавляет. Клиника использует тот же
order-detail и компонент; отдельный browser login клиники не выполнялся.
Внешние названия тарифов приходят на русском из API; перевод перевозчика не заявлен.

## Граница и продолжение

Выбор тарифа локальный, в заказ не сохраняется. Форма — одно место, API — до 20.
Конкретный ПВЗ/адрес, sandbox booking/cancel/tracking и сохранённые условия доставки
ещё не реализованы. Production блокируется, реальные отправления не создавались.
Юридические условия фиксированной цены и договора остаются V13 OPEN.
Результат не означает production acceptance или завершение R5.1.

Оставлен локальный просмотр на 3098 с API 4098 и отдельной синтетической учёткой.
Credentials лежат только в ignored локальном файле. Исходный Market 3000 не остановлен.
Повтор проверок нужен при изменении adapter/контрактов/доступа/UI или окружения;
неизменённые результаты сохраняются. Публикация и CI сообщаются отдельно после
task-only diff review; в этом документе они не заявляются заранее.

# SUPPLIER-STOREFRONT-20261030

## Результат и граница

По поручению владельца имя/логотип поставщика в предложениях товара открывает
публичную страницу `/catalog/suppliers/[supplierId]` в оболочке каталога.
Шапка показывает название, логотип, описание, расположение, график, доставку
и разрешённый официальный контакт. Сведения RU/KK редактируются в настройках
поставщика, вкладка «Витрина»; это отдельный вход от публичной страницы.

Товар попадает в витрину только с доступным предложением этого поставщика:
публичная публикация, допуск/договор, активные товар/вариант/предложение/склад,
актуальные цена и остаток, подходящая партия и минимальная кратная порция.
Чужие, приватные, неактивные, просроченные и нулевые предложения исключаются
из результата, количества и параметров фильтра. URL-параметр не может сменить
поставщика или отключить проверку наличия. Возврат из товара сохраняет витрину.

Обновление текста/логотипа требует права `supplier.profile.manage` в своей
организации и `expectedVersion`. Повтор/устаревшая версия возвращает conflict;
транзакция объединяет запись, audit и outbox. UI сохраняет черновик при ошибке,
а загрузка серверной версии требует подтверждения замены. Логотип PNG/JPEG до
2 МБ проходит существующие quarantine/scanner/storage правила.

Добавлена additive migration `20261030010000_supplier_storefront`:
`SupplierProfile.storefrontContent`, `storefrontVersion`, `storefrontLogoAssetId`.
Shared schemas, клиент и OpenAPI описывают чтение, поиск, настройки и логотип.
SQL сравнивает Prisma UTC timestamps с `timezone('UTC', NOW())`, независимо
от timezone PostgreSQL-сессии. Данные рабочего каталога не мигрировались.

## Проверки 30.10.2026

База `main@959de79`, canonical source + scoped diff, существующий mixed WIP
личной корзины сохранён отдельно. Проверки ниже относятся к этим входам;
локальный результат не означает deployment или полную приёмку R7.

| Проверка | Результат |
| --- | --- |
| Schemas: `vitest run src/supplier-storefront.test.ts` | 3 PASS; schemas build PASS |
| API: `vitest run --dir src src/modules/search src/modules/suppliers/supplier-storefront.service.spec.ts src/platform/http/request-body-policy.spec.ts` | 4 файла, 32 PASS |
| Client: `vitest run src/storefront.test.ts` | 1 PASS: public/auth paths, query encoding, cancellation |
| Buyer: marketplace-url/navigation/supplier-identity/compact-catalog/catalog-filter-model | 5 файлов, 15 PASS |
| UI: `vitest run --dir src src/index.test.tsx` | 4 PASS; существующие shared consumers |
| `typecheck` API/schemas/api-client/ui/buyer-web/web | PASS; финальные Next builds также выполнили TypeScript |
| API build | PASS; Prisma client generated по изменённой schema |
| `npm run db:test -- exec -- npm exec --workspace=@marketplace/api -- prisma validate` | PASS |
| `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs` | PASS, полный gate на `dentmarket_audit_20260914` |
| `npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only` | PASS; response/error/OpenAPI contracts |
| `node scripts/verify-runtime-split.mjs` | PASS API/worker/all и entrypoint/production guards |
| `npm run build --workspace=@marketplace/web` | PASS, final attempt4 |
| `npm run build --workspace=@marketplace/buyer-web` | PASS, attempt5, включая исходный bundle budget |
| Scoped ESLint, `npm run verify:ui-contract`, `git diff --check` | PASS; 464 CSS/TSX, 7893 JSX controls/elements |

Prerequisites schemas/API build выполнены отдельно и переиспользованы для
contract/PostgreSQL/runtime команд; alias coverage не сокращён. После добавления
бинарного ответа логотипа в OpenAPI повторены API build и contract gate.
После frontend исправлений повторены затронутые сборки/проверки, не backend suites.

PostgreSQL доказал upgrade с сохранением существующих данных, validation,
tenant/role denial, CAS/replay, rollback при сбое audit/outbox, logo validation,
commercial admission, фиксированного поставщика, доступность и пустой результат.
Полный gate дополнительно подтвердил зависимые checkout/stock/tenant invariants.
Рабочая БД не использовалась; fixtures и запущенные для проверки процессы удалены/остановлены.

Браузер на реальном isolated API: карточка → имя поставщика → витрина,
поиск/empty, фильтры без смены поставщика, клавиатура/Escape/focus return,
переход в товар/возврат, RU1440/KK390, отсутствие горизонтального overflow,
сохранение настроек, stale409/сохранность draft/cancel/confirm reload,
upload/чтение логотипа,503/retry и404 — PASS. Screenshot/computed styles проверены.
Тексты общих controls/оболочки сохраняют имеющуюся локализацию; RU/KK относится
к новым сведениям и заголовкам витрины, не ко всему приложению.

Локальные screenshot artifacts: `output/playwright/storefront/desktop-ru.png`,
`mobile-kk.png`, `legacy-production-smoke.png`. Они не являются production данными.
Legacy production smoke отдельно подтвердил загрузку chunks и открытие/Escape
фильтров; его API4012 был недоступен, поэтому это не полный legacy data-flow PASS.
Полный пользовательский путь проверен в unified web с isolated API4516.

## История исправлений и ограничения

Ранние PostgreSQL attempts1–8 FAIL сохранены в `.tmp/storefront-postgres-focused-*.log`:
инициализация imports, fixture permissions/public buyer context, затем timezone.
Focused attempt9 и последующий полный gate PASS. Владелец отдельно разрешил
необходимые повторные циклы этой задачи без нового согласования на каждый запуск.

Buyer attempts1–4 компилировались, но не прошли лимит25 initial JS files при24.
Отложены загрузка API витрины и диалога фильтров; заголовок передаётся в каталог
как ReactNode. Объединены initial Fluent runtime chunks, как ранее icons.
Attempt5:22 файла,1335852 raw bytes,400486 gzip при прежних лимитах24/1500000/450000.
Это измерение артефакта, не утверждение об ускорении пользовательского сценария.
Все failure logs сохранены. UI-contract budgets/security guards не ослаблялись.

Личная корзина, её schema/routes/auth и незавершённая приёмка не входят в scoped
публикацию витрины. Рабочие миграции, deploy, внешние интеграции, полная локализация
и общая приёмка R7 не выполнялись. Публикация/CI фиксируются отдельно от local PASS.
